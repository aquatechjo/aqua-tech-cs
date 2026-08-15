"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type Tab = "overview" | "leave" | "attendance" | "settings"
type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "REMOTE"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "HOLIDAY"
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
type LeavePortion = "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"

type Schedule = {
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
  _count?: { employeeProfiles: number }
}

type AttendanceRecord = {
  id: string
  userId: string
  workDate: string
  status: AttendanceStatus
  source: string
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  lateMinutes: number
  overtimeMinutes: number
  notes: string | null
  user?: {
    id: string
    name: string
    email: string
    employeeProfile: {
      employeeNumber: string | null
      department: { id: string; name: string } | null
      jobRole: { id: string; name: string } | null
    } | null
  }
}

type Employee = {
  id: string
  name: string
  email: string
  role: string
  employeeProfile: {
    id: string
    employeeNumber: string | null
    status: string
    workScheduleId: string | null
    workSchedule: Schedule | null
    department: { id: string; name: string } | null
    jobRole: { id: string; name: string } | null
  } | null
  todayStatus: AttendanceStatus | "NOT_RECORDED"
  leaveName: string | null
  todayRecord: AttendanceRecord | null
  effectiveSchedule: Schedule | null
}

type LeaveType = {
  id: string
  name: string
  code: string
  description: string | null
  annualAllowanceDays: string
  carryoverLimitDays: string
  isPaid: boolean
  requiresApproval: boolean
  isActive: boolean
  _count?: { requests: number; balances: number }
}

type LeaveRequest = {
  id: string
  userId: string
  leaveTypeId: string
  reviewedById: string | null
  startDate: string
  endDate: string
  startPortion: LeavePortion
  endPortion: LeavePortion
  totalDays: string
  status: LeaveStatus
  reason: string | null
  reviewNote: string | null
  submittedAt: string
  reviewedAt: string | null
  cancelledAt: string | null
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
    annualAllowanceDays: string
    requiresApproval: boolean
  }
  reviewedBy: { id: string; name: string } | null
}

type LeaveBalance = {
  id: string
  userId: string
  leaveTypeId: string
  year: number
  openingDays: string
  accruedDays: string
  adjustedDays: string
  usedDays: string
  notes: string | null
  user: { id: string; name: string; email: string }
  leaveType: {
    id: string
    name: string
    code: string
    isPaid: boolean
    annualAllowanceDays?: string
  }
}

type Holiday = {
  id: string
  name: string
  date: string
  notes: string | null
}

const attendanceLabels: Record<AttendanceStatus | "NOT_RECORDED", string> = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  ABSENT: "غائب",
  REMOTE: "عن بُعد",
  HALF_DAY: "نصف يوم",
  ON_LEAVE: "في إجازة",
  HOLIDAY: "عطلة",
  NOT_RECORDED: "لم يسجل",
}

const leaveLabels: Record<LeaveStatus, string> = {
  PENDING: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
}

const portionLabels: Record<LeavePortion, string> = {
  FULL_DAY: "يوم كامل",
  FIRST_HALF: "النصف الأول",
  SECOND_HALF: "النصف الثاني",
}

