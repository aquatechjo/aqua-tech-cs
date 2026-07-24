import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  assertRole,
  canViewCompanyHr,
} from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { attendanceMetrics, dateKeysBetween, localDateTimeToUtc } from "@/lib/hr"
import {
  activeEmployee,
  attendanceInclude,
  nullableHrText,
  scheduleForUser,
  serializeAttendance,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

const manualSchema = z.object({
  userId: z.string().trim().min(1),
  workDate: z.string().trim(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "REMOTE", "HALF_DAY", "ON_LEAVE", "HOLIDAY"]),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const today = localDateKey(new Date(), user.company.timezone)
    const startKey = url.searchParams.get("start") || today
    const endKey = url.searchParams.get("end") || startKey
    dateKeysBetween(startKey, endKey)
    if (dateKeyToUtc(endKey).getTime() - dateKeyToUtc(startKey).getTime() > 62 * 86_400_000) {
      throw new ApiError("نطاق تقرير الحضور يتجاوز 62 يومًا", 400, "ATTENDANCE_RANGE_TOO_LONG")
    }
    const canViewAll = canViewCompanyHr(user.role)
    const requestedUserId = url.searchParams.get("userId")
    const records = await prisma.attendanceRecord.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll
          ? requestedUserId ? { userId: requestedUserId } : {}
          : { userId: user.id }),
        workDate: { gte: dateKeyToUtc(startKey), lte: dateKeyToUtc(endKey) },
      },
      orderBy: [{ workDate: "desc" }, { user: { name: "asc" } }],
      include: attendanceInclude,
    })
    return ok({ canViewAll, records: records.map((record) => serializeAttendance(record)) })
  } catch (error) {
    return handleApiError(error, "ATTENDANCE_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.attendanceManagement)
    const parsed = manualSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError("بيانات الحضور غير صحيحة", 400, "VALIDATION_ERROR", {
        details: parsed.error.flatten(),
      })
    }
    await activeEmployee(prisma, user.companyId, parsed.data.userId)
    const schedule = await scheduleForUser(prisma, user.companyId, parsed.data.userId)
    const workDate = dateKeyToUtc(parsed.data.workDate)
    const checkInAt = parsed.data.checkInTime
      ? localDateTimeToUtc(parsed.data.workDate, parsed.data.checkInTime, user.company.timezone)
      : null
    const checkOutAt = parsed.data.checkOutTime
      ? localDateTimeToUtc(parsed.data.workDate, parsed.data.checkOutTime, user.company.timezone)
      : null
    if (checkOutAt && !checkInAt) {
      throw new ApiError("وقت الحضور مطلوب عند تسجيل الانصراف", 400, "CHECK_IN_REQUIRED")
    }
    const metrics = checkInAt && checkOutAt
      ? attendanceMetrics({
          checkInAt,
          checkOutAt,
          startMinute: schedule.startMinute,
          endMinute: schedule.endMinute,
          breakMinutes: schedule.breakMinutes,
          graceMinutes: schedule.graceMinutes,
          timeZone: user.company.timezone,
        })
      : { workedMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 }
    const meta = await getRequestMeta()

    const record = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceRecord.upsert({
        where: {
          companyId_userId_workDate: {
            companyId: user.companyId,
            userId: parsed.data.userId,
            workDate,
          },
        },
        update: {
          updatedById: user.id,
          status: parsed.data.status,
          source: "MANUAL",
          checkInAt,
          checkOutAt,
          workScheduleId: schedule.id,
          scheduledStartMinute: schedule.startMinute,
          scheduledEndMinute: schedule.endMinute,
          breakMinutes: schedule.breakMinutes,
          graceMinutes: schedule.graceMinutes,
          ...metrics,
          notes: nullableHrText(parsed.data.notes),
        },
        create: {
          companyId: user.companyId,
          userId: parsed.data.userId,
          updatedById: user.id,
          workDate,
          status: parsed.data.status,
          source: "MANUAL",
          checkInAt,
          checkOutAt,
          workScheduleId: schedule.id,
          scheduledStartMinute: schedule.startMinute,
          scheduledEndMinute: schedule.endMinute,
          breakMinutes: schedule.breakMinutes,
          graceMinutes: schedule.graceMinutes,
          ...metrics,
          notes: nullableHrText(parsed.data.notes),
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
        message: `تم تحديث حضور ${saved.user.name} بتاريخ ${parsed.data.workDate}`,
        metadata: { status: saved.status, source: saved.source },
        ...meta,
      })
      return saved
    })
    return ok({ record: serializeAttendance(record) })
  } catch (error) {
    return handleApiError(error, "ATTENDANCE_POST_ERROR", "تعذر حفظ سجل الحضور")
  }
}
