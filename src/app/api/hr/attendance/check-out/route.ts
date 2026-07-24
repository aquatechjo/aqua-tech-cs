import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { attendanceMetrics } from "@/lib/hr"
import { attendanceInclude, serializeAttendance } from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        checkInAt: { not: null },
        checkOutAt: null,
      },
      orderBy: { checkInAt: "desc" },
    })
    if (!existing?.checkInAt) {
      throw new ApiError("لا يوجد حضور مفتوح لإنهائه", 409, "OPEN_ATTENDANCE_NOT_FOUND")
    }
    if (
      existing.scheduledStartMinute === null ||
      existing.scheduledEndMinute === null
    ) {
      throw new ApiError("سجل الحضور لا يحتوي بيانات جدول الدوام", 409, "ATTENDANCE_SCHEDULE_MISSING")
    }
    const now = new Date()
    const todayKey = localDateKey(now, user.company.timezone)
    const recordKey = existing.workDate.toISOString().slice(0, 10)
    if (recordKey !== todayKey) {
      throw new ApiError(
        "يوجد سجل حضور قديم مفتوح ويجب أن تصححه الإدارة يدويًا",
        409,
        "STALE_OPEN_ATTENDANCE",
      )
    }
    const metrics = attendanceMetrics({
      checkInAt: existing.checkInAt,
      checkOutAt: now,
      startMinute: existing.scheduledStartMinute,
      endMinute: existing.scheduledEndMinute,
      breakMinutes: existing.breakMinutes,
      graceMinutes: existing.graceMinutes,
      timeZone: user.company.timezone,
    })
    const meta = await getRequestMeta()
    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceRecord.update({
        where: { id: existing.id },
        data: { updatedById: user.id, checkOutAt: now, ...metrics },
        include: attendanceInclude,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.ATTENDANCE_CHECKED_OUT,
        entityType: "AttendanceRecord",
        entityId: saved.id,
        message: `تم تسجيل الانصراف بعد ${metrics.workedMinutes} دقيقة عمل`,
        metadata: { checkedOutAt: now.toISOString(), ...metrics },
        ...meta,
      })
      return saved
    })
    return ok({ record: serializeAttendance(record) })
  } catch (error) {
    return handleApiError(error, "ATTENDANCE_CHECK_OUT_ERROR", "تعذر تسجيل الانصراف")
  }
}
