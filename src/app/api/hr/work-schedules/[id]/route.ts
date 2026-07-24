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

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(1).max(32).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  workingDays: z.array(z.union([z.string(), z.number()])).optional(),
  startTime: z.union([z.string(), z.number()]).optional(),
  endTime: z.union([z.string(), z.number()]).optional(),
  breakMinutes: z.coerce.number().int().min(0).max(720).optional(),
  graceMinutes: z.coerce.number().int().min(0).max(180).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.workScheduleManagement)
    const { id } = await params
    const existing = await prisma.workSchedule.findFirst({
      where: { id, companyId: user.companyId },
      select: workScheduleSelect,
    })
    if (!existing) throw new ApiError("جدول الدوام غير موجود", 404, "WORK_SCHEDULE_NOT_FOUND")

    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات جدول الدوام غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }

    const startMinute = parsed.data.startTime === undefined
      ? existing.startMinute
      : parseClockMinute(parsed.data.startTime)
    const endMinute = parsed.data.endTime === undefined
      ? existing.endMinute
      : parseClockMinute(parsed.data.endTime)
    const breakMinutes = parsed.data.breakMinutes ?? existing.breakMinutes
    const graceMinutes = parsed.data.graceMinutes ?? existing.graceMinutes
    assertScheduleWindow({ startMinute, endMinute, breakMinutes, graceMinutes })

    if (existing.isDefault && parsed.data.isDefault === false) {
      throw new ApiError("عيّن جدولًا افتراضيًا آخر بدل إلغاء الجدول الافتراضي", 409, "DEFAULT_SCHEDULE_REQUIRED")
    }
    if (existing.isDefault && parsed.data.isActive === false) {
      throw new ApiError("لا يمكن تعطيل جدول الدوام الافتراضي", 409, "DEFAULT_SCHEDULE_REQUIRED")
    }

    const meta = await getRequestMeta()
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault === true && !existing.isDefault) {
        await tx.workSchedule.updateMany({
          where: { companyId: user.companyId, isDefault: true },
          data: { isDefault: false },
        })
      }
      const schedule = await tx.workSchedule.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.code !== undefined ? { code: normalizeScheduleCode(parsed.data.code) } : {}),
          ...(parsed.data.description !== undefined
            ? { description: nullableHrText(parsed.data.description) }
            : {}),
          ...(parsed.data.workingDays !== undefined
            ? { workingDays: normalizeWorkingDays(parsed.data.workingDays) }
            : {}),
          startMinute,
          endMinute,
          breakMinutes,
          graceMinutes,
          ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
          ...(parsed.data.isDefault === true
            ? { isActive: true }
            : parsed.data.isActive !== undefined
              ? { isActive: parsed.data.isActive }
              : {}),
        },
        select: workScheduleSelect,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.WORK_SCHEDULE_UPDATED,
        entityType: "WorkSchedule",
        entityId: schedule.id,
        message: `تم تعديل جدول الدوام ${schedule.name}`,
        metadata: { before: existing, after: schedule },
        ...meta,
      })
      return schedule
    })
    return ok({ schedule: updated })
  } catch (error) {
    return handleApiError(error, "WORK_SCHEDULE_PATCH_ERROR", "تعذر تعديل جدول الدوام")
  }
}
