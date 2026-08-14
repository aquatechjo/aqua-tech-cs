"use client"

import {
  AlertTriangle,
  Archive,
  Ban,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Edit3,
  ListChecks,
  Plus,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaDatePicker,
  AquaFilterBar,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaSelect,
  AquaTable,
  AquaTableStateRow,
  AquaTextarea,
  aquaToast,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"
import {
  TaskPriority,
  TaskSource,
  TaskStatus,
} from "@/generated/prisma/enums"
import styles from "./Tasks.module.css"

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
  progress: number
  dueDate: string | null
  dueLabel: string
  dueDisplay: string
  dueVariant: AquaBadgeVariant
  openBlockerCount: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
  canEdit: boolean
}

type Filters = {
  q: string
  status: string
  priority: string
  due: string
  projectId: string
  assignedToId: string
}

type Stats = {
  totalTasks: number
  overdueTasks: number
  todayTasks: number
  inProgressTasks: number
  blockedTasks: number
  from: number
  to: number
  currentPage: number
  totalPages: number
}

type Scope = {
  label: string
  description: string
  dataScope: "personal" | "team" | "company"
  canAssignOthers: boolean
  canManageSources: boolean
  showAssignee: boolean
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

const taskPriorities: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

const taskSources: TaskSource[] = [
  "MANUAL",
  "WEBSITE_REQUEST",
  "WORKFLOW",
  "AI_GENERATED",
]

function taskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    TODO: "للعمل",
    IN_PROGRESS: "قيد التنفيذ",
    BLOCKED: "متعطلة",
    REVIEW: "للمراجعة",
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
    MANUAL: "يدوية",
    WEBSITE_REQUEST: "طلب من الموقع",
    WORKFLOW: "سير عمل",
    AI_GENERATED: "مولدة بالذكاء الاصطناعي",
    PROJECT_FEEDBACK: "متابعة تقييم العميل",
  }

  return labels[source]
}

function statusVariant(status: TaskStatus): AquaBadgeVariant {
  if (status === "DONE") return "success"
  if (status === "IN_PROGRESS") return "aqua"
  if (status === "REVIEW") return "warning"
  if (status === "BLOCKED") return "danger"
  if (status === "TODO") return "blue"
  return "muted"
}

function priorityVariant(
  priority: TaskPriority
): AquaBadgeVariant {
  if (priority === "URGENT") return "danger"
  if (priority === "HIGH") return "warning"
  if (priority === "MEDIUM") return "blue"
  return "muted"
}

