"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  TaskPriority,
  TaskSource,
  TaskStatus,
} from "@/generated/prisma/enums"
import AquaDatePicker from "@/components/aqua/AquaDatePicker"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type ProjectOption = {
  id: string
  name: string
  clientId: string | null
}

type ClientOption = {
  id: string
  name: string
}

type UserOption = {
  id: string
  name: string
  email: string
}

type TaskItem = {
  id: string
  projectId: string | null
  project: { id: string; name: string } | null
  clientId: string | null
  client: { id: string; name: string } | null
  assignedToId: string | null
  assignedTo: UserOption | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  source: TaskSource
  sourceRef: string | null
  estimatedHours: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

type Filters = {
  q: string
  status: string
  priority: string
  source: string
  projectId: string
  assignedToId: string
}

type Stats = {
  totalTasks: number
  inProgressTasks: number
  doneTasks: number
  archivedTasks: number
  from: number
  to: number
  currentPage: number
  totalPages: number
}

const taskStatuses: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
  "ARCHIVED",
]

const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const taskSources: TaskSource[] = [
  "MANUAL",
  "WEBSITE_REQUEST",
  "WORKFLOW",
  "AI_GENERATED",
]

function taskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    TODO: "مطلوبة",
    IN_PROGRESS: "قيد التنفيذ",
    BLOCKED: "متوقفة",
    REVIEW: "مراجعة",
    DONE: "منجزة",
    CANCELLED: "ملغاة",
    ARCHIVED: "مؤرشفة",
  }

  return labels[status]
}

function taskPriorityLabel(priority: TaskPriority) {
  const labels: Record<TaskPriority, string> = {
    LOW: "منخفضة",
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    URGENT: "عاجلة",
  }

  return labels[priority]
}

function taskSourceLabel(source: TaskSource) {
  const labels: Record<TaskSource, string> = {
    MANUAL: "يدوي",
    WEBSITE_REQUEST: "طلب موقع",
    WORKFLOW: "Workflow",
    AI_GENERATED: "AI",
  }

  return labels[source]
}

function statusBadge(status: TaskStatus) {
  if (status === "DONE") return "text-bg-success"
  if (status === "IN_PROGRESS") return "text-bg-info"
  if (status === "REVIEW") return "text-bg-primary"
  if (status === "BLOCKED") return "text-bg-warning"
  if (status === "CANCELLED" || status === "ARCHIVED") return "text-bg-danger"
  return "text-bg-secondary"
}

function priorityBadge(priority: TaskPriority) {
  if (priority === "URGENT") return "text-bg-danger"
  if (priority === "HIGH") return "text-bg-warning"
  if (priority === "LOW") return "text-bg-secondary"
  return "text-bg-info"
}