const weekDays = [
  { value: 7, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
]

function statusClass(status: AttendanceStatus | "NOT_RECORDED") {
  if (status === "PRESENT") return "text-bg-success"
  if (status === "REMOTE") return "text-bg-info"
  if (status === "LATE" || status === "HALF_DAY") return "text-bg-warning"
  if (status === "ABSENT") return "text-bg-danger"
  if (status === "ON_LEAVE" || status === "HOLIDAY") return "text-bg-primary"
  return "text-bg-secondary"
}

function leaveStatusClass(status: LeaveStatus) {
  if (status === "APPROVED") return "text-bg-success"
  if (status === "PENDING") return "text-bg-warning"
  if (status === "REJECTED") return "text-bg-danger"
  return "text-bg-secondary"
}

function dateOnly(value: string) {
  return value.slice(0, 10)
}

function dateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function clock(minutes: number) {
  const hours = Math.floor(minutes / 60) % 24
  const remainder = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}:${remainder.toString().padStart(2, "0")}`
}

function availableBalance(balance: LeaveBalance) {
  return (
    Number(balance.openingDays) +
    Number(balance.accruedDays) +
    Number(balance.adjustedDays) -
    Number(balance.usedDays)
  ).toFixed(2)
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return fallback
}

export default function HrClient({
  currentUser,
  today,
  year,
  currentSchedule,
  permissions,
  stats,
  schedules,
  employees,
  leaveTypes,
  leaveRequests,
  balances,
  holidays,
  attendance,
}: {
  currentUser: { id: string; name: string; role: string }
  today: string
  year: number
  currentSchedule: Schedule
  permissions: {
    canViewAll: boolean
    canApprove: boolean
    canManageAttendance: boolean
    canManagePolicies: boolean
    canManageSchedules: boolean
    canManageHolidays: boolean
    canSelfApprove: boolean
  }
  stats: {
    employees: number
    presentToday: number
    onLeaveToday: number
    missingToday: number
    pendingRequests: number
    recordedToday: number
  }
  schedules: Schedule[]
  employees: Employee[]
  leaveTypes: LeaveType[]
  leaveRequests: LeaveRequest[]
  balances: LeaveBalance[]
  holidays: Holiday[]
  attendance: AttendanceRecord[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [attendanceNotes, setAttendanceNotes] = useState("")
  const [remote, setRemote] = useState(false)
  const [leaveTypeId, setLeaveTypeId] = useState(
    leaveTypes.find((type) => type.isActive)?.id ?? "",
  )
  const [leaveStart, setLeaveStart] = useState(today)
  const [leaveEnd, setLeaveEnd] = useState(today)
  const [startPortion, setStartPortion] = useState<LeavePortion>("FULL_DAY")
  const [endPortion, setEndPortion] = useState<LeavePortion>("FULL_DAY")
  const [leaveReason, setLeaveReason] = useState("")

  const [attendanceUserId, setAttendanceUserId] = useState(employees[0]?.id ?? "")
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>("PRESENT")
  const [manualCheckIn, setManualCheckIn] = useState("")
  const [manualCheckOut, setManualCheckOut] = useState("")
  const [manualNotes, setManualNotes] = useState("")

  const [scheduleName, setScheduleName] = useState("")
  const [scheduleCode, setScheduleCode] = useState("")
  const [scheduleDays, setScheduleDays] = useState<number[]>([7, 1, 2, 3, 4])
  const [scheduleStart, setScheduleStart] = useState("09:00")
  const [scheduleEnd, setScheduleEnd] = useState("17:00")
  const [scheduleBreak, setScheduleBreak] = useState("60")
  const [scheduleGrace, setScheduleGrace] = useState("15")

  const [newLeaveName, setNewLeaveName] = useState("")
  const [newLeaveCode, setNewLeaveCode] = useState("")
  const [newLeaveAllowance, setNewLeaveAllowance] = useState("14")
  const [newLeaveCarryover, setNewLeaveCarryover] = useState("0")
  const [newLeavePaid, setNewLeavePaid] = useState(true)

  const [balanceUserId, setBalanceUserId] = useState(employees[0]?.id ?? "")
  const [balanceTypeId, setBalanceTypeId] = useState(leaveTypes[0]?.id ?? "")
  const [balanceOpening, setBalanceOpening] = useState("0")
  const [balanceAccrued, setBalanceAccrued] = useState("")
  const [balanceAdjusted, setBalanceAdjusted] = useState("0")
  const [balanceNotes, setBalanceNotes] = useState("")

  const [holidayName, setHolidayName] = useState("")
  const [holidayDate, setHolidayDate] = useState(today)
  const [holidayNotes, setHolidayNotes] = useState("")

  const myTodayRecord = employees.find((employee) => employee.id === currentUser.id)?.todayRecord ?? null
  const myBalances = balances.filter((balance) => balance.userId === currentUser.id)
  const ownRequests = leaveRequests.filter((request) => request.userId === currentUser.id)
  const pendingRequests = leaveRequests.filter((request) => request.status === "PENDING")
  const activeLeaveTypes = leaveTypes.filter((type) => type.isActive)

  const attendanceByDate = useMemo(
    () => [...attendance].sort((a, b) => b.workDate.localeCompare(a.workDate)),
    [attendance],
  )

  function clearMessages() {
    setError("")
    setSuccess("")
  }

  async function mutate(
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
    successMessage?: string,
  ) {
    clearMessages()
    setBusy(key)
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر تنفيذ العملية"))
        return false
      }
      if (successMessage) setSuccess(successMessage)
      router.refresh()
      return true
    } catch {
      setError("تعذر الاتصال بالخادم")
      return false
    } finally {
      setBusy("")
    }
  }

  async function checkIn() {
    await mutate(
      "check-in",
      "/api/hr/attendance/check-in",
      "POST",
      { remote, notes: attendanceNotes },
      "تم تسجيل الحضور",
    )
  }

  async function checkOut() {
    await mutate(
      "check-out",
      "/api/hr/attendance/check-out",
      "POST",
      undefined,
      "تم تسجيل الانصراف",
    )
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const done = await mutate(
      "leave-submit",
      "/api/hr/leave-requests",
      "POST",
      {
        leaveTypeId,
        startDate: leaveStart,
        endDate: leaveEnd,
        startPortion,
        endPortion,
        reason: leaveReason,
      },
      "تم تقديم طلب الإجازة",
    )
    if (done) setLeaveReason("")
  }

  async function approveLeave(id: string) {
    await mutate(`approve-${id}`, `/api/hr/leave-requests/${id}/approve`, "POST", undefined, "تم اعتماد الطلب")
  }

  async function rejectLeave(id: string) {
    const reason = window.prompt("اكتب سبب الرفض")?.trim()
    if (!reason) return
    await mutate(`reject-${id}`, `/api/hr/leave-requests/${id}/reject`, "POST", { reason }, "تم رفض الطلب")
  }

  async function cancelLeave(id: string) {
    if (!window.confirm("هل تريد إلغاء طلب الإجازة؟")) return
    await mutate(`cancel-${id}`, `/api/hr/leave-requests/${id}/cancel`, "POST", undefined, "تم إلغاء الطلب")
  }

  async function saveManualAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await mutate(
      "manual-attendance",
      "/api/hr/attendance",
      "POST",
      {
        userId: attendanceUserId,
        workDate: attendanceDate,
        status: attendanceStatus,
        checkInTime: manualCheckIn || null,
        checkOutTime: manualCheckOut || null,
        notes: manualNotes,
      },
      "تم حفظ سجل الحضور",
    )
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const done = await mutate(
      "schedule-create",
      "/api/hr/work-schedules",
      "POST",
      {
        name: scheduleName,
        code: scheduleCode,
        workingDays: scheduleDays,
        startTime: scheduleStart,
        endTime: scheduleEnd,
        breakMinutes: Number(scheduleBreak),
        graceMinutes: Number(scheduleGrace),
      },
      "تم إنشاء جدول الدوام",
    )
    if (done) {
      setScheduleName("")
      setScheduleCode("")
    }
  }

  function toggleScheduleDay(day: number) {
    setScheduleDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    )
  }

  async function updateSchedule(schedule: Schedule, patch: object, message: string) {
    await mutate(`schedule-${schedule.id}`, `/api/hr/work-schedules/${schedule.id}`, "PATCH", patch, message)
  }

  async function assignSchedule(userId: string, workScheduleId: string) {
    await mutate(
      `employee-schedule-${userId}`,
      `/api/hr/employee-schedules/${userId}`,
      "PATCH",
      { workScheduleId: workScheduleId || null },
      "تم تعديل جدول الموظف",
    )
  }

  async function createLeaveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const done = await mutate(
      "leave-type-create",
      "/api/hr/leave-types",
      "POST",
      {
        name: newLeaveName,
        code: newLeaveCode,
        annualAllowanceDays: Number(newLeaveAllowance),
        carryoverLimitDays: Number(newLeaveCarryover),
        isPaid: newLeavePaid,
        requiresApproval: true,
      },
      "تم إنشاء نوع الإجازة",
    )
    if (done) {
      setNewLeaveName("")
      setNewLeaveCode("")
    }
  }

  async function saveBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await mutate(
      "balance-save",
      "/api/hr/leave-balances",
      "PATCH",
      {
        userId: balanceUserId,
        leaveTypeId: balanceTypeId,
        year,
        openingDays: Number(balanceOpening),
        ...(balanceAccrued ? { accruedDays: Number(balanceAccrued) } : {}),
        adjustedDays: Number(balanceAdjusted),
        notes: balanceNotes,
      },
      "تم تعديل رصيد الإجازة",
    )
  }

  async function createHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const done = await mutate(
      "holiday-create",
      "/api/hr/holidays",
      "POST",
      { name: holidayName, date: holidayDate, notes: holidayNotes },
      "تمت إضافة العطلة",
    )
    if (done) {
      setHolidayName("")
      setHolidayNotes("")
    }
  }

  async function deleteHoliday(id: string) {
    if (!window.confirm("هل تريد حذف العطلة؟")) return
    await mutate(`holiday-delete-${id}`, `/api/hr/holidays/${id}`, "DELETE", undefined, "تم حذف العطلة")
  }

  return (
    <div className="aqua-compact-page aqua-hr-page">
      <AquaPageHeader
        badge="People Operations"
        title="الموارد البشرية والحضور"
        description="إدارة جداول الدوام والحضور والإجازات والأرصدة والعطل ضمن مسار واضح وقابل للتدقيق."
        brandValue="People"
      />

      <div className="aqua-people-tabs">
        {([
          ["overview", "اليوم"],
          ["leave", `الإجازات${stats.pendingRequests ? ` (${stats.pendingRequests})` : ""}`],
          ["attendance", "سجل الحضور"],
          ["settings", "السياسات والجداول"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${tab === value ? "aqua-btn-primary" : "aqua-btn-ghost"}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="alert alert-danger rounded-4 border-0">{error}</div> : null}
      {success ? <div className="alert alert-success rounded-4 border-0">{success}</div> : null}

      {tab === "overview" ? (
        <>
          <div className="row g-3 aqua-people-metrics">
            {[
              ["الموظفون النشطون", stats.employees],
              ["الحاضرون اليوم", stats.presentToday],
              ["في إجازة", stats.onLeaveToday],
              ["لم يسجلوا", stats.missingToday],
            ].map(([label, value]) => (
              <div className="col-6 col-xl-3" key={label}>
                <div className="aqua-card p-4 h-100 aqua-people-metric">
                  <div className="small aqua-muted">{label}</div>
                  <div className="display-6 fw-black aqua-text-gradient mt-2">{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4 mb-4">
            <div className="col-12 col-xl-4">
              <div className="aqua-card p-4 h-100">
                <h3 className="h5 fw-black">دوامي اليوم</h3>
                <p className="small aqua-muted">
                  {currentSchedule.name}: {clock(currentSchedule.startMinute)} - {clock(currentSchedule.endMinute)}
                </p>
                <div className="aqua-card-soft p-3 mb-3">
                  <div className="d-flex justify-content-between gap-3">
                    <span>الحالة</span>
                    <span className={`badge ${statusClass(myTodayRecord?.status ?? "NOT_RECORDED")}`}>
                      {attendanceLabels[myTodayRecord?.status ?? "NOT_RECORDED"]}
                    </span>
                  </div>
                  <div className="small aqua-muted mt-3">
                    دخول: {dateTime(myTodayRecord?.checkInAt ?? null)}
                    <br />
                    خروج: {dateTime(myTodayRecord?.checkOutAt ?? null)}
                  </div>
                </div>
                <textarea
                  className="form-control aqua-control mb-3"
                  rows={2}
                  value={attendanceNotes}
                  onChange={(event) => setAttendanceNotes(event.target.value)}
                  placeholder="ملاحظة اختيارية"
                />
                <label className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={remote}
                    onChange={(event) => setRemote(event.target.checked)}
                  />
                  <span className="form-check-label me-2">عمل عن بُعد</span>
                </label>
                <div className="d-grid gap-2">
                  {!myTodayRecord?.checkInAt ? (
                    <button
                      type="button"
                      className="btn aqua-btn-primary"
                      disabled={Boolean(busy)}
                      onClick={checkIn}
                    >
                      {busy === "check-in" ? "جارٍ التسجيل..." : "تسجيل الحضور"}
                    </button>
                  ) : !myTodayRecord.checkOutAt ? (
                    <button
                      type="button"
                      className="btn btn-danger rounded-3"
                      disabled={Boolean(busy)}
                      onClick={checkOut}
                    >
                      {busy === "check-out" ? "جارٍ التسجيل..." : "تسجيل الانصراف"}
                    </button>
                  ) : (
                    <div className="alert alert-success mb-0 rounded-4 border-0 text-center">
                      اكتمل سجل اليوم: {duration(myTodayRecord.workedMinutes)} ساعة
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-8">
              <div className="aqua-card p-4 h-100">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 className="h5 fw-black mb-1">{permissions.canViewAll ? "حالة الفريق اليوم" : "حالتي اليوم"}</h3>
                    <p className="small aqua-muted mb-0">{today}</p>
                  </div>
                  <span className="aqua-badge">{stats.recordedToday}/{stats.employees}</span>
                </div>
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>الموظف</th>
                        <th>القسم</th>
                        <th>الحالة</th>
                        <th>الدخول</th>
                        <th>الخروج</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.id}>
                          <td>
                            <div className="fw-bold">{employee.name}</div>
                            <div className="small aqua-muted">{employee.employeeProfile?.jobRole?.name ?? employee.email}</div>
                          </td>
                          <td>{employee.employeeProfile?.department?.name ?? "—"}</td>
                          <td>
                            <span className={`badge ${statusClass(employee.todayStatus)}`}>
                              {attendanceLabels[employee.todayStatus]}
                            </span>
                            {employee.leaveName ? <div className="small aqua-muted mt-1">{employee.leaveName}</div> : null}
                          </td>
                          <td dir="ltr">{dateTime(employee.todayRecord?.checkInAt ?? null)}</td>
                          <td dir="ltr">{dateTime(employee.todayRecord?.checkOutAt ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {tab === "leave" ? (
        <div className="row g-4">
          <div className="col-12 col-xl-4">
            <div className="aqua-card p-4 mb-4">
              <h3 className="h5 fw-black mb-3">طلب إجازة</h3>
              <form onSubmit={submitLeave}>
                <label className="form-label aqua-muted">نوع الإجازة</label>
                <select
                  className="form-select aqua-control mb-3"
                  required
                  value={leaveTypeId}
                  onChange={(event) => setLeaveTypeId(event.target.value)}
                >
                  {activeLeaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label aqua-muted">من</label>
                    <input type="date" min={today} className="form-control aqua-control" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label aqua-muted">إلى</label>
                    <input type="date" min={leaveStart} className="form-control aqua-control" value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} required />
                  </div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <select className="form-select aqua-control" value={startPortion} onChange={(event) => setStartPortion(event.target.value as LeavePortion)}>
                      {Object.entries(portionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <select className="form-select aqua-control" value={endPortion} onChange={(event) => setEndPortion(event.target.value as LeavePortion)}>
                      {Object.entries(portionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                </div>
                <textarea className="form-control aqua-control mb-3" rows={3} value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder="سبب أو ملاحظة" />
                <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy) || !leaveTypeId}>
                  {busy === "leave-submit" ? "جارٍ الإرسال..." : "إرسال الطلب"}
                </button>
              </form>
            </div>

            <div className="aqua-card p-4">
              <h3 className="h5 fw-black mb-3">أرصدتي لعام {year}</h3>
              {myBalances.length ? myBalances.map((balance) => (
                <div key={balance.id} className="aqua-card-soft p-3 mb-2">
                  <div className="d-flex justify-content-between gap-3">
                    <span className="fw-bold">{balance.leaveType.name}</span>
                    <span className="aqua-badge">{availableBalance(balance)} يوم</span>
                  </div>
                  <div className="small aqua-muted mt-2">مستخدم: {balance.usedDays} يوم</div>
                </div>
              )) : <div className="aqua-muted">تُنشأ الأرصدة تلقائيًا عند أول اعتماد، أو يدويًا من الإدارة.</div>}
            </div>
          </div>

          <div className="col-12 col-xl-8">
            {permissions.canApprove && pendingRequests.length ? (
              <div className="aqua-card p-4 mb-4">
                <h3 className="h5 fw-black mb-3">طلبات تحتاج قرارًا</h3>
                <div className="d-flex flex-column gap-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="aqua-card-soft p-3">
                      <div className="d-flex flex-wrap justify-content-between gap-3">
                        <div>
                          <div className="fw-bold">{request.user.name} — {request.leaveType.name}</div>
                          <div className="small aqua-muted mt-1">
                            {dateOnly(request.startDate)} إلى {dateOnly(request.endDate)} · {request.totalDays} يوم
                          </div>
                          {request.reason ? <div className="mt-2">{request.reason}</div> : null}
                        </div>
                        {(request.userId !== currentUser.id || permissions.canSelfApprove) ? (
                          <div className="d-flex gap-2 align-items-start">
                            <button type="button" className="btn btn-success btn-sm" disabled={Boolean(busy)} onClick={() => approveLeave(request.id)}>اعتماد</button>
                            <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(busy)} onClick={() => rejectLeave(request.id)}>رفض</button>
                          </div>
                        ) : (
                          <span className="small aqua-muted">بانتظار مدير آخر</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="aqua-card p-4">
              <h3 className="h5 fw-black mb-3">{permissions.canViewAll ? "طلبات الإجازة" : "طلباتي"}</h3>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr><th>الموظف</th><th>النوع</th><th>الفترة</th><th>الأيام</th><th>الحالة</th><th>الإجراء</th></tr></thead>
                  <tbody>
                    {(permissions.canViewAll ? leaveRequests : ownRequests).map((request) => (
                      <tr key={request.id}>
                        <td>{request.user.name}</td>
                        <td>{request.leaveType.name}</td>
                        <td dir="ltr">{dateOnly(request.startDate)} → {dateOnly(request.endDate)}</td>
                        <td>{request.totalDays}</td>
                        <td>
                          <span className={`badge ${leaveStatusClass(request.status)}`}>{leaveLabels[request.status]}</span>
                          {request.reviewNote ? <div className="small text-danger mt-1">{request.reviewNote}</div> : null}
                        </td>
                        <td>
                          {request.userId === currentUser.id && (request.status === "PENDING" || request.status === "APPROVED") ? (
                            <button type="button" className="btn aqua-btn-ghost btn-sm" onClick={() => cancelLeave(request.id)}>إلغاء</button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "attendance" ? (
        <div className="row g-4">
          {permissions.canManageAttendance ? (
            <div className="col-12 col-xl-4">
              <div className="aqua-card p-4">
                <h3 className="h5 fw-black mb-3">تسجيل أو تصحيح يدوي</h3>
                <form onSubmit={saveManualAttendance}>
                  <label className="form-label aqua-muted">الموظف</label>
                  <select className="form-select aqua-control mb-3" value={attendanceUserId} onChange={(event) => setAttendanceUserId(event.target.value)} required>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                  </select>
                  <div className="row g-2 mb-3">
                    <div className="col-6"><label className="form-label aqua-muted">التاريخ</label><input type="date" className="form-control aqua-control" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required /></div>
                    <div className="col-6"><label className="form-label aqua-muted">الحالة</label><select className="form-select aqua-control" value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as AttendanceStatus)}>{Object.entries(attendanceLabels).filter(([value]) => value !== "NOT_RECORDED").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6"><label className="form-label aqua-muted">الدخول</label><input type="time" className="form-control aqua-control" value={manualCheckIn} onChange={(event) => setManualCheckIn(event.target.value)} /></div>
                    <div className="col-6"><label className="form-label aqua-muted">الخروج</label><input type="time" className="form-control aqua-control" value={manualCheckOut} onChange={(event) => setManualCheckOut(event.target.value)} /></div>
                  </div>
                  <textarea className="form-control aqua-control mb-3" rows={2} value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="ملاحظة التصحيح" />
                  <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy)}>حفظ السجل</button>
                </form>
              </div>
            </div>
          ) : null}
          <div className={permissions.canManageAttendance ? "col-12 col-xl-8" : "col-12"}>
            <div className="aqua-card p-4">
              <h3 className="h5 fw-black mb-3">آخر 14 يومًا</h3>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead><tr><th>التاريخ</th><th>الموظف</th><th>الحالة</th><th>الدخول</th><th>الخروج</th><th>العمل</th><th>التأخير</th></tr></thead>
                  <tbody>
                    {attendanceByDate.map((record) => (
                      <tr key={record.id}>
                        <td dir="ltr">{dateOnly(record.workDate)}</td>
                        <td>{record.user?.name ?? currentUser.name}</td>
                        <td><span className={`badge ${statusClass(record.status)}`}>{attendanceLabels[record.status]}</span></td>
                        <td dir="ltr">{dateTime(record.checkInAt)}</td>
                        <td dir="ltr">{dateTime(record.checkOutAt)}</td>
                        <td>{duration(record.workedMinutes)}</td>
                        <td>{record.lateMinutes} د</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="d-flex flex-column gap-4">
          <div className="row g-4">
            {permissions.canManageSchedules ? (
              <div className="col-12 col-xl-4">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">إنشاء جدول دوام</h3>
                  <form onSubmit={createSchedule}>
                    <input className="form-control aqua-control mb-2" value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="اسم الجدول" required />
                    <input className="form-control aqua-control mb-3" dir="ltr" value={scheduleCode} onChange={(event) => setScheduleCode(event.target.value)} placeholder="CODE" required />
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {weekDays.map((day) => (
                        <label key={day.value} className="aqua-card-soft px-2 py-1 small">
                          <input type="checkbox" className="form-check-input ms-1" checked={scheduleDays.includes(day.value)} onChange={() => toggleScheduleDay(day.value)} />
                          {day.label}
                        </label>
                      ))}
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-6"><label className="small aqua-muted">البداية</label><input type="time" className="form-control aqua-control" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} /></div>
                      <div className="col-6"><label className="small aqua-muted">النهاية</label><input type="time" className="form-control aqua-control" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} /></div>
                    </div>
                    <div className="row g-2 mb-3">
                      <div className="col-6"><label className="small aqua-muted">الاستراحة</label><input type="number" className="form-control aqua-control" value={scheduleBreak} onChange={(event) => setScheduleBreak(event.target.value)} /></div>
                      <div className="col-6"><label className="small aqua-muted">السماح</label><input type="number" className="form-control aqua-control" value={scheduleGrace} onChange={(event) => setScheduleGrace(event.target.value)} /></div>
                    </div>
                    <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy)}>إنشاء الجدول</button>
                  </form>
                </div>
              </div>
            ) : null}
            <div className={permissions.canManageSchedules ? "col-12 col-xl-8" : "col-12"}>
              <div className="aqua-card p-4 h-100">
                <h3 className="h5 fw-black mb-3">جداول الدوام والموظفون</h3>
                <div className="row g-3 mb-4">
                  {schedules.map((schedule) => (
                    <div className="col-12 col-lg-6" key={schedule.id}>
                      <div className="aqua-card-soft p-3 h-100">
                        <div className="d-flex justify-content-between gap-3">
                          <div><div className="fw-bold">{schedule.name}</div><div className="small aqua-muted" dir="ltr">{schedule.code} · {clock(schedule.startMinute)}-{clock(schedule.endMinute)}</div></div>
                          {schedule.isDefault ? <span className="aqua-badge">افتراضي</span> : null}
                        </div>
                        <div className="small aqua-muted mt-2">{schedule.workingDays.map((day) => weekDays.find((item) => item.value === day)?.label).filter(Boolean).join("، ")}</div>
                        {permissions.canManageSchedules ? (
                          <div className="d-flex gap-2 mt-3">
                            {!schedule.isDefault ? <button type="button" className="btn aqua-btn-ghost btn-sm" onClick={() => updateSchedule(schedule, { isDefault: true, isActive: true }, "تم تعيين الجدول الافتراضي")}>جعله افتراضيًا</button> : null}
                            {!schedule.isDefault ? <button type="button" className="btn aqua-btn-ghost btn-sm" onClick={() => updateSchedule(schedule, { isActive: !schedule.isActive }, schedule.isActive ? "تم تعطيل الجدول" : "تم تفعيل الجدول")}>{schedule.isActive ? "تعطيل" : "تفعيل"}</button> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {permissions.canManageSchedules ? (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead><tr><th>الموظف</th><th>القسم</th><th>جدول الدوام</th></tr></thead>
                      <tbody>{employees.map((employee) => (
                        <tr key={employee.id}><td>{employee.name}</td><td>{employee.employeeProfile?.department?.name ?? "—"}</td><td><select className="form-select aqua-control" value={employee.employeeProfile?.workScheduleId ?? ""} onChange={(event) => assignSchedule(employee.id, event.target.value)}><option value="">الجدول الافتراضي</option>{schedules.filter((schedule) => schedule.isActive).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {permissions.canManagePolicies ? (
            <div className="row g-4">
              <div className="col-12 col-xl-4">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">نوع إجازة جديد</h3>
                  <form onSubmit={createLeaveType}>
                    <input className="form-control aqua-control mb-2" value={newLeaveName} onChange={(event) => setNewLeaveName(event.target.value)} placeholder="اسم النوع" required />
                    <input className="form-control aqua-control mb-2" dir="ltr" value={newLeaveCode} onChange={(event) => setNewLeaveCode(event.target.value)} placeholder="CODE" required />
                    <div className="row g-2 mb-3"><div className="col-6"><label className="small aqua-muted">الاستحقاق</label><input type="number" step="0.5" className="form-control aqua-control" value={newLeaveAllowance} onChange={(event) => setNewLeaveAllowance(event.target.value)} /></div><div className="col-6"><label className="small aqua-muted">الترحيل</label><input type="number" step="0.5" className="form-control aqua-control" value={newLeaveCarryover} onChange={(event) => setNewLeaveCarryover(event.target.value)} /></div></div>
                    <label className="form-check mb-3"><input type="checkbox" className="form-check-input" checked={newLeavePaid} onChange={(event) => setNewLeavePaid(event.target.checked)} /><span className="form-check-label me-2">مدفوعة</span></label>
                    <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy)}>إنشاء النوع</button>
                  </form>
                </div>
              </div>
              <div className="col-12 col-xl-8">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">سياسات الإجازة</h3>
                  <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>النوع</th><th>الرمز</th><th>الاستحقاق</th><th>مدفوعة</th><th>الحالة</th></tr></thead><tbody>{leaveTypes.map((type) => <tr key={type.id}><td>{type.name}</td><td dir="ltr">{type.code}</td><td>{type.annualAllowanceDays} يوم</td><td>{type.isPaid ? "نعم" : "لا"}</td><td><button type="button" className="btn aqua-btn-ghost btn-sm" onClick={() => mutate(`leave-type-${type.id}`, `/api/hr/leave-types/${type.id}`, "PATCH", { isActive: !type.isActive }, type.isActive ? "تم تعطيل النوع" : "تم تفعيل النوع")}>{type.isActive ? "نشط" : "معطل"}</button></td></tr>)}</tbody></table></div>
                </div>
              </div>
            </div>
          ) : null}

          {permissions.canManagePolicies ? (
            <div className="row g-4">
              <div className="col-12 col-xl-5">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">تعديل رصيد {year}</h3>
                  <form onSubmit={saveBalance}>
                    <select className="form-select aqua-control mb-2" value={balanceUserId} onChange={(event) => setBalanceUserId(event.target.value)} required>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>
                    <select className="form-select aqua-control mb-3" value={balanceTypeId} onChange={(event) => setBalanceTypeId(event.target.value)} required>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
                    <div className="row g-2 mb-2"><div className="col-4"><label className="small aqua-muted">افتتاحي</label><input type="number" step="0.5" className="form-control aqua-control" value={balanceOpening} onChange={(event) => setBalanceOpening(event.target.value)} /></div><div className="col-4"><label className="small aqua-muted">مستحق</label><input type="number" step="0.5" className="form-control aqua-control" value={balanceAccrued} onChange={(event) => setBalanceAccrued(event.target.value)} placeholder="تلقائي" /></div><div className="col-4"><label className="small aqua-muted">تسوية</label><input type="number" step="0.5" className="form-control aqua-control" value={balanceAdjusted} onChange={(event) => setBalanceAdjusted(event.target.value)} /></div></div>
                    <textarea className="form-control aqua-control mb-3" rows={2} value={balanceNotes} onChange={(event) => setBalanceNotes(event.target.value)} placeholder="سبب التسوية" />
                    <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy)}>حفظ الرصيد</button>
                  </form>
                </div>
              </div>
              <div className="col-12 col-xl-7">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">أرصدة الفريق</h3>
                  <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>الموظف</th><th>النوع</th><th>متاح</th><th>مستخدم</th></tr></thead><tbody>{balances.map((balance) => <tr key={balance.id}><td>{balance.user.name}</td><td>{balance.leaveType.name}</td><td>{availableBalance(balance)}</td><td>{balance.usedDays}</td></tr>)}</tbody></table></div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="row g-4">
            {permissions.canManageHolidays ? (
              <div className="col-12 col-xl-4">
                <div className="aqua-card p-4 h-100">
                  <h3 className="h5 fw-black mb-3">إضافة عطلة</h3>
                  <form onSubmit={createHoliday}>
                    <input className="form-control aqua-control mb-2" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="اسم العطلة" required />
                    <input type="date" className="form-control aqua-control mb-2" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} required />
                    <textarea className="form-control aqua-control mb-3" rows={2} value={holidayNotes} onChange={(event) => setHolidayNotes(event.target.value)} placeholder="ملاحظة" />
                    <button className="btn aqua-btn-primary w-100" disabled={Boolean(busy)}>إضافة العطلة</button>
                  </form>
                </div>
              </div>
            ) : null}
            <div className={permissions.canManageHolidays ? "col-12 col-xl-8" : "col-12"}>
              <div className="aqua-card p-4 h-100">
                <h3 className="h5 fw-black mb-3">عطل الشركة لعام {year}</h3>
                <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>التاريخ</th><th>العطلة</th><th>ملاحظة</th><th></th></tr></thead><tbody>{holidays.map((holiday) => <tr key={holiday.id}><td dir="ltr">{dateOnly(holiday.date)}</td><td>{holiday.name}</td><td>{holiday.notes ?? "—"}</td><td>{permissions.canManageHolidays ? <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => deleteHoliday(holiday.id)}>حذف</button> : null}</td></tr>)}</tbody></table></div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