function dateInputValue(value: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

function nextTaskAction(task: TaskItem) {
  if (task.status === "TODO") {
    return {
      label: "بدء",
      status: "IN_PROGRESS" as TaskStatus,
      icon: <CirclePlay />,
    }
  }

  if (task.status === "IN_PROGRESS") {
    return {
      label: "إرسال للمراجعة",
      status: "REVIEW" as TaskStatus,
      icon: <ListChecks />,
    }
  }

  if (task.status === "REVIEW") {
    return {
      label: "إنجاز",
      status: "DONE" as TaskStatus,
      icon: <CheckCircle2 />,
    }
  }

  return null
}

export default function TasksClient({
  currentUserId,
  tasks,
  projects,
  clients,
  users,
  scope,
  filters,
  stats,
  pagination,
}: {
  currentUserId: string
  tasks: TaskItem[]
  projects: ProjectOption[]
  clients: ClientOption[]
  users: UserOption[]
  scope: Scope
  filters: Filters
  stats: Stats
  pagination: React.ReactNode
}) {
  const router = useRouter()
  const personalAssigneeId = scope.canAssignOthers
    ? ""
    : currentUserId

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] =
    useState<TaskItem | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  const [projectId, setProjectId] = useState("")
  const [clientId, setClientId] = useState("")
  const [assignedToId, setAssignedToId] =
    useState(personalAssigneeId)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<TaskStatus>("TODO")
  const [priority, setPriority] =
    useState<TaskPriority>("MEDIUM")
  const [source, setSource] = useState<TaskSource>("MANUAL")
  const [sourceRef, setSourceRef] = useState("")
  const [estimatedHours, setEstimatedHours] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const isEditing = Boolean(editingId)
  const activeFilterCount = [
    filters.q,
    filters.status,
    filters.priority,
    filters.due,
    filters.projectId,
    filters.assignedToId,
  ].filter(Boolean).length

  function clearForm() {
    setEditingId(null)
    setProjectId("")
    setClientId("")
    setAssignedToId(personalAssigneeId)
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

  function openCreate() {
    clearForm()
    setModalOpen(true)
  }

  function closeForm() {
    if (loading) return
    setModalOpen(false)
    clearForm()
  }

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId)

    const selectedProject = projects.find(
      (project) => project.id === nextProjectId
    )

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
    setModalOpen(true)
  }

  async function submitTask(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isEditing
        ? `/api/tasks/${editingId}`
        : "/api/tasks"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectId || null,
          clientId: scope.canManageSources
            ? clientId || null
            : undefined,
          assignedToId: scope.canAssignOthers
            ? assignedToId || null
            : isEditing
              ? undefined
              : currentUserId,
          title,
          description,
          status: isEditing ? status : "TODO",
          priority,
          source: scope.canManageSources
            ? source
            : isEditing
              ? undefined
              : "MANUAL",
          sourceRef: scope.canManageSources
            ? sourceRef
            : undefined,
          estimatedHours,
          dueDate: dueDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات المهمة")
        return
      }

      aquaToast.success(
        isEditing ? "تم حفظ تعديلات المهمة" : "تمت إضافة المهمة"
      )
      setModalOpen(false)
      clearForm()
      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  async function updateTaskStatus(
    task: TaskItem,
    nextStatus: TaskStatus
  ) {
    setError("")
    setBusyTaskId(task.id)

    try {
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
        const message =
          data.message || "فشل تعديل حالة المهمة"
        setError(message)
        aquaToast.error(message)
        return false
      }

      aquaToast.success("تم تحديث حالة المهمة")
      router.refresh()
      return true
    } catch {
      const message = "حدث خطأ أثناء الاتصال بالخادم"
      setError(message)
      aquaToast.error(message)
      return false
    } finally {
      setBusyTaskId(null)
    }
  }

  async function archiveTask(task: TaskItem) {
    setArchiveLoading(true)

    const succeeded = await updateTaskStatus(
      task,
      task.status === "ARCHIVED" ? "TODO" : "ARCHIVED"
    )

    if (succeeded) setPendingArchive(null)
    setArchiveLoading(false)
  }

  const metricItems = [
    {
      label: "متأخرة",
      value: stats.overdueTasks,
      hint:
        stats.overdueTasks > 0
          ? "ابدأ بها أولًا"
          : "لا يوجد تأخير",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      label: "مستحقة اليوم",
      value: stats.todayTasks,
      hint:
        stats.todayTasks > 0
          ? "ضمن تركيز اليوم"
          : "لا استحقاقات اليوم",
      icon: CalendarClock,
      tone: "warning",
    },
    {
      label: "قيد التنفيذ",
      value: stats.inProgressTasks,
      hint: "عمل جارٍ حاليًا",
      icon: Clock3,
      tone: "aqua",
    },
    {
      label: "متعطلة",
      value: stats.blockedTasks,
      hint:
        stats.blockedTasks > 0
          ? "تحتاج إزالة عائق"
          : "لا عوائق مفتوحة",
      icon: Ban,
      tone: "blue",
    },
  ] as const

  const columnCount = scope.showAssignee ? 7 : 6

  return (
    <div className={`${styles.page} aqua-tasks-page`}>
      <section
        className={styles.intro}
        aria-labelledby="tasks-scope-title"
      >
        <div className={styles.introCopy}>
          <AquaBadge size="sm" dot>
            {scope.label}
          </AquaBadge>
          <div>
            <h2 id="tasks-scope-title" className={styles.introTitle}>
              العمل المطلوب منك في مكان واحد
            </h2>
            <p className={styles.introDescription}>
              {scope.description}
            </p>
          </div>
        </div>

        <div className={styles.introActions}>
          <AquaLinkButton
            href="/dashboard/my-day"
            variant="ghost"
            size="sm"
            leadingIcon={<CalendarClock />}
          >
            افتح يومي
          </AquaLinkButton>
          <AquaButton
            size="sm"
            leadingIcon={<Plus />}
            onClick={openCreate}
          >
            مهمة جديدة
          </AquaButton>
        </div>
      </section>

      <section
        className={styles.metrics}
        aria-label="ملخص المهام"
      >
        {metricItems.map((metric) => {
          const Icon = metric.icon

          return (
            <AquaCard
              key={metric.label}
              padding="sm"
              className={`${styles.metric} ${styles[`metric_${metric.tone}`]}`}
            >
              <div className={styles.metricIcon} aria-hidden="true">
                <Icon />
              </div>
              <div className={styles.metricCopy}>
                <span className={styles.metricLabel}>
                  {metric.label}
                </span>
                <strong className={styles.metricValue} dir="ltr">
                  {metric.value}
                </strong>
                <span className={styles.metricHint}>
                  {metric.hint}
                </span>
              </div>
            </AquaCard>
          )
        })}
      </section>

      {error && !modalOpen ? (
        <AquaAlert variant="danger" title="تعذر إكمال العملية">
          {error}
        </AquaAlert>
      ) : null}

      <AquaDataPanel
        title={scope.label}
        description={`عرض ${stats.from}–${stats.to} من أصل ${stats.totalTasks} مهمة ضمن النطاق الحالي`}
        meta={
          <span dir="ltr">
            Page {stats.currentPage} / {stats.totalPages}
          </span>
        }
        footer={pagination}
      >
        <AquaFilterBar
          action="/dashboard/tasks"
          method="get"
          activeCount={activeFilterCount}
          description="ابحث وضيّق القائمة دون تغيير نطاق الصلاحيات."
          className="mb-3"
        >
          <AquaInput
            span={3}
            name="q"
            defaultValue={filters.q}
            label="بحث"
            placeholder="عنوان المهمة أو المشروع..."
          />

          <AquaSelect
            span={2}
            name="status"
            defaultValue={filters.status}
            label="الحالة"
          >
            <option value="">الكل</option>
            {taskStatuses.map((item) => (
              <option key={item} value={item}>
                {taskStatusLabel(item)}
              </option>
            ))}
          </AquaSelect>

          <AquaSelect
            span={2}
            name="priority"
            defaultValue={filters.priority}
            label="الأولوية"
          >
            <option value="">الكل</option>
            {taskPriorities.map((item) => (
              <option key={item} value={item}>
                {taskPriorityLabel(item)}
              </option>
            ))}
          </AquaSelect>

          <AquaSelect
            span={2}
            name="due"
            defaultValue={filters.due}
            label="الاستحقاق"
          >
            <option value="">كل المواعيد</option>
            <option value="OVERDUE">متأخرة</option>
            <option value="TODAY">اليوم</option>
            <option value="UPCOMING">الأيام القادمة</option>
            <option value="NO_DUE_DATE">دون موعد</option>
          </AquaSelect>

          <AquaSelect
            span={3}
            name="projectId"
            defaultValue={filters.projectId}
            label="المشروع"
          >
            <option value="">كل المشاريع</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </AquaSelect>

          {scope.showAssignee ? (
            <AquaSelect
              span={3}
              name="assignedToId"
              defaultValue={filters.assignedToId}
              label="المسؤول"
            >
              <option value="">كل المسؤولين</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.id === currentUserId ? "أنا" : user.name}
                </option>
              ))}
            </AquaSelect>
          ) : null}

          <div
            className="aqua-filter-bar__actions"
            data-aqua-span="3"
          >
            <AquaButton
              type="submit"
              size="sm"
              fullWidth
              leadingIcon={<Search />}
            >
              تطبيق
            </AquaButton>
            <AquaLinkButton
              href="/dashboard/tasks"
              variant="ghost"
              size="sm"
              fullWidth
            >
              مسح
            </AquaLinkButton>
          </div>
        </AquaFilterBar>

        <AquaTable
          mobileStrategy="stack"
          density="compact"
          minWidth={scope.showAssignee ? "960px" : "840px"}
          caption={`قائمة ${scope.label}`}
        >
          <thead>
            <tr>
              <th scope="col">المهمة</th>
              <th scope="col">الحالة</th>
              <th scope="col">الاستحقاق</th>
              <th scope="col">المشروع</th>
              {scope.showAssignee ? (
                <th scope="col">المسؤول</th>
              ) : null}
              <th scope="col">الأولوية</th>
              <th scope="col">الإجراء التالي</th>
            </tr>
          </thead>

          <tbody>
            {tasks.length === 0 ? (
              <AquaTableStateRow
                colSpan={columnCount}
                variant="empty"
                icon={<ListChecks />}
                title="لا توجد مهام ضمن هذا العرض"
                description={
                  activeFilterCount > 0
                    ? "امسح الفلاتر أو غيّر معايير البحث."
                    : "أضف مهمة جديدة، وستظهر هنا عند إسنادها إلى نطاقك."
                }
              />
            ) : (
              tasks.map((task) => {
                const nextAction = nextTaskAction(task)

                return (
                  <tr key={task.id}>
                    <td data-label="المهمة">
                      <div className={styles.taskHeading}>
                        <div>
                          <div className="aqua-table__primary">
                            {task.title}
                          </div>
                          <div className="aqua-table__secondary">
                            {task.estimatedHours
                              ? `${task.estimatedHours} ساعة متوقعة`
                              : "دون تقدير زمني"}
                            {task.openBlockerCount > 0
                              ? ` • ${task.openBlockerCount} عائق مفتوح`
                              : ""}
                          </div>
                        </div>
                        {task.openBlockerCount > 0 ? (
                          <AquaBadge
                            variant="danger"
                            size="sm"
                            dot
                          >
                            عائق
                          </AquaBadge>
                        ) : null}
                      </div>
                      <div
                        className={styles.progressTrack}
                        role="progressbar"
                        aria-label={`تقدم مهمة ${task.title}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={task.progress}
                      >
                        <span
                          className={styles.progressValue}
                          style={{
                            inlineSize: `${task.progress}%`,
                          }}
                        />
                      </div>
                    </td>

                    <td data-label="الحالة">
                      <AquaBadge
                        variant={statusVariant(task.status)}
                        size="sm"
                        dot
                      >
                        {taskStatusLabel(task.status)}
                      </AquaBadge>
                    </td>

                    <td data-label="الاستحقاق">
                      <AquaBadge
                        variant={task.dueVariant}
                        size="sm"
                      >
                        {task.dueLabel}
                      </AquaBadge>
                      <div className="aqua-table__secondary">
                        {task.dueDisplay}
                      </div>
                    </td>

                    <td data-label="المشروع">
                      <span className="aqua-table__primary">
                        {task.project?.name ?? "مهمة مستقلة"}
                      </span>
                    </td>

                    {scope.showAssignee ? (
                      <td data-label="المسؤول">
                        <span className="aqua-table__secondary">
                          {task.assignedToId === currentUserId
                            ? "أنا"
                            : task.assignedTo?.name ?? "غير محدد"}
                        </span>
                      </td>
                    ) : null}

                    <td data-label="الأولوية">
                      <AquaBadge
                        variant={priorityVariant(task.priority)}
                        size="sm"
                      >
                        {taskPriorityLabel(task.priority)}
                      </AquaBadge>
                    </td>

                    <td data-label="الإجراء التالي">
                      {task.canEdit ? (
                        <div className="aqua-table__actions">
                          {nextAction ? (
                            <AquaButton
                              size="sm"
                              variant="secondary"
                              leadingIcon={nextAction.icon}
                              loading={busyTaskId === task.id}
                              loadingLabel="جارٍ التحديث"
                              onClick={() =>
                                updateTaskStatus(
                                  task,
                                  nextAction.status
                                )
                              }
                            >
                              {nextAction.label}
                            </AquaButton>
                          ) : null}

                          <AquaButton
                            size="sm"
                            variant="ghost"
                            leadingIcon={<Edit3 />}
                            onClick={() => startEdit(task)}
                            disabled={busyTaskId === task.id}
                          >
                            تعديل
                          </AquaButton>

                          <AquaButton
                            size="sm"
                            variant="ghost"
                            leadingIcon={<Archive />}
                            onClick={() => setPendingArchive(task)}
                            disabled={busyTaskId === task.id}
                          >
                            {task.status === "ARCHIVED"
                              ? "استرجاع"
                              : "أرشفة"}
                          </AquaButton>
                        </div>
                      ) : (
                        <span className="aqua-table__secondary">
                          عرض فقط
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>

      <AquaModal
        open={modalOpen}
        onClose={closeForm}
        title={isEditing ? "تعديل المهمة" : "مهمة جديدة"}
        description={
          isEditing
            ? "حدّث البيانات التشغيلية المسموح لك بتعديلها."
            : scope.canAssignOthers
              ? "أنشئ مهمة وحدد المسؤول من نطاق عملك."
              : "أنشئ مهمة شخصية مرتبطة بعملك أو مشروعك."
        }
        size="lg"
        closeOnBackdrop={!loading}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={closeForm}
              disabled={loading}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="aqua-task-form"
              loading={loading}
              loadingLabel="جارٍ الحفظ"
            >
              {isEditing ? "حفظ التعديلات" : "إضافة المهمة"}
            </AquaButton>
          </div>
        }
      >
        <form id="aqua-task-form" onSubmit={submitTask}>
          <div className="aqua-form-grid">
            <AquaInput
              required
              minLength={2}
              label="عنوان المهمة"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ما العمل المطلوب إنجازه؟"
              data-aqua-autofocus
            />

            <AquaSelect
              span={6}
              label="المشروع"
              value={projectId}
              onChange={(event) =>
                changeProject(event.target.value)
              }
            >
              <option value="">مهمة مستقلة</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </AquaSelect>

            {scope.canManageSources ? (
              <AquaSelect
                span={6}
                label="العميل"
                value={clientId}
                onChange={(event) =>
                  setClientId(event.target.value)
                }
              >
                <option value="">دون عميل</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </AquaSelect>
            ) : null}

            {scope.canAssignOthers ? (
              <AquaSelect
                span={6}
                label="المسؤول"
                value={assignedToId}
                onChange={(event) =>
                  setAssignedToId(event.target.value)
                }
              >
                <option value="">غير محدد</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.id === currentUserId ? "أنا" : user.name}
                  </option>
                ))}
              </AquaSelect>
            ) : (
              <div
                className={styles.personalAssignment}
                data-aqua-span="6"
              >
                <span>المسؤول</span>
                <strong>
                  {assignedToId &&
                  assignedToId !== currentUserId
                    ? "المسؤول الحالي"
                    : "أنت"}
                </strong>
              </div>
            )}

            <AquaSelect
              span={6}
              label="الأولوية"
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as TaskPriority
                )
              }
            >
              {taskPriorities.map((item) => (
                <option key={item} value={item}>
                  {taskPriorityLabel(item)}
                </option>
              ))}
            </AquaSelect>

            {isEditing ? (
              <AquaSelect
                span={6}
                label="الحالة"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as TaskStatus)
                }
              >
                {taskStatuses.map((item) => (
                  <option key={item} value={item}>
                    {taskStatusLabel(item)}
                  </option>
                ))}
              </AquaSelect>
            ) : null}

            <div className="aqua-field" data-aqua-span="6">
              <span className="aqua-field__label">
                تاريخ التسليم
              </span>
              <AquaDatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="اختر تاريخ التسليم"
              />
            </div>

            <AquaInput
              span={6}
              dir="ltr"
              type="number"
              min="0"
              step="0.25"
              inputMode="decimal"
              label="الساعات المتوقعة"
              value={estimatedHours}
              onChange={(event) =>
                setEstimatedHours(event.target.value)
              }
              className="text-start"
              placeholder="4"
            />

            {scope.canManageSources ? (
              <>
                <AquaSelect
                  span={6}
                  label="المصدر"
                  value={source}
                  onChange={(event) =>
                    setSource(
                      event.target.value as TaskSource
                    )
                  }
                >
                  {taskSources.map((item) => (
                    <option key={item} value={item}>
                      {taskSourceLabel(item)}
                    </option>
                  ))}
                </AquaSelect>

                <AquaInput
                  span={6}
                  dir="ltr"
                  label="مرجع المصدر"
                  value={sourceRef}
                  onChange={(event) =>
                    setSourceRef(event.target.value)
                  }
                  className="text-start"
                  placeholder="REQ-001"
                />
              </>
            ) : null}

            <AquaTextarea
              label="وصف المهمة"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={4}
              placeholder="النتيجة المطلوبة وأي تفاصيل تساعد على التنفيذ."
            />
          </div>

          {error ? (
            <AquaAlert
              variant="danger"
              title="تعذر حفظ المهمة"
              className="mt-3 mb-0"
            >
              {error}
            </AquaAlert>
          ) : null}
        </form>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(pendingArchive)}
        onClose={() => {
          if (!archiveLoading) setPendingArchive(null)
        }}
        onConfirm={async () => {
          if (pendingArchive) {
            await archiveTask(pendingArchive)
          }
        }}
        title={
          pendingArchive?.status === "ARCHIVED"
            ? "استرجاع المهمة"
            : "أرشفة المهمة"
        }
        description={
          pendingArchive?.status === "ARCHIVED"
            ? `ستعود مهمة ${pendingArchive?.title ?? ""} إلى قائمة العمل.`
            : `ستنتقل مهمة ${pendingArchive?.title ?? ""} إلى الأرشيف مع الاحتفاظ بسجلها.`
        }
        confirmLabel={
          pendingArchive?.status === "ARCHIVED"
            ? "استرجاع"
            : "أرشفة"
        }
        confirmVariant="primary"
        tone={
          pendingArchive?.status === "ARCHIVED"
            ? "neutral"
            : "warning"
        }
        loading={archiveLoading}
      />
    </div>
  )
}
