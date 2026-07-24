import {
  ACCESS_ROLES,
  canApproveLeave,
  canViewCompanyHr,
  hasRole,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { businessDate, localDateKey } from "@/lib/finance"
import { addDateKey, currentBusinessYear } from "@/lib/hr"
import {
  attendanceInclude,
  leaveRequestInclude,
  scheduleForUser,
  serializeAttendance,
  serializeLeaveBalance,
  serializeLeaveRequest,
  workScheduleSelect,
} from "@/lib/hr-server"
import { prisma } from "@/lib/prisma"
import HrClient from "./HrClient"

export default async function HrPage() {
  const user = await requireAuth()
  const now = new Date()
  const today = localDateKey(now, user.company.timezone)
  const year = currentBusinessYear(now, user.company.timezone)
  const attendanceStart = addDateKey(today, -13)
  const todayDate = businessDate(now, user.company.timezone)
  const canViewAll = canViewCompanyHr(user.role)
  const canApprove = hasRole(user.role, ACCESS_ROLES.leaveApproval)
  const canManageAttendance = hasRole(user.role, ACCESS_ROLES.attendanceManagement)
  const canManagePolicies = hasRole(user.role, ACCESS_ROLES.hrManagement)
  const canManageSchedules = hasRole(user.role, ACCESS_ROLES.workScheduleManagement)
  const canManageHolidays = hasRole(user.role, ACCESS_ROLES.holidayManagement)

  const [
    schedules,
    employees,
    leaveTypes,
    leaveRequests,
    balances,
    holidays,
    attendance,
    todayLeave,
    currentSchedule,
  ] = await Promise.all([
    prisma.workSchedule.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }],
      select: workScheduleSelect,
    }),
    prisma.user.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        employeeProfile: { status: { not: "TERMINATED" } },
        ...(canViewAll ? {} : { id: user.id }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employeeProfile: {
          select: {
            id: true,
            employeeNumber: true,
            status: true,
            workScheduleId: true,
            workSchedule: { select: workScheduleSelect },
            department: { select: { id: true, name: true } },
            jobRole: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.leaveType.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        annualAllowanceDays: true,
        carryoverLimitDays: true,
        isPaid: true,
        requiresApproval: true,
        isActive: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll ? {} : { userId: user.id }),
        startDate: { lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) },
        endDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`) },
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      include: leaveRequestInclude,
      take: 250,
    }),
    prisma.leaveBalance.findMany({
      where: {
        companyId: user.companyId,
        year,
        ...(canViewAll ? {} : { userId: user.id }),
      },
      orderBy: [{ user: { name: "asc" } }, { leaveType: { name: "asc" } }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
            annualAllowanceDays: true,
          },
        },
      },
    }),
    prisma.publicHoliday.findMany({
      where: {
        companyId: user.companyId,
        date: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll ? {} : { userId: user.id }),
        workDate: {
          gte: new Date(`${attendanceStart}T00:00:00.000Z`),
          lte: todayDate,
        },
      },
      orderBy: [{ workDate: "desc" }, { user: { name: "asc" } }],
      include: attendanceInclude,
      take: 500,
    }),
    prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        status: "APPROVED",
        ...(canViewAll ? {} : { userId: user.id }),
        startDate: { lte: todayDate },
        endDate: { gte: todayDate },
      },
      select: {
        userId: true,
        leaveType: { select: { name: true } },
      },
    }),
    scheduleForUser(prisma, user.companyId, user.id),
  ])

  const todayAttendance = new Map<string, (typeof attendance)[number]>(
    attendance
      .filter((record) => record.workDate.toISOString().slice(0, 10) === today)
      .map((record) => [record.userId, record]),
  )
  const todayLeaves = new Map<string, string>(
    todayLeave.map((item) => [item.userId, item.leaveType.name]),
  )
  const holidayToday = holidays.find(
    (holiday) => holiday.date.toISOString().slice(0, 10) === today,
  )

  const roster = employees.map((employee) => {
    const record = todayAttendance.get(employee.id)
    const leaveName = todayLeaves.get(employee.id) ?? null
    const schedule = employee.employeeProfile?.workSchedule ??
      schedules.find((item) => item.isDefault && item.isActive) ??
      null
    const todayStatus: NonNullable<typeof record>["status"] | "NOT_RECORDED" =
      holidayToday
        ? "HOLIDAY"
        : leaveName
          ? "ON_LEAVE"
          : record?.status ?? "NOT_RECORDED"

    return {
      ...employee,
      todayStatus,
      leaveName,
      todayRecord: record ? serializeAttendance(record) : null,
      effectiveSchedule: schedule,
    }
  })

  const todayRecords = roster.filter((item) => item.todayRecord)
  const presentToday = roster.filter((item) =>
    ["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(item.todayStatus),
  ).length
  const onLeaveToday = roster.filter((item) => item.todayStatus === "ON_LEAVE").length
  const missingToday = roster.filter((item) => item.todayStatus === "NOT_RECORDED").length
  const pendingRequests = leaveRequests.filter((item) => item.status === "PENDING").length

  return (
    <HrClient
      currentUser={{ id: user.id, name: user.name, role: user.role }}
      today={today}
      year={year}
      currentSchedule={currentSchedule}
      permissions={{
        canViewAll,
        canApprove,
        canManageAttendance,
        canManagePolicies,
        canManageSchedules,
        canManageHolidays,
        canSelfApprove: canApproveLeave(user, user.id),
      }}
      stats={{
        employees: employees.length,
        presentToday,
        onLeaveToday,
        missingToday,
        pendingRequests,
        recordedToday: todayRecords.length,
      }}
      schedules={schedules}
      employees={roster}
      leaveTypes={leaveTypes.map((type) => ({
        ...type,
        annualAllowanceDays: type.annualAllowanceDays.toString(),
        carryoverLimitDays: type.carryoverLimitDays.toString(),
      }))}
      leaveRequests={leaveRequests.map((item) => serializeLeaveRequest(item))}
      balances={balances.map((item) => serializeLeaveBalance(item))}
      holidays={holidays.map((holiday) => ({
        ...holiday,
        date: holiday.date.toISOString(),
        createdAt: holiday.createdAt.toISOString(),
        updatedAt: holiday.updatedAt.toISOString(),
      }))}
      attendance={attendance.map((record) => serializeAttendance(record))}
    />
  )
}