function dateInputValue(value: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

export default function TasksClient({
  tasks,
  projects,
  clients,
  users,
  filters,
  stats,
  pagination,
}: {
  tasks: TaskItem[]
  projects: ProjectOption[]
  clients: ClientOption[]
  users: UserOption[]
  filters: Filters
  stats: Stats
  pagination: React.ReactNode
}) {
  const router = useRouter()

  const [editingId, setEditingId] = useState<string | null>(null)

  const [projectId, setProjectId] = useState("")
  const [clientId, setClientId] = useState("")
  const [assignedToId, setAssignedToId] = useState("")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const [status, setStatus] = useState<TaskStatus>("TODO")
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM")
  const [source, setSource] = useState<TaskSource>("MANUAL")

  const [sourceRef, setSourceRef] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("")
  const [dueDate, setDueDate] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const isEditing = Boolean(editingId)

  function resetForm() {
    setEditingId(null)
    setProjectId("")
    setClientId("")
    setAssignedToId("")
    setTitle("")
    setDescription("")
    setStatus("TODO")
    setPriority("MEDIUM")
    setSource("MANUAL")
    setSourceRef("")
    setEstimatedHours("")
    setDueDate("")
    setError("")
  }

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId)

    const selectedProject = projects.find((project) => project.id === nextProjectId)

    if (selectedProject?.clientId) {
      setClientId(selectedProject.clientId)
    }
  }

  function startEdit(task: TaskItem) {
    setEditingId(task.id)
    setProjectId(task.projectId ?? "")
    setClientId(task.clientId ?? "")
    setAssignedToId(task.assignedToId ?? "")
    setTitle(task.title)
    setDescription(task.description ?? "")
    setStatus(task.status)
    setPriority(task.priority)
    setSource(task.source)
    setSourceRef(task.sourceRef ?? "")
    setEstimatedHours(task.estimatedHours ?? "")
    setDueDate(dateInputValue(task.dueDate))
    setError("")
  }

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isEditing ? `/api/tasks/${editingId}` : "/api/tasks"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectId || null,
          clientId: clientId || null,
          assignedToId: assignedToId || null,
          title,
          description,
          status,
          priority,
          source,
          sourceRef,
          estimatedHours,
          dueDate: dueDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات المهمة")
        return
      }

      resetForm()
      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  async function updateTaskStatus(task: TaskItem, nextStatus: TaskStatus) {
    setError("")

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      setError(data.message || "فشل تعديل حالة المهمة")
      return
    }

    router.refresh()
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Tasks"
        title="إدارة المهام"
        description="تقسيم العمل داخل Aqua.Tech حسب المشروع، العميل، الموظف، الحالة، والأولوية."
        brandValue="Tasks"
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="aqua-card aqua-crm-form-card">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">
                  {isEditing ? "تعديل مهمة" : "إضافة مهمة"}
                </h3>
                <p className="small aqua-muted mb-0">
                  {isEditing
                    ? "عدّل بيانات المهمة الحالية."
                    : "أضف مهمة يدوية أو جهزها لاحقًا للـ Workflow."}
                </p>
              </div>

              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn aqua-btn-ghost btn-sm"
                >
                  إلغاء
                </button>
              ) : null}
            </div>

            <form onSubmit={submitTask}>
              <div className="mb-3">
                <label className="form-label aqua-muted">عنوان المهمة</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="مثال: تصميم الصفحة الرئيسية"
                />
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المشروع</label>
                  <select
                    value={projectId}
                    onChange={(event) => changeProject(event.target.value)}
                    className="form-select aqua-control"
                  >
                    <option value="">بدون مشروع</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">العميل</label>
                  <select
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="form-select aqua-control"
                  >
                    <option value="">بدون عميل</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">الموظف المسؤول</label>
                <select
                  value={assignedToId}
                  onChange={(event) => setAssignedToId(event.target.value)}
                  className="form-select aqua-control"
                >
                  <option value="">غير محدد</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as TaskStatus)
                    }
                    className="form-select aqua-control"
                  >
                    {taskStatuses.map((item) => (
                      <option key={item} value={item}>
                        {taskStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as TaskPriority)
                    }
                    className="form-select aqua-control"
                  >
                    {taskPriorities.map((item) => (
                      <option key={item} value={item}>
                        {taskPriorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المصدر</label>
                  <select
                    value={source}
                    onChange={(event) =>
                      setSource(event.target.value as TaskSource)
                    }
                    className="form-select aqua-control"
                  >
                    {taskSources.map((item) => (
                      <option key={item} value={item}>
                        {taskSourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الساعات المتوقعة</label>
                  <input
                    dir="ltr"
                    value={estimatedHours}
                    onChange={(event) => setEstimatedHours(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="4"
                  />
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">مرجع المصدر</label>
                  <input
                    dir="ltr"
                    value={sourceRef}
                    onChange={(event) => setSourceRef(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="REQ-001 / workflow id"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">تاريخ التسليم</label>
                  <AquaDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="اختر تاريخ التسليم"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">الوصف</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="form-control aqua-control"
                  rows={3}
                />
              </div>

              {error ? (
                <div className="alert alert-danger rounded-4 border-0 mt-3">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="btn aqua-btn-primary w-100 py-3 mt-3"
              >
                {loading
                  ? "جاري الحفظ..."
                  : isEditing
                    ? "حفظ التعديلات"
                    : "إضافة المهمة"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="aqua-card aqua-crm-table-card p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">قائمة المهام</h3>
                <p className="small aqua-muted mb-0">
                  عرض {stats.from} - {stats.to} من أصل {stats.totalTasks} مهمة
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="aqua-badge">الكل {stats.totalTasks}</span>
                <span className="aqua-badge">
                  قيد التنفيذ {stats.inProgressTasks}
                </span>
                <span className="aqua-badge">المنجزة {stats.doneTasks}</span>
                <span className="aqua-badge">
                  المؤرشفة {stats.archivedTasks}
                </span>
                <span className="small aqua-soft ms-2" dir="ltr">
                  Page {stats.currentPage} / {stats.totalPages}
                </span>
              </div>
            </div>

            <form
              action="/dashboard/tasks"
              method="get"
              className="aqua-card-soft p-3 mb-3"
            >
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-3">
                  <label className="form-label aqua-muted">بحث</label>
                  <input
                    name="q"
                    defaultValue={filters.q}
                    className="form-control aqua-control"
                    placeholder="ابحث بعنوان المهمة..."
                  />
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    name="status"
                    defaultValue={filters.status}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {taskStatuses.map((item) => (
                      <option key={item} value={item}>
                        {taskStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    name="priority"
                    defaultValue={filters.priority}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {taskPriorities.map((item) => (
                      <option key={item} value={item}>
                        {taskPriorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">المشروع</label>
                  <select
                    name="projectId"
                    defaultValue={filters.projectId}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-3">
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn aqua-btn-primary flex-fill">
                      تطبيق
                    </button>

                    <a href="/dashboard/tasks" className="btn aqua-btn-ghost">
                      مسح
                    </a>
                  </div>
                </div>
              </div>
            </form>

            <div className="aqua-crm-table-scroll">
              <table className="table table-hover align-middle aqua-log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>المهمة</th>
                    <th>المشروع</th>
                    <th>المسؤول</th>
                    <th>الحالة</th>
                    <th>الأولوية</th>
                    <th>التسليم</th>
                    <th>إجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {tasks.length === 0 ? (
                    <tr className="aqua-crm-empty-row">
                      <td colSpan={8} className="text-center aqua-soft py-5">
                        <div className="fw-bold text-white mb-2">
                          لا يوجد مهام حتى الآن
                        </div>
                        <div className="small aqua-muted">
                          أضف أول مهمة من النموذج الموجود بجانب الجدول.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task, index) => (
                      <tr key={task.id}>
                        <td className="aqua-soft" dir="ltr">
                          {(stats.currentPage - 1) * 20 + index + 1}
                        </td>

                        <td>
                          <div className="fw-bold">{task.title}</div>
                          <div className="small aqua-soft">
                            {taskSourceLabel(task.source)}
                            {task.estimatedHours
                              ? ` • ${task.estimatedHours}h`
                              : ""}
                          </div>
                        </td>

                        <td className="small aqua-muted">
                          {task.project?.name || "بدون مشروع"}
                        </td>

                        <td className="small aqua-muted">
                          {task.assignedTo?.name || "غير محدد"}
                        </td>

                        <td>
                          <span className={`badge ${statusBadge(task.status)}`}>
                            {taskStatusLabel(task.status)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${priorityBadge(task.priority)}`}
                          >
                            {taskPriorityLabel(task.priority)}
                          </span>
                        </td>

                        <td className="small aqua-muted" dir="ltr">
                          {task.dueDate ? dateInputValue(task.dueDate) : "—"}
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>

                            {task.status !== "DONE" ? (
                              <button
                                type="button"
                                onClick={() => updateTaskStatus(task, "DONE")}
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                إنجاز
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                updateTaskStatus(
                                  task,
                                  task.status === "ARCHIVED"
                                    ? "TODO"
                                    : "ARCHIVED",
                                )
                              }
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              {task.status === "ARCHIVED" ? "استرجاع" : "أرشفة"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3">{pagination}</div>
          </div>
        </div>
      </div>
    </div>
  )
}