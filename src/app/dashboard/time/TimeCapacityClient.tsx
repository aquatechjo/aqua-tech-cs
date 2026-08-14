"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import AquaDatePicker from "@/components/aqua/AquaDatePicker"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type Project = {
  id: string
  name: string
  code: string | null
  currency: string
}

type Task = {
  id: string
  title: string
  projectId: string | null
  estimatedHours: string | null
  project: {
    id: string
    name: string
    code: string | null
  } | null
}

type Entry = {
  id: string
  userId: string
  timesheetId: string
  projectId: string | null
  taskId: string | null
  workDate: string
  description: string | null
  durationMinutes: number
  billable: boolean
  hourlyCostSnapshot: string | null
  billableRateSnapshot: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
  project: Project | null
  task:
    | {
        id: string
        title: string
        estimatedHours: string | null
      }
    | null
  timesheet?: {
    id: string
    weekStart: string
    status: TimesheetStatus
    submittedAt: string | null
    approvedAt: string | null
    rejectedAt: string | null
    rejectionReason: string | null
  }
}

type TimesheetStatus = "OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED"

type Timesheet = {
  id: string
  userId: string
  approvedById: string | null
  weekStart: string
  status: TimesheetStatus
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  user: {
    id: string
    name: string
    email: string
    employeeProfile:
      | {
          workHoursPerWeek: string
          hourlyCost: string | null
          billableRate: string | null
          department: { id: string; name: string } | null
          jobRole: { id: string; name: string } | null
        }
      | null
  }
  approvedBy: { id: string; name: string } | null
  entries: Entry[]
}

type Employee = {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
  department: { id: string; name: string } | null
  jobRole: { id: string; name: string } | null
  workHoursPerWeek: string
  hourlyCost: string | null
  billableRate: string | null
  trackedMinutes: number
  billableMinutes: number
  utilizationPercent: number
  cost: number | null
  revenue: number | null
  margin: number | null
  timesheetStatus: TimesheetStatus | null
}

type ProjectSummary = {
  project: Project
  plannedHours: number
  trackedMinutes: number
  billableMinutes: number
  cost: number | null
  revenue: number | null
  margin: number | null
}

const statusLabels: Record<TimesheetStatus, string> = {
  OPEN: "مفتوح",
  SUBMITTED: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "يحتاج تعديل",
}

function statusClass(status: TimesheetStatus) {
  if (status === "APPROVED") return "text-bg-success"
  if (status === "SUBMITTED") return "text-bg-warning"
  if (status === "REJECTED") return "text-bg-danger"
  return "text-bg-secondary"
}

function durationLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${hours}:${remainder.toString().padStart(2, "0")}`
}

function decimalHours(minutes: number) {
  return (minutes / 60).toFixed(2)
}

function money(value: number | null, currency: string) {
  if (value === null) return "—"
  return `${value.toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function dateOnly(value: string) {
  return value.slice(0, 10)
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return fallback
}

export default function TimeCapacityClient({
  currentUserId,
  currency,
  today,
  serverNow,
  weekStart,
  weekEnd,
  permissions,
  activeTimer,
  projects,
  tasks,
  timesheets,
  employees,
  projectSummary,
  totals,
}: {
  currentUserId: string
  currency: string
  today: string
  serverNow: number
  weekStart: string
  weekEnd: string
  permissions: {
    canViewAll: boolean
    canApprove: boolean
    canSelfApprove: boolean
    costVisible: boolean
    canManageRates: boolean
    canManageCapacity: boolean
  }
  activeTimer: Entry | null
  projects: Project[]
  tasks: Task[]
  timesheets: Timesheet[]
  employees: Employee[]
  projectSummary: ProjectSummary[]
  totals: {
    capacityHours: number
    trackedMinutes: number
    billableMinutes: number
    utilizationPercent: number
    billableUtilizationPercent: number
    cost: number | null
    revenue: number | null
    margin: number | null
    pendingApprovals: number
  }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState("ALL")
  const [clockNow, setClockNow] = useState(serverNow)

  const [timerProjectId, setTimerProjectId] = useState("")
  const [timerTaskId, setTimerTaskId] = useState("")
  const [timerDescription, setTimerDescription] = useState("")
  const [timerBillable, setTimerBillable] = useState(true)

  const [editingId, setEditingId] = useState("")
  const [entryDate, setEntryDate] = useState(today)
  const [entryProjectId, setEntryProjectId] = useState("")
  const [entryTaskId, setEntryTaskId] = useState("")
  const [entryDescription, setEntryDescription] = useState("")
  const [entryHours, setEntryHours] = useState("1")
  const [entryBillable, setEntryBillable] = useState(true)

  const [profileDrafts, setProfileDrafts] = useState<
    Record<
      string,
      {
        workHoursPerWeek: string
        hourlyCost: string
        billableRate: string
      }
    >
  >(() =>
    Object.fromEntries(
      employees.map((employee) => [
        employee.userId,
        {
          workHoursPerWeek: employee.workHoursPerWeek,
          hourlyCost: employee.hourlyCost ?? "0",
          billableRate: employee.billableRate ?? "0",
        },
      ]),
    ),
  )

  useEffect(() => {
    if (!activeTimer?.startedAt) return

    const interval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeTimer?.startedAt])

  const timerTasks = useMemo(
    () =>
      tasks.filter(
        (task) => !timerProjectId || task.projectId === timerProjectId,
      ),
    [tasks, timerProjectId],
  )

  const entryTasks = useMemo(
    () =>
      tasks.filter(
        (task) => !entryProjectId || task.projectId === entryProjectId,
      ),
    [tasks, entryProjectId],
  )

  const visibleTimesheets = useMemo(
    () =>
      selectedEmployee === "ALL"
        ? timesheets
        : timesheets.filter(
            (timesheet) => timesheet.userId === selectedEmployee,
          ),
    [selectedEmployee, timesheets],
  )

  const visibleEmployees = useMemo(
    () =>
      selectedEmployee === "ALL"
        ? employees
        : employees.filter(
            (employee) => employee.userId === selectedEmployee,
          ),
    [employees, selectedEmployee],
  )

  function clearMessages() {
    setError("")
    setSuccess("")
  }

  function resetEntryForm() {
    setEditingId("")
    setEntryDate(today)
    setEntryProjectId("")
    setEntryTaskId("")
    setEntryDescription("")
    setEntryHours("1")
    setEntryBillable(true)
  }

  function chooseTimerProject(value: string) {
    setTimerProjectId(value)
    if (
      timerTaskId &&
      tasks.find((task) => task.id === timerTaskId)?.projectId !== value
    ) {
      setTimerTaskId("")
    }
  }

  function chooseEntryProject(value: string) {
    setEntryProjectId(value)
    if (
      entryTaskId &&
      tasks.find((task) => task.id === entryTaskId)?.projectId !== value
    ) {
      setEntryTaskId("")
    }
  }

  function chooseTimerTask(value: string) {
    setTimerTaskId(value)
    const task = tasks.find((item) => item.id === value)
    if (task?.projectId) setTimerProjectId(task.projectId)
  }

  function chooseEntryTask(value: string) {
    setEntryTaskId(value)
    const task = tasks.find((item) => item.id === value)
    if (task?.projectId) setEntryProjectId(task.projectId)
  }

  async function startTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()
    setBusy("timer-start")

    try {
      const response = await fetch("/api/time/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: timerProjectId || null,
          taskId: timerTaskId || null,
          description: timerDescription,
          billable: timerBillable,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر بدء المؤقت"))
        return
      }

      setTimerDescription("")
      setSuccess("تم بدء مؤقت العمل")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function stopTimer() {
    clearMessages()
    setBusy("timer-stop")

    try {
      const response = await fetch("/api/time/timer/stop", {
        method: "POST",
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر إيقاف المؤقت"))
        return
      }

      setSuccess("تم إيقاف المؤقت وتسجيل المدة")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearMessages()

    const hours = Number(entryHours)
    const durationMinutes = Math.round(hours * 60)
    if (!Number.isFinite(hours) || durationMinutes <= 0) {
      setError("أدخل عدد ساعات صحيحًا")
      return
    }

    const key = editingId ? `entry-update-${editingId}` : "entry-create"
    setBusy(key)

    try {
      const response = await fetch(
        editingId ? `/api/time/entries/${editingId}` : "/api/time/entries",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workDate: entryDate,
            durationMinutes,
            projectId: entryProjectId || null,
            taskId: entryTaskId || null,
            description: entryDescription,
            billable: entryBillable,
          }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر حفظ سجل الوقت"))
        return
      }

      setSuccess(editingId ? "تم تحديث سجل الوقت" : "تم تسجيل ساعات العمل")
      resetEntryForm()
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  function editEntry(entry: Entry) {
    setEditingId(entry.id)
    setEntryDate(dateOnly(entry.workDate))
    setEntryProjectId(entry.projectId ?? "")
    setEntryTaskId(entry.taskId ?? "")
    setEntryDescription(entry.description ?? "")
    setEntryHours(decimalHours(entry.durationMinutes))
    setEntryBillable(entry.billable)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteEntry(entry: Entry) {
    if (!window.confirm("هل تريد حذف سجل الساعات؟")) return
    clearMessages()
    setBusy(`entry-delete-${entry.id}`)

    try {
      const response = await fetch(`/api/time/entries/${entry.id}`, {
        method: "DELETE",
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر حذف سجل الوقت"))
        return
      }

      setSuccess("تم حذف سجل الوقت")
      if (editingId === entry.id) resetEntryForm()
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function submitTimesheet(timesheet: Timesheet) {
    if (!window.confirm("إرسال سجل الساعات للاعتماد؟ بعد الإرسال سيتوقف التعديل.")) {
      return
    }
    await timesheetAction(timesheet, "submit")
  }

  async function approveTimesheet(timesheet: Timesheet) {
    if (!window.confirm(`اعتماد سجل ساعات ${timesheet.user.name}؟`)) return
    await timesheetAction(timesheet, "approve")
  }

  async function rejectTimesheet(timesheet: Timesheet) {
    const reason = window.prompt("اكتب سبب الرفض والتعديل المطلوب")
    if (!reason?.trim()) return
    await timesheetAction(timesheet, "reject", { reason: reason.trim() })
  }

  async function timesheetAction(
    timesheet: Timesheet,
    action: "submit" | "approve" | "reject",
    body?: Record<string, unknown>,
  ) {
    clearMessages()
    setBusy(`${action}-${timesheet.id}`)

    try {
      const response = await fetch(
        `/api/time/timesheets/${timesheet.id}/${action}`,
        {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر تحديث سجل الساعات"))
        return
      }

      setSuccess(
        action === "submit"
          ? "تم إرسال سجل الساعات"
          : action === "approve"
            ? "تم اعتماد سجل الساعات"
            : "تم رفض السجل وإعادته للتعديل",
      )
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function saveProfile(employee: Employee) {
    clearMessages()
    setBusy(`profile-${employee.userId}`)
    const draft = profileDrafts[employee.userId]

    try {
      const response = await fetch(`/api/time/profiles/${employee.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(permissions.canManageCapacity
            ? { workHoursPerWeek: draft.workHoursPerWeek }
            : {}),
          ...(permissions.canManageRates
            ? {
                hourlyCost: draft.hourlyCost,
                billableRate: draft.billableRate,
              }
            : {}),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(errorMessage(payload, "تعذر تحديث إعدادات الوقت"))
        return
      }

      setSuccess(`تم تحديث إعدادات ${employee.user.name}`)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  const elapsedSeconds = activeTimer?.startedAt
    ? Math.max(
        0,
        Math.floor(
          (clockNow - new Date(activeTimer.startedAt).getTime()) / 1000,
        ),
      )
    : 0
  const elapsedLabel = durationLabel(Math.floor(elapsedSeconds / 60))
  const currentWeekStart = weekStart.slice(0, 10)
  const currentWeekEnd = addDays(weekEnd, -1)
  const previousWeek = addDays(weekStart, -7)
  const nextWeek = addDays(weekStart, 7)

  return (
    <div className="aqua-time-page">
      <AquaPageHeader
        badge="Time & Capacity"
        title="الوقت والطاقة التشغيلية"
        description="سجّل الجهد الفعلي، اعتمد السجلات الأسبوعية، وقارن الطاقة المخططة بالتنفيذ وربحية الوقت."
        brandValue="Utilization"
      />

      <div className="aqua-card p-3 aqua-time-week-nav">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="small aqua-muted">الأسبوع التشغيلي</div>
            <div className="fw-bold mt-1" dir="ltr">
              {currentWeekStart} → {currentWeekEnd}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link
              className="btn btn-outline-info"
              href={`/dashboard/time?weekStart=${previousWeek}`}
            >
              الأسبوع السابق
            </Link>
            <Link className="btn btn-outline-light" href="/dashboard/time">
              الأسبوع الحالي
            </Link>
            <Link
              className="btn btn-outline-info"
              href={`/dashboard/time?weekStart=${nextWeek}`}
            >
              الأسبوع التالي
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
      {success ? <div className="alert alert-success mb-0">{success}</div> : null}

      <div className="row g-3 aqua-workforce-metrics">
        {[
          {
            label: "الساعات المسجلة",
            value: durationLabel(totals.trackedMinutes),
            hint: `${totals.capacityHours.toFixed(1)} ساعة طاقة`,
          },
          {
            label: "الساعات القابلة للفوترة",
            value: durationLabel(totals.billableMinutes),
            hint: `${totals.billableUtilizationPercent.toFixed(1)}% من الطاقة`,
          },
          {
            label: "نسبة الاستغلال",
            value: `${totals.utilizationPercent.toFixed(1)}%`,
            hint: "Actual / Capacity",
          },
          {
            label: permissions.canApprove
              ? "بانتظار الاعتماد"
              : "حالة أسبوعي",
            value: permissions.canApprove
              ? totals.pendingApprovals.toString()
              : (statusLabels[
                  timesheets.find(
                    (timesheet) => timesheet.userId === currentUserId,
                  )?.status ?? "OPEN"
                ] ?? "مفتوح"),
            hint: permissions.canApprove ? "Submitted sheets" : "Weekly status",
          },
        ].map((card) => (
          <div className="col-12 col-md-6 col-xl-3" key={card.label}>
            <div className="aqua-card p-4 h-100 aqua-workforce-metric">
              <div className="small aqua-muted">{card.label}</div>
              <div className="display-6 fw-black aqua-text-gradient mt-2">
                {card.value}
              </div>
              <div className="small aqua-soft mt-2" dir="ltr">
                {card.hint}
              </div>
            </div>
          </div>
        ))}
      </div>

      {permissions.costVisible ? (
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="aqua-card-soft p-4 h-100">
              <div className="small aqua-muted">تكلفة الجهد</div>
              <div className="h3 fw-black mt-2 mb-0">
                {money(totals.cost, currency)}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="aqua-card-soft p-4 h-100">
              <div className="small aqua-muted">قيمة الوقت القابل للفوترة</div>
              <div className="h3 fw-black mt-2 mb-0">
                {money(totals.revenue, currency)}
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="aqua-card-soft p-4 h-100">
              <div className="small aqua-muted">هامش الوقت</div>
              <div className="h3 fw-black mt-2 mb-0">
                {money(totals.margin, currency)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="row g-4 align-items-start aqua-time-entry-grid">
        <div className="col-12 col-xl-5">
          <div className="aqua-card p-4">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 fw-black mb-1">مؤقت العمل</h2>
                <p className="small aqua-muted mb-0">
                  مؤقت نشط واحد لكل مستخدم.
                </p>
              </div>
              <span className="aqua-badge">
                {activeTimer ? "Running" : "Ready"}
              </span>
            </div>

            {activeTimer ? (
              <div className="aqua-card-soft p-4">
                <div className="small aqua-muted">المدة الحالية</div>
                <div className="display-5 fw-black aqua-text-gradient my-3" dir="ltr">
                  {elapsedLabel}
                </div>
                <div className="fw-bold">
                  {activeTimer.task?.title ??
                    activeTimer.project?.name ??
                    activeTimer.description ??
                    "عمل داخلي"}
                </div>
                <div className="small aqua-muted mt-2">
                  {activeTimer.project?.name ?? "بدون مشروع"} ·{" "}
                  {activeTimer.billable ? "قابل للفوترة" : "داخلي"}
                </div>
                <div className="d-grid gap-2 mt-4">
                  <button
                    className="btn btn-danger fw-bold"
                    disabled={busy === "timer-stop"}
                    onClick={stopTimer}
                    type="button"
                  >
                    {busy === "timer-stop" ? "جارٍ الإيقاف..." : "إيقاف وتسجيل"}
                  </button>
                  <button
                    className="btn btn-outline-light"
                    disabled={busy === `entry-delete-${activeTimer.id}`}
                    onClick={() => deleteEntry(activeTimer)}
                    type="button"
                  >
                    {busy === `entry-delete-${activeTimer.id}`
                      ? "جارٍ الإلغاء..."
                      : "إلغاء المؤقت دون تسجيل"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={startTimer}>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">المشروع</label>
                    <select
                      className="form-select"
                      value={timerProjectId}
                      onChange={(event) =>
                        chooseTimerProject(event.target.value)
                      }
                    >
                      <option value="">عمل داخلي بدون مشروع</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                          {project.code ? ` — ${project.code}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">المهمة</label>
                    <select
                      className="form-select"
                      value={timerTaskId}
                      onChange={(event) => chooseTimerTask(event.target.value)}
                    >
                      <option value="">بدون مهمة محددة</option>
                      {timerTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.project ? `${task.project.name} — ` : ""}
                          {task.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">وصف مختصر</label>
                    <input
                      className="form-control"
                      maxLength={1000}
                      value={timerDescription}
                      onChange={(event) =>
                        setTimerDescription(event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="form-check mt-3">
                  <input
                    className="form-check-input"
                    id="timerBillable"
                    type="checkbox"
                    checked={timerBillable}
                    onChange={(event) => setTimerBillable(event.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="timerBillable">
                    وقت قابل للفوترة
                  </label>
                </div>
                <button
                  className="btn btn-info fw-bold w-100 mt-4"
                  disabled={busy === "timer-start"}
                  type="submit"
                >
                  {busy === "timer-start" ? "جارٍ البدء..." : "بدء المؤقت"}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <form className="aqua-card p-4" onSubmit={saveEntry}>
            <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 fw-black mb-1">
                  {editingId ? "تعديل سجل الوقت" : "إدخال وقت يدوي"}
                </h2>
                <p className="small aqua-muted mb-0">
                  السجلات المرسلة أو المعتمدة لا تقبل التعديل.
                </p>
              </div>
              {editingId ? (
                <button
                  className="btn btn-sm btn-outline-light"
                  type="button"
                  onClick={resetEntryForm}
                >
                  إلغاء التعديل
                </button>
              ) : null}
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label">التاريخ</label>
                <AquaDatePicker
                  value={entryDate}
                  onChange={setEntryDate}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">عدد الساعات</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.02"
                  max="24"
                  step="0.25"
                  dir="ltr"
                  required
                  value={entryHours}
                  onChange={(event) => setEntryHours(event.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">المشروع</label>
                <select
                  className="form-select"
                  value={entryProjectId}
                  onChange={(event) => chooseEntryProject(event.target.value)}
                >
                  <option value="">عمل داخلي بدون مشروع</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.code ? ` — ${project.code}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">المهمة</label>
                <select
                  className="form-select"
                  value={entryTaskId}
                  onChange={(event) => chooseEntryTask(event.target.value)}
                >
                  <option value="">بدون مهمة محددة</option>
                  {entryTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.project ? `${task.project.name} — ` : ""}
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">الوصف</label>
                <textarea
                  className="form-control"
                  rows={3}
                  maxLength={1000}
                  value={entryDescription}
                  onChange={(event) =>
                    setEntryDescription(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="form-check mt-3">
              <input
                className="form-check-input"
                id="entryBillable"
                type="checkbox"
                checked={entryBillable}
                onChange={(event) => setEntryBillable(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="entryBillable">
                وقت قابل للفوترة
              </label>
            </div>

            <button
              className="btn btn-info fw-bold mt-4"
              disabled={busy.startsWith("entry-")}
              type="submit"
            >
              {busy.startsWith("entry-")
                ? "جارٍ الحفظ..."
                : editingId
                  ? "حفظ التعديل"
                  : "تسجيل الوقت"}
            </button>
          </form>
        </div>
      </div>

      <div className="aqua-card p-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h5 fw-black mb-1">الطاقة والاستغلال</h2>
            <p className="small aqua-muted mb-0">
              مقارنة الساعات المسجلة بالطاقة الأسبوعية لكل موظف.
            </p>
          </div>
          {permissions.canViewAll ? (
            <select
              className="form-select"
              style={{ maxWidth: 280 }}
              value={selectedEmployee}
              onChange={(event) => setSelectedEmployee(event.target.value)}
            >
              <option value="ALL">كل الموظفين</option>
              {employees.map((employee) => (
                <option key={employee.userId} value={employee.userId}>
                  {employee.user.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الدور</th>
                <th>الطاقة</th>
                <th>المسجل</th>
                <th>قابل للفوترة</th>
                <th>الاستغلال</th>
                <th>الحالة</th>
                {permissions.costVisible ? <th>الهامش</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map((employee) => (
                <tr key={employee.userId}>
                  <td>
                    <div className="fw-bold">{employee.user.name}</div>
                    <div className="small aqua-muted" dir="ltr">
                      {employee.user.email}
                    </div>
                  </td>
                  <td>
                    {employee.jobRole?.name ??
                      employee.department?.name ??
                      "—"}
                  </td>
                  <td dir="ltr">{employee.workHoursPerWeek}h</td>
                  <td dir="ltr">{durationLabel(employee.trackedMinutes)}</td>
                  <td dir="ltr">{durationLabel(employee.billableMinutes)}</td>
                  <td style={{ minWidth: 180 }}>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1" style={{ height: 8 }}>
                        <div
                          className="progress-bar"
                          style={{
                            width: `${Math.min(
                              100,
                              employee.utilizationPercent,
                            )}%`,
                          }}
                        />
                      </div>
                      <span dir="ltr">
                        {employee.utilizationPercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    {employee.timesheetStatus ? (
                      <span
                        className={`badge ${statusClass(
                          employee.timesheetStatus,
                        )}`}
                      >
                        {statusLabels[employee.timesheetStatus]}
                      </span>
                    ) : (
                      <span className="badge text-bg-secondary">
                        بدون سجل
                      </span>
                    )}
                  </td>
                  {permissions.costVisible ? (
                    <td>{money(employee.margin, currency)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="d-flex flex-column gap-3">
        <div>
          <h2 className="h5 fw-black mb-1">سجلات الأسبوع</h2>
          <p className="small aqua-muted mb-0">
            تفاصيل الوقت ومسار الإرسال والاعتماد.
          </p>
        </div>

        {visibleTimesheets.length === 0 ? (
          <div className="aqua-card p-5 text-center aqua-muted">
            لا توجد سجلات ساعات لهذا الأسبوع.
          </div>
        ) : (
          visibleTimesheets.map((timesheet) => {
            const totalMinutes = timesheet.entries.reduce(
              (sum, entry) => sum + entry.durationMinutes,
              0,
            )
            const billableMinutes = timesheet.entries.reduce(
              (sum, entry) =>
                sum + (entry.billable ? entry.durationMinutes : 0),
              0,
            )
            const editable =
              timesheet.userId === currentUserId &&
              (timesheet.status === "OPEN" ||
                timesheet.status === "REJECTED")

            return (
              <div className="aqua-card p-4" key={timesheet.id}>
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <h3 className="h5 fw-black mb-0">
                        {timesheet.user.name}
                      </h3>
                      <span
                        className={`badge ${statusClass(timesheet.status)}`}
                      >
                        {statusLabels[timesheet.status]}
                      </span>
                    </div>
                    <div className="small aqua-muted mt-2">
                      {durationLabel(totalMinutes)} إجمالي ·{" "}
                      {durationLabel(billableMinutes)} قابل للفوترة
                    </div>
                    {timesheet.rejectionReason ? (
                      <div className="alert alert-warning py-2 px-3 mt-3 mb-0">
                        {timesheet.rejectionReason}
                      </div>
                    ) : null}
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    {editable && timesheet.entries.length > 0 ? (
                      <button
                        className="btn btn-info fw-bold"
                        disabled={busy === `submit-${timesheet.id}`}
                        onClick={() => submitTimesheet(timesheet)}
                        type="button"
                      >
                        {busy === `submit-${timesheet.id}`
                          ? "جارٍ الإرسال..."
                          : timesheet.status === "REJECTED"
                            ? "إعادة الإرسال"
                            : "إرسال للاعتماد"}
                      </button>
                    ) : null}
                    {permissions.canApprove &&
                    timesheet.status === "SUBMITTED" &&
                    (timesheet.userId !== currentUserId ||
                      permissions.canSelfApprove) ? (
                      <>
                        <button
                          className="btn btn-success fw-bold"
                          disabled={busy === `approve-${timesheet.id}`}
                          onClick={() => approveTimesheet(timesheet)}
                          type="button"
                        >
                          اعتماد
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          disabled={busy === `reject-${timesheet.id}`}
                          onClick={() => rejectTimesheet(timesheet)}
                          type="button"
                        >
                          رفض
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>المشروع / المهمة</th>
                        <th>الوصف</th>
                        <th>المدة</th>
                        <th>النوع</th>
                        {editable ? <th>إجراءات</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {timesheet.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td dir="ltr">{dateOnly(entry.workDate)}</td>
                          <td>
                            <div className="fw-bold">
                              {entry.task?.title ??
                                entry.project?.name ??
                                "عمل داخلي"}
                            </div>
                            {entry.task && entry.project ? (
                              <div className="small aqua-muted">
                                {entry.project.name}
                              </div>
                            ) : null}
                          </td>
                          <td>{entry.description || "—"}</td>
                          <td dir="ltr">
                            {entry.startedAt && !entry.endedAt
                              ? "Running"
                              : durationLabel(entry.durationMinutes)}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                entry.billable
                                  ? "text-bg-info"
                                  : "text-bg-secondary"
                              }`}
                            >
                              {entry.billable ? "قابل للفوترة" : "داخلي"}
                            </span>
                          </td>
                          {editable ? (
                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                <button
                                  className="btn btn-sm btn-outline-info"
                                  disabled={Boolean(
                                    entry.startedAt && !entry.endedAt,
                                  )}
                                  onClick={() => editEntry(entry)}
                                  type="button"
                                >
                                  تعديل
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={
                                    busy === `entry-delete-${entry.id}`
                                  }
                                  onClick={() => deleteEntry(entry)}
                                  type="button"
                                >
                                  حذف
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {timesheet.approvedBy ? (
                  <div className="small aqua-muted mt-3">
                    اعتمد بواسطة {timesheet.approvedBy.name}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <div className="aqua-card p-4">
        <div className="mb-4">
          <h2 className="h5 fw-black mb-1">جهد المشاريع</h2>
          <p className="small aqua-muted mb-0">
            الساعات الفعلية مقابل تقديرات المهام والقيمة التشغيلية.
          </p>
        </div>

        {projectSummary.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-muted">
            لا توجد ساعات مرتبطة بمشاريع في هذا الأسبوع.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th>تقدير المهام</th>
                  <th>الساعات الفعلية</th>
                  <th>القابلة للفوترة</th>
                  <th>الفارق</th>
                  {permissions.costVisible ? (
                    <>
                      <th>التكلفة</th>
                      <th>القيمة</th>
                      <th>الهامش</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {projectSummary.map((row) => {
                  const actualHours = row.trackedMinutes / 60
                  return (
                    <tr key={row.project.id}>
                      <td>
                        <Link
                          className="fw-bold text-info text-decoration-none"
                          href={`/dashboard/projects/${row.project.id}`}
                        >
                          {row.project.name}
                        </Link>
                        {row.project.code ? (
                          <div className="small aqua-muted" dir="ltr">
                            {row.project.code}
                          </div>
                        ) : null}
                      </td>
                      <td dir="ltr">{row.plannedHours.toFixed(2)}h</td>
                      <td dir="ltr">{durationLabel(row.trackedMinutes)}</td>
                      <td dir="ltr">{durationLabel(row.billableMinutes)}</td>
                      <td
                        className={
                          actualHours > row.plannedHours &&
                          row.plannedHours > 0
                            ? "text-danger"
                            : ""
                        }
                        dir="ltr"
                      >
                        {row.plannedHours > 0
                          ? `${(actualHours - row.plannedHours).toFixed(2)}h`
                          : "—"}
                      </td>
                      {permissions.costVisible ? (
                        <>
                          <td>{money(row.cost, currency)}</td>
                          <td>{money(row.revenue, currency)}</td>
                          <td>{money(row.margin, currency)}</td>
                        </>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {permissions.canManageCapacity || permissions.canManageRates ? (
        <div className="aqua-card p-4">
          <div className="mb-4">
            <h2 className="h5 fw-black mb-1">إعدادات الطاقة والتسعير</h2>
            <p className="small aqua-muted mb-0">
              التغييرات الجديدة تؤثر على السجلات اللاحقة؛ السجلات الحالية تحتفظ
              بنسخة التكلفة والسعر وقت التسجيل.
            </p>
          </div>

          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>الموظف</th>
                  {permissions.canManageCapacity ? (
                    <th>ساعات الأسبوع</th>
                  ) : null}
                  {permissions.canManageRates ? (
                    <>
                      <th>تكلفة الساعة</th>
                      <th>سعر البيع</th>
                    </>
                  ) : null}
                  <th>حفظ</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const draft = profileDrafts[employee.userId]
                  return (
                    <tr key={employee.userId}>
                      <td>
                        <div className="fw-bold">{employee.user.name}</div>
                        <div className="small aqua-muted">
                          {employee.jobRole?.name ?? "—"}
                        </div>
                      </td>
                      {permissions.canManageCapacity ? (
                        <td style={{ minWidth: 150 }}>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            max="168"
                            step="0.5"
                            dir="ltr"
                            value={draft.workHoursPerWeek}
                            onChange={(event) =>
                              setProfileDrafts((current) => ({
                                ...current,
                                [employee.userId]: {
                                  ...current[employee.userId],
                                  workHoursPerWeek: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      ) : null}
                      {permissions.canManageRates ? (
                        <>
                          <td style={{ minWidth: 160 }}>
                            <div className="input-group">
                              <input
                                className="form-control"
                                type="number"
                                min="0"
                                step="0.01"
                                dir="ltr"
                                value={draft.hourlyCost}
                                onChange={(event) =>
                                  setProfileDrafts((current) => ({
                                    ...current,
                                    [employee.userId]: {
                                      ...current[employee.userId],
                                      hourlyCost: event.target.value,
                                    },
                                  }))
                                }
                              />
                              <span className="input-group-text">
                                {currency}
                              </span>
                            </div>
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <div className="input-group">
                              <input
                                className="form-control"
                                type="number"
                                min="0"
                                step="0.01"
                                dir="ltr"
                                value={draft.billableRate}
                                onChange={(event) =>
                                  setProfileDrafts((current) => ({
                                    ...current,
                                    [employee.userId]: {
                                      ...current[employee.userId],
                                      billableRate: event.target.value,
                                    },
                                  }))
                                }
                              />
                              <span className="input-group-text">
                                {currency}
                              </span>
                            </div>
                          </td>
                        </>
                      ) : null}
                      <td>
                        <button
                          className="btn btn-sm btn-info fw-bold"
                          disabled={busy === `profile-${employee.userId}`}
                          onClick={() => saveProfile(employee)}
                          type="button"
                        >
                          {busy === `profile-${employee.userId}`
                            ? "جارٍ..."
                            : "حفظ"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
