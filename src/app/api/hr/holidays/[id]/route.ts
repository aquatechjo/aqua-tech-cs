import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { nullableHrText } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  date: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.holidayManagement)
    const { id } = await params
    const existing = await prisma.publicHoliday.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError("العطلة غير موجودة", 404, "HOLIDAY_NOT_FOUND")
    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) throw new ApiError("بيانات العطلة غير صحيحة", 400, "VALIDATION_ERROR")
    const meta = await getRequestMeta()
    const holiday = await prisma.$transaction(async (tx) => {
      const updated = await tx.publicHoliday.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.date !== undefined ? { date: dateKeyToUtc(parsed.data.date) } : {}),
          ...(parsed.data.notes !== undefined ? { notes: nullableHrText(parsed.data.notes) } : {}),
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.HOLIDAY_UPDATED,
        entityType: "PublicHoliday",
        entityId: updated.id,
        message: `تم تعديل عطلة ${updated.name}`,
        metadata: { date: updated.date.toISOString() },
        ...meta,
      })
      return updated
    })
    return ok({ holiday: { ...holiday, date: holiday.date.toISOString() } })
  } catch (error) {
    return handleApiError(error, "HOLIDAY_PATCH_ERROR", "تعذر تعديل العطلة")
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.holidayManagement)
    const { id } = await params
    const existing = await prisma.publicHoliday.findFirst({ where: { id, companyId: user.companyId } })
    if (!existing) throw new ApiError("العطلة غير موجودة", 404, "HOLIDAY_NOT_FOUND")
    const meta = await getRequestMeta()
    await prisma.$transaction(async (tx) => {
      await tx.publicHoliday.delete({ where: { id: existing.id } })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.HOLIDAY_DELETED,
        entityType: "PublicHoliday",
        entityId: existing.id,
        message: `تم حذف عطلة ${existing.name}`,
        metadata: { date: existing.date.toISOString() },
        ...meta,
      })
    })
    return ok({ deleted: true })
  } catch (error) {
    return handleApiError(error, "HOLIDAY_DELETE_ERROR", "تعذر حذف العطلة")
  }
}
