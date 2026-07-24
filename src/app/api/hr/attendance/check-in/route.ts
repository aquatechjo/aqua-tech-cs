import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { businessDate, localDateKey } from "@/lib/finance"
import { checkInStatus } from "@/lib/hr"
import {
  attendanceInclude,
  nullableHrText,
  scheduleForUser,
  serializeAttendance,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const checkInSchema = z.object({
  remote: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const parsed = checkInSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) throw new ApiError("بيانات الحضور غير صحيحة", 400, "VALIDATION_ERROR")
    const now = new Date()
    const todayKey = localDateKey(now, user.company.timezone)
    const workDate = businessDate(now, user.company.timezone)
    const leave = await prisma.leaveRequest.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        status: "APPROVED",
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
      select: { id: true },
    })
    if (leave) {
      throw new ApiError("لديك إجازة معتمدة اليوم", 409, "APPROVED_LEAVE_BLOCKS_CHECK_IN")
    }
    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        companyId_userId_workDate: {
          companyId: user.companyId,
          userId: user.id,
          workDate,
        },
      },
      select: { id: true, checkInAt: true, checkOutAt: true },
    })
    if (existing?.checkInAt) {
      throw new ApiError("تم تسجيل حضورك اليوم بالفعل", 409, "ALREADY_CHECKED_IN")
    }
    const schedule = await scheduleForUser(prisma, user.companyId, user.id)
    const status = checkInStatus({
      now,
      timeZone: user.company.timezone,
      startMinute: schedule.startMinute,
      graceMinutes: schedule.graceMinutes,
      remote: parsed.data.remote,
    })
    const meta = await getRequestMeta()

    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceRecord.upsert({
        where: {
          companyId_userId_workDate: {
            companyId: user.companyId,
            userId: user.id,
            workDate,
          },
        },
        update: {
          updatedById: user.id,
          status,
          source: "SELF_SERVICE",
          checkInAt: now,
          checkOutAt: null,
          workScheduleId: schedule.id,
          scheduledStartMinute: schedule.startMinute,
          scheduledEndMinute: schedule.endMinute,
          breakMinutes: schedule.breakMinutes,
          graceMinutes: schedule.graceMinutes,
          workedMinutes: 0,
          lateMinutes: 0,
          overtimeMinutes: 0,
          notes: nullableHrText(parsed.data.notes),
        },
        create: {
          companyId: user.companyId,
          userId: user.id,
          updatedById: user.id,
          workDate,
          status,
          source: "SELF_SERVICE",
          checkInAt: now,
          workScheduleId: schedule.id,
          scheduledStartMinute: schedule.startMinute,
          scheduledEndMinute: schedule.endMinute,
          breakMinutes: schedule.breakMinutes,
          graceMinutes: schedule.graceMinutes,
          notes: nullableHrText(parsed.data.notes),
        },
        include: attendanceInclude,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.ATTENDANCE_CHECKED_IN,
        entityType: "AttendanceRecord",
        entityId: saved.id,
        message: `تم تسجيل الحضور بتاريخ ${todayKey}`,
        metadata: { status, remote: parsed.data.remote, checkedInAt: now.toISOString() },
        ...meta,
      })
      return saved
    })
    return ok({ record: serializeAttendance(record) })
  } catch (error) {
    return handleApiError(error, "ATTENDANCE_CHECK_IN_ERROR", "تعذر تسجيل الحضور")
  }
}
