"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type Employee = {
  id: string
  employeeNumber: string | null
  user: { id: string; name: string; email: string }
  department: { id: string; name: string } | null
  jobRole: { id: string; name: string } | null
}

type Member = {
  id: string
  role: "PROJECT_LEAD" | "MANAGER" | "CONTRIBUTOR" | "VIEWER"
  responsibility: string | null
  employeeProfile: Employee & { user: Employee["user"] & { isActive: boolean } }
}

type Phase = {
  id: string
  name: string
  code: string | null
  description: string | null
  status: "PLANNED" | "ACTIVE" | "BLOCKED" | "COMPLETED" | "CANCELLED"
  progress: number
  sortOrder: number
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
}

type Participant = {
  id: string
  role: "OWNER" | "CONTRIBUTOR" | "REVIEWER" | "OBSERVER"
  employeeProfile: {
    id: string
    user: { id: string; name: string; email: string }
    jobRole: { name: string } | null
  }
}

type Task = {
  id: string
  title: string
  description: string | null
  phaseId: string | null
  phase: { id: string; name: string } | null
  assignedToId: string | null
  assignedTo: { id: string; name: string; email: string } | null
  status:
    | "TODO"
    | "IN_PROGRESS"
    | "BLOCKED"
    | "REVIEW"
    | "DONE"
    | "CANCELLED"
    | "ARCHIVED"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  progress: number
  estimatedHours: string | null
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
  canEdit: boolean
  canManageParticipants: boolean
  canAssignOwner: boolean
  participants: Participant[]
  dependencies: Array<{
    id: string
    type: "FINISH_TO_START" | "START_TO_START" | "FINISH_TO_FINISH" | "START_TO_FINISH"
    dependsOnTaskId: string
    dependsOnTask: { id: string; title: string; status: string; progress: number }
  }>
  blockers: Array<{
    id: string
    title: string
    description: string | null
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    status: "OPEN" | "RESOLVED" | "DISMISSED"
    resolution: string | null
    reportedBy: { id: string; name: string } | null
    resolvedBy: { id: string; name: string } | null
    resolvedAt: string | null
    createdAt: string
  }>
}

type PhaseDraft = Pick<Phase, "status" | "progress">
type TaskDraft = Pick<Task, "phaseId" | "status" | "progress">

const memberRoleLabels: Record<Member["role"], string> = {
  PROJECT_LEAD: "قائد المشروع",
  MANAGER: "مدير تنفيذ",
  CONTRIBUTOR: "مساهم",
  VIEWER: "متابع",
}

const phaseStatusLabels: Record<Phase["status"], string> = {
  PLANNED: "مخططة",
  ACTIVE: "نشطة",
  BLOCKED: "متعطلة",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
}

const taskStatusLabels: Record<Task["status"], string> = {
  TODO: "للعمل",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متعطلة",
  REVIEW: "للمراجعة",
  DONE: "مكتملة",
  CANCELLED: "ملغاة",
  ARCHIVED: "مؤرشفة",
}

const participantRoleLabels: Record<Participant["role"], string> = {
  OWNER: "مسؤول رئيسي",
  CONTRIBUTOR: "مشارك",
  REVIEWER: "مراجع",
  OBSERVER: "متابع",
}

const dependencyTypeLabels = {
  FINISH_TO_START: "إنهاء السابقة قبل البدء",
  START_TO_START: "بدء متزامن",
  FINISH_TO_FINISH: "إنهاء متزامن",
  START_TO_FINISH: "بدء السابقة قبل الإنهاء",
} as const

const blockerSeverityLabels = {
  LOW: "منخفض",
  MEDIUM: "متوسط",
  HIGH: "عالٍ",
  CRITICAL: "حرج",
} as const

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "—"
}

function projectStatusLabel(status: string) {
  return (
    {
      PLANNING: "تخطيط",
      IN_PROGRESS: "قيد التنفيذ",
      ON_HOLD: "معلّق",
      COMPLETED: "مكتمل",
      CANCELLED: "ملغي",
      ARCHIVED: "مؤرشف",
    }[status] ?? status
  )
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return fallback
}

