import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { AccessRole } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import { localDateKey } from "@/lib/finance"
import {
  calculateLeaveDays,
  currentBusinessYear,
  dateKeysBetween,
} from "@/lib/hr"
import { prisma } from "@/lib/prisma"
import { dateKeyToUtc } from "@/lib/time"

export type HrUser = {
  id: string
  companyId: string
  role: AccessRole
  company: {
    timezone: string
  }
}

export const workScheduleSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  workingDays: true,
  startMinute: true,
  endMinute: true,
  breakMinutes: true,
  graceMinutes: true,
  isDefault: true,
  isActive: true,
} satisfies Prisma.WorkScheduleSelect

export const attendanceInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      employeeProfile: {
        select: {
          employeeNumber: true,
          department: { select: { id: true, name: true } },
          jobRole: { select: { id: true, name: true } },
        },
      },
    },
  },
  updatedBy: { select: { id: true, name: true } },
  workSchedule: { select: workScheduleSelect },
} satisfies Prisma.AttendanceRecordInclude

export const leaveRequestInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      employeeProfile: {
        select: {
          employeeNumber: true,
          department: { select: { id: true, name: true } },
          jobRole: { select: { id: true, name: true } },
        },
      },
    },
  },
  leaveType: {
    select: {
      id: true,
      name: true,
      code: true,
      isPaid: true,
      annualAllowanceDays: true,
      requiresApproval: true,
    },
  },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude

export function nullableHrText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

export async function activeEmployee(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  userId: string,
) {
  const employee = await db.user.findFirst({
    where: { id: userId, companyId, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      employeeProfile: {
        select: {
          id: true,
          status: true,
          workScheduleId: true,
          workSchedule: { select: workScheduleSelect },
        },
      },
    },
  })

  if (!employee) {
    throw new ApiError("الموظف غير موجود أو غير نشط", 404, "HR_EMPLOYEE_NOT_FOUND")
  }
  if (employee.employeeProfile?.status === "TERMINATED") {
    throw new ApiError("الموظف منتهي الخدمة", 409, "HR_EMPLOYEE_TERMINATED")
  }
  return employee
}

