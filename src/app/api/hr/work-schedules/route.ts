import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  assertScheduleWindow,
  normalizeScheduleCode,
  normalizeWorkingDays,
  parseClockMinute,
} from "@/lib/hr"
import { nullableHrText, workScheduleSelect } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const scheduleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(32),
  description: z.string().trim().max(500).optional().nullable(),
  workingDays: z.array(z.union([z.string(), z.number()])),
  startTime: z.union([z.string(), z.number()]),
  endTime: z.union([z.string(), z.number()]),
  breakMinutes: z.coerce.number().int().min(0).max(720).default(60),
  graceMinutes: z.coerce.number().int().min(0).max(180).default(15),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const user = await requireAuth()
    const schedules = await prisma.workSchedule.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }],
      select: workScheduleSelect,
    })
    return ok({ schedules })
  } catch (error) {
    return handleApiError(error, "WORK_SCHEDULES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.workScheduleManagement)
    const parsed = scheduleSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات جدول الدوام غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }

    const workingDays = normalizeWorkingDays(parsed.data.workingDays)
    const startMinute = parseClockMinute(parsed.data.startTime)
    const endMinute = parseClockMinute(parsed.data.endTime)
    assertScheduleWindow({
      startMinute,
      endMinute,
      breakMinutes: parsed.data.breakMinutes,
      graceMinutes: parsed.data.graceMinutes,
    })
    const code = normalizeScheduleCode(parsed.data.code)
    const meta = await getRequestMeta()

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.workSchedule.count({ where: { companyId: user.companyId } })
      const isDefault = parsed.data.isDefault || count === 0
      if (isDefault) {
        await tx.workSchedule.updateMany({
          where: { companyId: user.companyId, isDefault: true },
          data: { isDefault: false },
        })
      }
      const schedule = await tx.workSchedule.create({
        data: {
          companyId: user.companyId,
          name: parsed.data.name,
          code,
          description: nullableHrText(parsed.data.description),
          workingDays,
          startMinute,
          endMinute,
          breakMinutes: parsed.data.breakMinutes,
          graceMinutes: parsed.data.graceMinutes,
          isDefault,
          isActive: isDefault ? true : parsed.data.isActive,
        },
        select: workScheduleSelect,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.WORK_SCHEDULE_CREATED,
        entityType: "WorkSchedule",
        entityId: schedule.id,
        message: `تم إنشاء جدول الدوام ${schedule.name}`,
        metadata: { code: schedule.code, workingDays, startMinute, endMinute },
        ...meta,
      })
      return schedule
    })
    return ok({ schedule: created }, 201)
  } catch (error) {
    return handleApiError(error, "WORK_SCHEDULES_POST_ERROR", "تعذر إنشاء جدول الدوام")
  }
}