export default function ProjectExecutionClient({
  project,
  members,
  phases,
  tasks,
  employees,
  canManage,
  canManageLeadership,
  summary,
}: {
  project: {
    id: string
    name: string
    code: string | null
    description: string | null
    status: string
    priority: string
    client: { id: string; name: string } | null
    startDate: string | null
    dueDate: string | null
  }
  members: Member[]
  phases: Phase[]
  tasks: Task[]
  employees: Employee[]
  canManage: boolean
  canManageLeadership: boolean
  summary: {
    progress: number
    totalTasks: number
    completedTasks: number
    blockedTasks: number
    openBlockers: number
  }
}) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? "")
  const [resolutionByBlocker, setResolutionByBlocker] = useState<Record<string, string>>({})

  const [phaseDrafts, setPhaseDrafts] = useState<Record<string, PhaseDraft>>({})
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({})

  const effectiveSelectedTaskId =
    selectedTaskId && tasks.some((task) => task.id === selectedTaskId)
      ? selectedTaskId
      : (tasks[0]?.id ?? "")

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === effectiveSelectedTaskId) ?? null,
    [effectiveSelectedTaskId, tasks]
  )

  async function mutate(
    key: string,
    endpoint: string,
    options: RequestInit,
    successMessage: string
  ) {
    setBusyKey(key)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
      })
      const payload = (await response.json().catch(() => null)) as unknown

      if (!response.ok) {
        throw new Error(errorMessage(payload, "تعذر تنفيذ الإجراء"))
      }

      setSuccess(successMessage)
      router.refresh()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع")
      return false
    } finally {
      setBusyKey("")
    }
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      "member-add",
      `/api/projects/${project.id}/members`,
      {
        method: "POST",
        body: JSON.stringify({
          employeeProfileId: form.get("employeeProfileId"),
          role: form.get("role"),
          responsibility: form.get("responsibility"),
        }),
      },
      "تم حفظ عضو المشروع"
    )
    if (saved) event.currentTarget.reset()
  }

  async function addPhase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      "phase-add",
      `/api/projects/${project.id}/phases`,
      {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          code: form.get("code"),
          status: form.get("status"),
          startDate: form.get("startDate") || null,
          dueDate: form.get("dueDate") || null,
          sortOrder: Number(form.get("sortOrder") || 0),
          progress: 0,
        }),
      },
      "تمت إضافة المرحلة"
    )
    if (saved) event.currentTarget.reset()
  }

  async function addParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      "participant-add",
      `/api/tasks/${selectedTask.id}/participants`,
      {
        method: "POST",
        body: JSON.stringify({
          employeeProfileId: form.get("employeeProfileId"),
          role: form.get("role"),
        }),
      },
      "تم حفظ مشارك المهمة"
    )
    if (saved) event.currentTarget.reset()
  }

  async function addDependency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      "dependency-add",
      `/api/tasks/${selectedTask.id}/dependencies`,
      {
        method: "POST",
        body: JSON.stringify({
          dependsOnTaskId: form.get("dependsOnTaskId"),
          type: form.get("type"),
        }),
      },
      "تمت إضافة التبعية"
    )
    if (saved) event.currentTarget.reset()
  }

  async function addBlocker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      "blocker-add",
      `/api/tasks/${selectedTask.id}/blockers`,
      {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          severity: form.get("severity"),
        }),
      },
      "تم تسجيل العائق"
    )
    if (saved) event.currentTarget.reset()
  }

  return (
    <div className="d-flex flex-column gap-4">
      <AquaPageHeader
        badge="PROJECT EXECUTION"
        title={project.name}
        description="إدارة مراحل المشروع وفريق التنفيذ وتقدم المهام والتبعيات والعوائق من مساحة تشغيل واحدة."
      />

      <div className="d-flex flex-wrap justify-content-end gap-2">
        <Link href="/dashboard/my-day" className="btn aqua-btn-ghost">
          مهامي اليوم
        </Link>
        <Link href="/dashboard/projects" className="btn aqua-btn-ghost">
          رجوع للمشاريع
        </Link>
      </div>

      {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
      {success ? <div className="alert alert-success mb-0">{success}</div> : null}

      <section className="row g-3">
        {[
          ["التقدم العام", `${summary.progress}%`],
          ["المهام", summary.totalTasks],
          ["المكتملة", summary.completedTasks],
          ["المتعطلة", summary.blockedTasks],
          ["العوائق المفتوحة", summary.openBlockers],
        ].map(([label, value]) => (
          <div className="col-6 col-xl" key={label}>
            <div className="aqua-card p-3 h-100">
              <div className="small aqua-muted">{label}</div>
              <div className="fs-3 fw-black mt-2" dir="ltr">
                {value}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="aqua-card p-4">
        <div className="row g-4 align-items-center">
          <div className="col-lg-8">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="badge text-bg-info">{projectStatusLabel(project.status)}</span>
              <span className="badge text-bg-secondary">{project.priority}</span>
              {project.code ? <span className="aqua-badge" dir="ltr">{project.code}</span> : null}
            </div>
            <h2 className="h4 fw-black mb-2">{project.client?.name ?? "مشروع داخلي"}</h2>
            <p className="aqua-muted mb-0">{project.description || "لا يوجد وصف للمشروع."}</p>
          </div>
          <div className="col-lg-4">
            <div className="small aqua-muted mb-2">
              {dateOnly(project.startDate)} — {dateOnly(project.dueDate)}
            </div>
            <div className="progress" role="progressbar" aria-valuenow={summary.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar" style={{ width: `${summary.progress}%` }}>
                {summary.progress}%
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-4">
        <div className="col-xl-5">
          <section className="aqua-card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <div>
                <div className="small aqua-muted">PROJECT TEAM</div>
                <h2 className="h5 fw-black mb-0">فريق المشروع</h2>
              </div>
              <span className="badge text-bg-info">{members.length}</span>
            </div>

            <div className="d-flex flex-column gap-2 mb-4">
              {members.length === 0 ? (
                <div className="aqua-card-soft p-3 aqua-muted">لم تتم إضافة أعضاء للمشروع.</div>
              ) : (
                members.map((member) => (
                  <div className="aqua-card-soft p-3" key={member.id}>
                    <div className="d-flex justify-content-between gap-3">
                      <div>
                        <div className="fw-bold">{member.employeeProfile.user.name}</div>
                        <div className="small aqua-muted">
                          {member.employeeProfile.jobRole?.name ?? "دون مسمى"} · {memberRoleLabels[member.role]}
                        </div>
                        {member.responsibility ? (
                          <div className="small mt-2">{member.responsibility}</div>
                        ) : null}
                      </div>
                      {canManage &&
                      member.role !== "PROJECT_LEAD" &&
                      (member.role !== "MANAGER" || canManageLeadership) ? (
                        <button
                          type="button"
                          className="btn btn-sm aqua-btn-ghost align-self-start"
                          disabled={busyKey === `member-${member.id}`}
                          onClick={() =>
                            mutate(
                              `member-${member.id}`,
                              `/api/projects/${project.id}/members/${member.id}`,
                              { method: "DELETE" },
                              "تمت إزالة عضو المشروع"
                            )
                          }
                        >
                          إزالة
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            {canManage ? (
              <form className="row g-2" onSubmit={addMember}>
                <div className="col-12">
                  <select name="employeeProfileId" className="form-select" required defaultValue="">
                    <option value="" disabled>اختر الموظف</option>
                    {employees.map((employee) => (
                      <option value={employee.id} key={employee.id}>
                        {employee.user.name} — {employee.jobRole?.name ?? "دون مسمى"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-5">
                  <select name="role" className="form-select" defaultValue="CONTRIBUTOR">
                    {Object.entries(memberRoleLabels)
                      .filter(
                        ([value]) =>
                          canManageLeadership ||
                          (value !== "PROJECT_LEAD" && value !== "MANAGER")
                      )
                      .map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                  </select>
                </div>
                <div className="col-md-7">
                  <input name="responsibility" className="form-control" placeholder="المسؤولية داخل المشروع" />
                </div>
                <div className="col-12">
                  <button className="btn aqua-btn-primary w-100" disabled={busyKey === "member-add"}>
                    إضافة أو تحديث العضو
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </div>

        <div className="col-xl-7">
          <section className="aqua-card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <div>
                <div className="small aqua-muted">PHASES</div>
                <h2 className="h5 fw-black mb-0">مراحل المشروع</h2>
              </div>
              <span className="badge text-bg-info">{phases.length}</span>
            </div>

            <div className="d-flex flex-column gap-3 mb-4">
              {phases.length === 0 ? (
                <div className="aqua-card-soft p-3 aqua-muted">ابدأ بإضافة مرحلة تنفيذ أولى.</div>
              ) : (
                phases.map((phase) => {
                  const draft = phaseDrafts[phase.id] ?? { status: phase.status, progress: phase.progress }
                  const taskCount = tasks.filter((task) => task.phaseId === phase.id).length

                  return (
                    <div className="aqua-card-soft p-3" key={phase.id}>
                      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                        <div>
                          <div className="fw-bold">{phase.name}</div>
                          <div className="small aqua-muted" dir="ltr">
                            {phase.code || "NO CODE"} · {dateOnly(phase.startDate)} — {dateOnly(phase.dueDate)}
                          </div>
                        </div>
                        <span className="badge text-bg-secondary align-self-start">{taskCount} مهمة</span>
                      </div>

                      <div className="row g-2 align-items-end">
                        <div className="col-md-5">
                          <label className="form-label small">الحالة</label>
                          <select
                            className="form-select"
                            value={draft.status}
                            disabled={!canManage}
                            onChange={(event) =>
                              setPhaseDrafts((current) => ({
                                ...current,
                                [phase.id]: { ...draft, status: event.target.value as Phase["status"] },
                              }))
                            }
                          >
                            {Object.entries(phaseStatusLabels).map(([value, label]) => (
                              <option value={value} key={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">الإنجاز %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="form-control"
                            value={draft.progress}
                            disabled={!canManage}
                            onChange={(event) =>
                              setPhaseDrafts((current) => ({
                                ...current,
                                [phase.id]: { ...draft, progress: Number(event.target.value) },
                              }))
                            }
                          />
                        </div>
                        {canManage ? (
                          <div className="col-md-4 d-flex gap-2">
                            <button
                              type="button"
                              className="btn aqua-btn-primary flex-grow-1"
                              disabled={busyKey === `phase-save-${phase.id}`}
                              onClick={() =>
                                mutate(
                                  `phase-save-${phase.id}`,
                                  `/api/projects/${project.id}/phases/${phase.id}`,
                                  { method: "PATCH", body: JSON.stringify(draft) },
                                  "تم تحديث المرحلة"
                                )
                              }
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              className="btn aqua-btn-ghost"
                              disabled={taskCount > 0 || busyKey === `phase-delete-${phase.id}`}
                              title={taskCount > 0 ? "انقل مهام المرحلة قبل حذفها" : "حذف المرحلة"}
                              onClick={() =>
                                mutate(
                                  `phase-delete-${phase.id}`,
                                  `/api/projects/${project.id}/phases/${phase.id}`,
                                  { method: "DELETE" },
                                  "تم حذف المرحلة"
                                )
                              }
                            >
                              حذف
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {canManage ? (
              <form className="row g-2" onSubmit={addPhase}>
                <div className="col-md-5">
                  <input name="name" className="form-control" placeholder="اسم المرحلة" required />
                </div>
                <div className="col-md-3">
                  <input name="code" className="form-control" placeholder="CODE" dir="ltr" />
                </div>
                <div className="col-md-2">
                  <select name="status" className="form-select" defaultValue="PLANNED">
                    {Object.entries(phaseStatusLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <input name="sortOrder" type="number" min={0} className="form-control" defaultValue={phases.length * 10} />
                </div>
                <div className="col-md-5">
                  <input name="startDate" type="date" className="form-control" />
                </div>
                <div className="col-md-5">
                  <input name="dueDate" type="date" className="form-control" />
                </div>
                <div className="col-md-2">
                  <button className="btn aqua-btn-primary w-100" disabled={busyKey === "phase-add"}>إضافة</button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </div>

      <section className="aqua-card p-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <div className="small aqua-muted">TASK DELIVERY</div>
            <h2 className="h5 fw-black mb-0">تقدم مهام المشروع</h2>
          </div>
          <Link href={`/dashboard/tasks?projectId=${project.id}`} className="btn aqua-btn-ghost">
            فتح قائمة المهام
          </Link>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle aqua-log-table">
            <thead>
              <tr>
                <th>المهمة</th>
                <th>المرحلة</th>
                <th>الحالة</th>
                <th>الإنجاز</th>
                <th>التسليم</th>
                <th>العوائق</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={7} className="text-center aqua-muted py-5">لا توجد مهام مرتبطة بالمشروع.</td></tr>
              ) : (
                tasks.map((task) => {
                  const draft = taskDrafts[task.id] ?? {
                    phaseId: task.phaseId,
                    status: task.status,
                    progress: task.progress,
                  }
                  const openBlockers = task.blockers.filter((blocker) => blocker.status === "OPEN").length

                  return (
                    <tr key={task.id}>
                      <td>
                        <div className="fw-bold">{task.title}</div>
                        <div className="small aqua-muted">{task.assignedTo?.name ?? "غير مسندة"}</div>
                      </td>
                      <td style={{ minWidth: 170 }}>
                        <select
                          className="form-select form-select-sm"
                          value={draft.phaseId ?? ""}
                          disabled={!task.canEdit}
                          onChange={(event) =>
                            setTaskDrafts((current) => ({
                              ...current,
                              [task.id]: { ...draft, phaseId: event.target.value || null },
                            }))
                          }
                        >
                          <option value="">دون مرحلة</option>
                          {phases.map((phase) => (
                            <option value={phase.id} key={phase.id}>{phase.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <select
                          className="form-select form-select-sm"
                          value={draft.status}
                          disabled={!task.canEdit}
                          onChange={(event) =>
                            setTaskDrafts((current) => ({
                              ...current,
                              [task.id]: { ...draft, status: event.target.value as Task["status"] },
                            }))
                          }
                        >
                          {Object.entries(taskStatusLabels).map(([value, label]) => (
                            <option value={value} key={value}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 125 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="form-control form-control-sm"
                          value={draft.progress}
                          disabled={!task.canEdit}
                          onChange={(event) =>
                            setTaskDrafts((current) => ({
                              ...current,
                              [task.id]: { ...draft, progress: Number(event.target.value) },
                            }))
                          }
                        />
                      </td>
                      <td className="small" dir="ltr">{dateOnly(task.dueDate)}</td>
                      <td>
                        <span className={`badge ${openBlockers > 0 ? "text-bg-danger" : "text-bg-success"}`}>
                          {openBlockers}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          {task.canEdit ? (
                            <button
                              type="button"
                              className="btn btn-sm aqua-btn-primary"
                              disabled={busyKey === `task-save-${task.id}`}
                              onClick={() =>
                                mutate(
                                  `task-save-${task.id}`,
                                  `/api/tasks/${task.id}`,
                                  { method: "PATCH", body: JSON.stringify(draft) },
                                  "تم تحديث المهمة"
                                )
                              }
                            >
                              حفظ
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm aqua-btn-ghost"
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            إدارة
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTask ? (
        <section className="aqua-card p-4">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
            <div>
              <div className="small aqua-muted">TASK CONTROL</div>
              <h2 className="h5 fw-black mb-1">{selectedTask.title}</h2>
              <div className="small aqua-muted">
                {selectedTask.phase?.name ?? "دون مرحلة"} · {taskStatusLabels[selectedTask.status]} · {selectedTask.progress}%
              </div>
            </div>
            <select
              className="form-select"
              style={{ maxWidth: 320 }}
              value={effectiveSelectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
            >
              {tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}
            </select>
          </div>

          <div className="row g-4">
            <div className="col-lg-4">
              <div className="aqua-card-soft p-3 h-100">
                <h3 className="h6 fw-black">المشاركون</h3>
                <div className="d-flex flex-column gap-2 my-3">
                  {selectedTask.participants.length === 0 ? (
                    <div className="small aqua-muted">لا يوجد مشاركون.</div>
                  ) : selectedTask.participants.map((participant) => (
                    <div className="d-flex justify-content-between gap-2" key={participant.id}>
                      <div>
                        <div className="fw-bold small">{participant.employeeProfile.user.name}</div>
                        <div className="small aqua-muted">{participantRoleLabels[participant.role]}</div>
                      </div>
                      {selectedTask.canManageParticipants &&
                      (participant.role !== "OWNER" || selectedTask.canAssignOwner) ? (
                        <button
                          type="button"
                          className="btn btn-sm aqua-btn-ghost"
                          onClick={() =>
                            mutate(
                              `participant-${participant.id}`,
                              `/api/tasks/${selectedTask.id}/participants/${participant.id}`,
                              { method: "DELETE" },
                              "تمت إزالة المشارك"
                            )
                          }
                        >
                          إزالة
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {selectedTask.canManageParticipants ? (
                  <form className="d-flex flex-column gap-2" onSubmit={addParticipant}>
                    <select name="employeeProfileId" className="form-select" required defaultValue="">
                      <option value="" disabled>اختر الموظف</option>
                      {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.user.name}</option>)}
                    </select>
                    <select name="role" className="form-select" defaultValue="CONTRIBUTOR">
                      {Object.entries(participantRoleLabels)
                        .filter(([value]) => selectedTask.canAssignOwner || value !== "OWNER")
                        .map(([value, label]) => (
                          <option value={value} key={value}>{label}</option>
                        ))}
                    </select>
                    <button className="btn aqua-btn-primary" disabled={busyKey === "participant-add"}>إضافة مشارك</button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="aqua-card-soft p-3 h-100">
                <h3 className="h6 fw-black">التبعيات</h3>
                <div className="d-flex flex-column gap-2 my-3">
                  {selectedTask.dependencies.length === 0 ? (
                    <div className="small aqua-muted">لا توجد تبعيات.</div>
                  ) : selectedTask.dependencies.map((dependency) => (
                    <div className="d-flex justify-content-between gap-2" key={dependency.id}>
                      <div>
                        <div className="fw-bold small">{dependency.dependsOnTask.title}</div>
                        <div className="small aqua-muted">{dependencyTypeLabels[dependency.type]}</div>
                      </div>
                      {selectedTask.canEdit ? (
                        <button
                          type="button"
                          className="btn btn-sm aqua-btn-ghost"
                          onClick={() =>
                            mutate(
                              `dependency-${dependency.id}`,
                              `/api/tasks/${selectedTask.id}/dependencies/${dependency.id}`,
                              { method: "DELETE" },
                              "تمت إزالة التبعية"
                            )
                          }
                        >
                          إزالة
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {selectedTask.canEdit ? (
                  <form className="d-flex flex-column gap-2" onSubmit={addDependency}>
                    <select name="dependsOnTaskId" className="form-select" required defaultValue="">
                      <option value="" disabled>اختر المهمة السابقة</option>
                      {tasks.filter((task) => task.id !== selectedTask.id).map((task) => (
                        <option value={task.id} key={task.id}>{task.title}</option>
                      ))}
                    </select>
                    <select name="type" className="form-select" defaultValue="FINISH_TO_START">
                      {Object.entries(dependencyTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                    <button className="btn aqua-btn-primary" disabled={busyKey === "dependency-add"}>إضافة تبعية</button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="aqua-card-soft p-3 h-100">
                <h3 className="h6 fw-black">العوائق</h3>
                <div className="d-flex flex-column gap-3 my-3">
                  {selectedTask.blockers.length === 0 ? (
                    <div className="small aqua-muted">لا توجد عوائق مسجلة.</div>
                  ) : selectedTask.blockers.map((blocker) => (
                    <div className="border-bottom pb-3" key={blocker.id}>
                      <div className="d-flex justify-content-between gap-2">
                        <div className="fw-bold small">{blocker.title}</div>
                        <span className={`badge ${blocker.status === "OPEN" ? "text-bg-danger" : "text-bg-success"}`}>
                          {blockerSeverityLabels[blocker.severity]}
                        </span>
                      </div>
                      {blocker.description ? <div className="small aqua-muted mt-1">{blocker.description}</div> : null}
                      {blocker.status === "OPEN" && selectedTask.canEdit ? (
                        <div className="d-flex gap-2 mt-2">
                          <input
                            className="form-control form-control-sm"
                            placeholder="طريقة المعالجة"
                            value={resolutionByBlocker[blocker.id] ?? ""}
                            onChange={(event) =>
                              setResolutionByBlocker((current) => ({
                                ...current,
                                [blocker.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-sm aqua-btn-primary"
                            onClick={() =>
                              mutate(
                                `blocker-${blocker.id}`,
                                `/api/tasks/${selectedTask.id}/blockers/${blocker.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    status: "RESOLVED",
                                    resolution: resolutionByBlocker[blocker.id],
                                  }),
                                },
                                "تمت معالجة العائق"
                              )
                            }
                          >
                            إغلاق
                          </button>
                        </div>
                      ) : blocker.resolution ? (
                        <div className="small mt-2">المعالجة: {blocker.resolution}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {selectedTask.canEdit ? (
                  <form className="d-flex flex-column gap-2" onSubmit={addBlocker}>
                    <input name="title" className="form-control" placeholder="عنوان العائق" required />
                    <textarea name="description" className="form-control" rows={2} placeholder="تفاصيل العائق" />
                    <select name="severity" className="form-select" defaultValue="MEDIUM">
                      {Object.entries(blockerSeverityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                    <button className="btn aqua-btn-primary" disabled={busyKey === "blocker-add"}>تسجيل عائق</button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
