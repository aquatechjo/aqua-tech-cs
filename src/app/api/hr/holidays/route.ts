import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { currentBusinessYear } from "@/lib/hr"
import { nullableHrText } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

const holidaySchema = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.string().trim(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const year = Number(
      url.searchParams.get("year") || currentBusinessYear(new Date(), user.company.timezone),
    )
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new ApiError("السنة غير صحيحة", 400, "INVALID_YEAR")
    }
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: new Date(`${year}-01-01T00:00:00.000Z`), lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) },
      },
      orderBy: { date: "asc" },
    })
    return ok({
      holidays: holidays.map((holiday) => ({
        ...holiday,
        date: holiday.date.toISOString(),
        createdAt: holiday.createdAt.toISOString(),
        updatedAt: holiday.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    return handleApiError(error, "HOLIDAYS_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.holidayManagement)
    const parsed = holidaySchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات العطلة غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    const date = dateKeyToUtc(parsed.data.date)
    const meta = await getRequestMeta()
    const holiday = await prisma.$transaction(async (tx) => {
      const created = await tx.publicHoliday.create({
        data: {
          companyId: user.companyId,
          name: parsed.data.name,
          date,
          notes: nullableHrText(parsed.data.notes),
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.HOLIDAY_CREATED,
        entityType: "PublicHoliday",
        entityId: created.id,
        message: `تمت إضافة عطلة ${created.name}`,
        metadata: { date: created.date.toISOString() },
        ...meta,
      })
      return created
    })
    return ok({ holiday: { ...holiday, date: holiday.date.toISOString() } }, 201)
  } catch (error) {
    return handleApiError(error, "HOLIDAYS_POST_ERROR", "تعذر إضافة العطلة")
  }
}