export async function scheduleForUser(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  userId: string,
) {
  const employee = await activeEmployee(db, companyId, userId)
  if (employee.employeeProfile?.workSchedule?.isActive) {
    return employee.employeeProfile.workSchedule
  }

  const schedule = await db.workSchedule.findFirst({
    where: { companyId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: workScheduleSelect,
  })
  if (!schedule) {
    throw new ApiError(
      "لا يوجد جدول دوام نشط. أنشئ جدول دوام أولًا",
      409,
      "WORK_SCHEDULE_REQUIRED",
    )
  }
  return schedule
}

export async function holidayKeys(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  startKey: string,
  endKey: string,
) {
  const holidays = await db.publicHoliday.findMany({
    where: {
      companyId,
      date: { gte: dateKeyToUtc(startKey), lte: dateKeyToUtc(endKey) },
    },
    select: { date: true },
  })
  return holidays.map((holiday) => holiday.date.toISOString().slice(0, 10))
}

export async function calculateEmployeeLeaveDays(
  db: Prisma.TransactionClient | typeof prisma,
  {
    companyId,
    userId,
    startKey,
    endKey,
    startPortion,
    endPortion,
  }: {
    companyId: string
    userId: string
    startKey: string
    endKey: string
    startPortion: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"
    endPortion: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"
  },
) {
  const schedule = await scheduleForUser(db, companyId, userId)
  const holidays = await holidayKeys(db, companyId, startKey, endKey)
  const totalDays = calculateLeaveDays({
    startKey,
    endKey,
    startPortion,
    endPortion,
    workingDays: schedule.workingDays,
    holidayKeys: holidays,
  })
  if (totalDays <= 0) {
    throw new ApiError(
      "الفترة المحددة لا تحتوي أيام دوام",
      400,
      "LEAVE_HAS_NO_WORKING_DAYS",
    )
  }
  return { schedule, totalDays, holidays }
}

export async function ensureLeaveBalance(
  db: Prisma.TransactionClient | typeof prisma,
  {
    companyId,
    userId,
    leaveTypeId,
    year,
    annualAllowanceDays,
  }: {
    companyId: string
    userId: string
    leaveTypeId: string
    year: number
    annualAllowanceDays: number
  },
) {
  return db.leaveBalance.upsert({
    where: {
      companyId_userId_leaveTypeId_year: {
        companyId,
        userId,
        leaveTypeId,
        year,
      },
    },
    update: {},
    create: {
      companyId,
      userId,
      leaveTypeId,
      year,
      accruedDays: annualAllowanceDays,
    },
  })
}

export async function assertNoLeaveOverlap(
  db: Prisma.TransactionClient | typeof prisma,
  {
    companyId,
    userId,
    startDate,
    endDate,
    excludeId,
  }: {
    companyId: string
    userId: string
    startDate: Date
    endDate: Date
    excludeId?: string
  },
) {
  const overlapping = await db.leaveRequest.findFirst({
    where: {
      companyId,
      userId,
      status: { in: ["PENDING", "APPROVED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  })
  if (overlapping) {
    throw new ApiError(
      "يوجد طلب إجازة متداخل مع هذه الفترة",
      409,
      "LEAVE_REQUEST_OVERLAP",
    )
  }
}

export async function assertNoApprovedAttendanceConflict(
  db: Prisma.TransactionClient | typeof prisma,
  {
    companyId,
    userId,
    startKey,
    endKey,
  }: {
    companyId: string
    userId: string
    startKey: string
    endKey: string
  },
) {
  const conflict = await db.attendanceRecord.findFirst({
    where: {
      companyId,
      userId,
      workDate: { gte: dateKeyToUtc(startKey), lte: dateKeyToUtc(endKey) },
      checkInAt: { not: null },
    },
    select: { workDate: true },
  })
  if (conflict) {
    throw new ApiError(
      `يوجد حضور مسجل بتاريخ ${conflict.workDate.toISOString().slice(0, 10)}`,
      409,
      "LEAVE_ATTENDANCE_CONFLICT",
    )
  }
}

export async function leaveApprovers(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  excludeUserId: string,
) {
  return db.user.findMany({
    where: {
      companyId,
      isActive: true,
      id: { not: excludeUserId },
      role: { in: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"] },
    },
    select: { id: true },
  })
}

export function serializeAttendance(record: {
  id: string
  userId: string
  updatedById: string | null
  workScheduleId: string | null
  workDate: Date
  status: "PRESENT" | "LATE" | "ABSENT" | "REMOTE" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY"
  source: "SELF_SERVICE" | "MANUAL" | "SYSTEM"
  checkInAt: Date | null
  checkOutAt: Date | null
  scheduledStartMinute: number | null
  scheduledEndMinute: number | null
  breakMinutes: number
  graceMinutes: number
  workedMinutes: number
  lateMinutes: number
  overtimeMinutes: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
    email: string
    employeeProfile: {
      employeeNumber: string | null
      department: { id: string; name: string } | null
      jobRole: { id: string; name: string } | null
    } | null
  }
  updatedBy: { id: string; name: string } | null
  workSchedule: {
    id: string
    name: string
    code: string
    description: string | null
    workingDays: number[]
    startMinute: number
    endMinute: number
    breakMinutes: number
    graceMinutes: number
    isDefault: boolean
    isActive: boolean
  } | null
}) {
  return {
    ...record,
    workDate: record.workDate.toISOString(),
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    workSchedule: record.workSchedule,
  }
}

export function serializeLeaveRequest(request: {
  id: string
  companyId?: string
  userId: string
  leaveTypeId: string
  reviewedById: string | null
  startDate: Date
  endDate: Date
  startPortion: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"
  endPortion: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"
  totalDays: { toString(): string } | number
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reason: string | null
  reviewNote: string | null
  submittedAt: Date
  reviewedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
    email: string
    employeeProfile: {
      employeeNumber: string | null
      department: { id: string; name: string } | null
      jobRole: { id: string; name: string } | null
    } | null
  }
  leaveType: {
    id: string
    name: string
    code: string
    isPaid: boolean
    annualAllowanceDays: { toString(): string }
    requiresApproval: boolean
  }
  reviewedBy: { id: string; name: string } | null
}) {
  return {
    ...request,
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    totalDays: request.totalDays.toString(),
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    leaveType: {
      ...request.leaveType,
      annualAllowanceDays: request.leaveType.annualAllowanceDays.toString(),
    },
  }
}

export function serializeLeaveBalance(balance: {
  id: string
  companyId?: string
  userId: string
  leaveTypeId: string
  year: number
  openingDays: { toString(): string }
  accruedDays: { toString(): string }
  adjustedDays: { toString(): string }
  usedDays: { toString(): string }
  notes: string | null
  createdAt?: Date
  updatedAt?: Date
  user: { id: string; name: string; email: string }
  leaveType: {
    id: string
    name: string
    code: string
    isPaid: boolean
    annualAllowanceDays?: { toString(): string }
  }
}) {
  const { annualAllowanceDays, ...leaveType } = balance.leaveType

  return {
    ...balance,
    openingDays: balance.openingDays.toString(),
    accruedDays: balance.accruedDays.toString(),
    adjustedDays: balance.adjustedDays.toString(),
    usedDays: balance.usedDays.toString(),
    ...(balance.createdAt ? { createdAt: balance.createdAt.toISOString() } : {}),
    ...(balance.updatedAt ? { updatedAt: balance.updatedAt.toISOString() } : {}),
    leaveType: {
      ...leaveType,
      ...(annualAllowanceDays
        ? { annualAllowanceDays: annualAllowanceDays.toString() }
        : {}),
    },
  }
}

export function requestDateKeys(request: { startDate: Date; endDate: Date }) {
  return dateKeysBetween(
    request.startDate.toISOString().slice(0, 10),
    request.endDate.toISOString().slice(0, 10),
  )
}

export function requestYear(request: { startDate: Date }) {
  return Number(request.startDate.toISOString().slice(0, 4))
}

export function todayAndYear(now: Date, timeZone: string) {
  return {
    today: localDateKey(now, timeZone),
    year: currentBusinessYear(now, timeZone),
  }
}
