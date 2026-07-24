import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { attendanceMetrics } from "@/lib/hr"
import { attendanceInclude, nullableHrText, serializeAttendance } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const patchSchema = z.object({
  status: z.enum(["PRESENT", "LATE", "ABSENT", "REMOTE", "HALF_DAY", "ON_LEAVE", "HOLIDAY"]).optional(),
  checkInAt: z.string().datetime().optional().nullable(),
  checkOutAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.attendanceManagement)
    const { id } = await params
    const existing = await prisma.attendanceRecord.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw new ApiError("سجل الحضور غير موجود", 404, "ATTENDANCE_NOT_FOUND")
    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) throw new ApiError("بيانات الحضور غير صحيحة", 400, "VALIDATION_ERROR")
    const checkInAt = parsed.data.checkInAt === undefined
      ? existing.checkInAt
      : parsed.data.checkInAt ? new Date(parsed.data.checkInAt) : null
    const checkOutAt = parsed.data.checkOutAt === undefined
      ? existing.checkOutAt
      : parsed.data.checkOutAt ? new Date(parsed.data.checkOutAt) : null
    if (checkOutAt && !checkInAt) throw new ApiError("وقت الحضور مطلوب", 400, "CHECK_IN_REQUIRED")
    const metrics = checkInAt && checkOutAt && existing.scheduledStartMinute !== null && existing.scheduledEndMinute !== null
      ? attendanceMetrics({
          checkInAt,
          checkOutAt,
          startMinute: existing.scheduledStartMinute,
          endMinute: existing.scheduledEndMinute,
          breakMinutes: existing.breakMinutes,
          graceMinutes: existing.graceMinutes,
          timeZone: user.company.timezone,
        })
      : { workedMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 }
    const meta = await getRequestMeta()
    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          updatedById: user.id,
          source: "MANUAL",
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.checkInAt !== undefined ? { checkInAt } : {}),
          ...(parsed.data.checkOutAt !== undefined ? { checkOutAt } : {}),
          ...(parsed.data.checkInAt !== undefined || parsed.data.checkOutAt !== undefined ? metrics : {}),
          ...(parsed.data.notes !== undefined ? { notes: nullableHrText(parsed.data.notes) } : {}),
        },
        include: attendanceInclude,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.ATTENDANCE_UPDATED,
        entityType: "AttendanceRecord",
        entityId: saved.id,
        message: `تم تعديل سجل حضور ${saved.user.name}`,
        metadata: { beforeStatus: existing.status, afterStatus: saved.status },
        ...meta,
      })
      return saved
    })
    return ok({ record: serializeAttendance(record) })
  } catch (error) {
    return handleApiError(error, "ATTENDANCE_PATCH_ERROR", "تعذر تعديل سجل الحضور")
  }
}
