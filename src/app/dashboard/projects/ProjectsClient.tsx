"use client"

import {
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Edit3,
  ExternalLink,
  FolderKanban,
  GitBranch,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
  UsersRound,
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
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/enums"

import styles from "./Projects.module.css"

type ClientOption = {
  id: string
  name: string
}

type WorkflowTemplateOption = {
  id: string
  name: string
  code: string
  description: string | null
  version: number
  isDefault: boolean
  stageCount: number
  taskCount: number
  approvalCount: number
  ruleCount: number
}

type ProjectItem = {
  id: string
  clientId: string | null
  client: ClientOption | null
  name: string
  code: string | null
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  budget: string | null
  budgetDisplay: string | null
  currency: string
  startDate: string | null
  dueDate: string | null
  dueDisplay: string
  isOverdue: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
  progress: number
  totalTasks: number
  completedTasks: number
  memberCount: number
  openBlockers: number
  canEdit: boolean
  workflow: {
    templateName: string
    templateCode: string
    templateVersion: number
    status:
      | "NOT_STARTED"
      | "ACTIVE"
      | "PAUSED"
      | "COMPLETED"
      | "CANCELLED"
  } | null
}

type Filters = {
  q: string
  status: string
  priority: string
  clientId: string
}

type Stats = {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  overdueProjects: number
  filteredProjects: number
  from: number
  to: number
  currentPage: number
  totalPages: number
}

type Scope = {
  label: string
  description: string
  dataScope: "personal" | "team" | "company"
  canCreate: boolean
}

const projectStatuses: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]
const projectPriorities: ProjectPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

function projectStatusLabel(status: ProjectStatus) {
  return (
    {
      PLANNING: "تخطيط",
      IN_PROGRESS: "قيد التنفيذ",
      ON_HOLD: "معلّق",
      COMPLETED: "مكتمل",
      CANCELLED: "ملغي",
      ARCHIVED: "مؤرشف",
    } satisfies Record<ProjectStatus, string>
  )[status]
}

function projectPriorityLabel(priority: ProjectPriority) {
  return (
    {
      LOW: "منخفضة",
      MEDIUM: "متوسطة",
      HIGH: "عالية",
      URGENT: "عاجلة",
    } satisfies Record<ProjectPriority, string>
  )[priority]
}

function statusVariant(status: ProjectStatus): AquaBadgeVariant {
  if (status === "COMPLETED") return "success"
  if (status === "IN_PROGRESS") return "aqua"
  if (status === "ON_HOLD") return "warning"
  if (status === "CANCELLED") return "danger"
  if (status === "ARCHIVED") return "muted"
  return "blue"
}

function priorityVariant(
  priority: ProjectPriority
): AquaBadgeVariant {
  if (priority === "URGENT") return "danger"
  if (priority === "HIGH") return "warning"
  if (priority === "MEDIUM") return "blue"
  return "muted"
}

function dateInputValue(value: string | null) {
  return value?.slice(0, 10) ?? ""
}

function responseMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message
  }

  return fallback
}

export default function ProjectsClient({
  projects,
  clients,
  workflowTemplates,
  scope,
  filters,
  stats,
  pagination,
}: {
  projects: ProjectItem[]
  clients: ClientOption[]
  workflowTemplates: WorkflowTemplateOption[]
  scope: Scope
  filters: Filters
  stats: Stats
  pagination: React.ReactNode
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(
    null
  )
  const [pendingArchive, setPendingArchive] =
    useState<ProjectItem | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [busyProjectId, setBusyProjectId] =
    useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [clientId, setClientId] = useState("")
  const [workflowTemplateId, setWorkflowTemplateId] = useState(
    workflowTemplates.find((template) => template.isDefault)?.id ??
      workflowTemplates[0]?.id ??
      ""
  )
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] =
    useState<ProjectStatus>("PLANNING")
  const [priority, setPriority] =
    useState<ProjectPriority>("MEDIUM")
  const [budget, setBudget] = useState("")
  const [currency, setCurrency] = useState("JOD")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")

  const activeFilterCount = [
    filters.q,
    filters.status,
    filters.priority,
    filters.clientId,
  ].filter(Boolean).length
  const isEditing = Boolean(editingId)
  const selectedWorkflowTemplate = workflowTemplates.find(
    (template) => template.id === workflowTemplateId
  )
  const progressColumnLabel =
    scope.dataScope === "company"
      ? "التقدم"
      : scope.dataScope === "team"
        ? "تقدم الفريق"
        : "تقدمي"

  function clearForm() {
    setEditingId(null)
    setClientId("")
    setWorkflowTemplateId(
      workflowTemplates.find((template) => template.isDefault)?.id ??
        workflowTemplates[0]?.id ??
        ""
    )
    setName("")
    setCode("")
    setDescription("")
    setStatus("PLANNING")
    setPriority("MEDIUM")
    setBudget("")
    setCurrency("JOD")
    setStartDate("")
    setDueDate("")
    setError("")
  }

  function closeModal() {
    if (loading) return
    setModalOpen(false)
    clearForm()
  }

  function openCreate() {
    clearForm()
    setModalOpen(true)
  }

  function openEdit(project: ProjectItem) {
    setEditingId(project.id)
    setClientId(project.clientId ?? "")
    setName(project.name)
    setCode(project.code ?? "")
    setDescription(project.description ?? "")
    setStatus(project.status)
    setPriority(project.priority)
    setBudget(project.budget ?? "")
    setCurrency(project.currency)
    setStartDate(dateInputValue(project.startDate))
    setDueDate(dateInputValue(project.dueDate))
    setError("")
    setModalOpen(true)
  }

  async function submitProject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isEditing
        ? `/api/projects/${editingId}`
        : "/api/projects"
      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(!isEditing ? { workflowTemplateId } : {}),
          clientId: clientId || null,
          name,
          code,
          description,
          status,
          priority,
          budget,
          currency,
          startDate: startDate || null,
          dueDate: dueDate || null,
        }),
      })
      const payload = (await response
        .json()
        .catch(() => null)) as unknown

      if (!response.ok) {
        setError(
          responseMessage(payload, "فشل حفظ بيانات المشروع")
        )
        return
      }

      aquaToast.success(
        isEditing ? "تم تحديث المشروع" : "تم إنشاء المشروع"
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

  async function updateProjectStatus(
    project: ProjectItem,
    nextStatus: ProjectStatus
  ) {
    setBusyProjectId(project.id)

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })
      const payload = (await response
        .json()
        .catch(() => null)) as unknown

      if (!response.ok) {
        aquaToast.error(
          responseMessage(payload, "فشل تعديل حالة المشروع")
        )
        return false
      }

      aquaToast.success("تم تحديث حالة المشروع")
      router.refresh()
      return true
    } catch {
      aquaToast.error("حدث خطأ أثناء الاتصال بالخادم")
      return false
    } finally {
      setBusyProjectId(null)
    }
  }

  async function confirmArchive() {
    if (!pendingArchive) return
    setArchiveLoading(true)

    const nextStatus =
      pendingArchive.status === "ARCHIVED"
        ? pendingArchive.startDate
          ? "IN_PROGRESS"
          : "PLANNING"
        : "ARCHIVED"
    const saved = await updateProjectStatus(
      pendingArchive,
      nextStatus
    )

    if (saved) setPendingArchive(null)
    setArchiveLoading(false)
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.introIcon} aria-hidden="true">
            <FolderKanban />
          </span>
          <div>
            <div className={styles.introTitleRow}>
              <h1 className={styles.introTitle}>المشاريع</h1>
              <AquaBadge
                variant={
                  scope.dataScope === "company" ? "blue" : "aqua"
                }
                size="sm"
                dot
              >
                {scope.label}
              </AquaBadge>
            </div>
            <p className={styles.introDescription}>
              {scope.description} راقب التسليم والتقدم والعوائق
              من مساحة تشغيل واحدة.
            </p>
          </div>
        </div>

        <div className={styles.introActions}>
          <AquaLinkButton
            href="/dashboard/tasks"
            variant="ghost"
            size="sm"
            leadingIcon={<ListChecks />}
          >
            المهام
          </AquaLinkButton>
          {scope.canCreate ? (
            <AquaButton
              size="sm"
              leadingIcon={<Plus />}
              onClick={openCreate}
            >
              مشروع جديد
            </AquaButton>
          ) : null}
        </div>
      </section>

      <section
        className={styles.metrics}
        aria-label="ملخص المشاريع"
      >
        {[
          {
            label: "كل المشاريع",
            value: stats.totalProjects,
            hint: scope.label,
            icon: <BriefcaseBusiness />,
            tone: "blue",
          },
          {
            label: "قيد العمل",
            value: stats.activeProjects,
            hint: "تخطيط وتنفيذ وتعليق",
            icon: <FolderKanban />,
            tone: "aqua",
          },
          {
            label: "متأخرة",
            value: stats.overdueProjects,
            hint: "تحتاج متابعة موعد التسليم",
            icon: <CircleAlert />,
            tone: "danger",
          },
          {
            label: "مكتملة",
            value: stats.completedProjects,
            hint: "مشاريع منجزة",
            icon: <CheckCircle2 />,
            tone: "success",
          },
        ].map((metric) => (
          <AquaCard
            key={metric.label}
            padding="sm"
            className={`${styles.metric} ${
              styles[`metric_${metric.tone}`]
            }`}
          >
            <span className={styles.metricIcon} aria-hidden="true">
              {metric.icon}
            </span>
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
        ))}
      </section>

      <AquaFilterBar
        action="/dashboard/projects"
        method="get"
        activeCount={activeFilterCount}
        description="ابحث ضمن المشاريع الظاهرة لك حسب نطاق صلاحياتك."
        actions={
          activeFilterCount > 0 ? (
            <AquaLinkButton
              href="/dashboard/projects"
              variant="ghost"
              size="sm"
            >
              مسح الفلاتر
            </AquaLinkButton>
          ) : null
        }
      >
        <AquaInput
          name="q"
          label="بحث"
          defaultValue={filters.q}
          placeholder="الاسم أو الكود أو الوصف"
          span={4}
        />
        <AquaSelect
          name="status"
          label="الحالة"
          defaultValue={filters.status}
          span={2}
        >
          <option value="">كل الحالات</option>
          {projectStatuses.map((item) => (
            <option key={item} value={item}>
              {projectStatusLabel(item)}
            </option>
          ))}
        </AquaSelect>
        <AquaSelect
          name="priority"
          label="الأولوية"
          defaultValue={filters.priority}
          span={2}
        >
          <option value="">كل الأولويات</option>
          {projectPriorities.map((item) => (
            <option key={item} value={item}>
              {projectPriorityLabel(item)}
            </option>
          ))}
        </AquaSelect>
        <AquaSelect
          name="clientId"
          label="العميل"
          defaultValue={filters.clientId}
          span={2}
        >
          <option value="">كل العملاء</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </AquaSelect>
        <div
          className={styles.filterSubmit}
          data-aqua-span="2"
        >
          <AquaButton
            type="submit"
            fullWidth
            leadingIcon={<Search />}
          >
            تطبيق
          </AquaButton>
        </div>
      </AquaFilterBar>

      <AquaDataPanel
        title="قائمة المشاريع"
        description={
          stats.filteredProjects === stats.totalProjects
            ? `عرض ${stats.from}–${stats.to} من ${stats.totalProjects}`
            : `عرض ${stats.from}–${stats.to} من ${stats.filteredProjects} نتيجة`
        }
        meta={
          stats.totalPages > 1 ? (
            <AquaBadge variant="muted" size="sm">
              صفحة {stats.currentPage} من {stats.totalPages}
            </AquaBadge>
          ) : null
        }
        footer={pagination}
        flush
      >
        <AquaTable
          density="compact"
          mobileStrategy="stack"
          minWidth="920px"
          caption="مشاريع المستخدم حسب نطاق الصلاحيات"
        >
          <thead>
            <tr>
              <th scope="col">المشروع</th>
              <th scope="col">الحالة</th>
              <th scope="col">{progressColumnLabel}</th>
              <th scope="col">التسليم</th>
              <th scope="col">التنفيذ</th>
              <th scope="col">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <AquaTableStateRow
                colSpan={6}
                variant="empty"
                icon={<FolderKanban />}
                title="لا توجد مشاريع ضمن هذا النطاق"
                description={
                  activeFilterCount > 0
                    ? "غيّر الفلاتر أو امسحها لعرض نتائج أخرى."
                    : scope.canCreate
                      ? "أنشئ أول مشروع لبدء تنظيم التنفيذ."
                      : "ستظهر المشاريع عند إضافتك إلى فريقها أو إسناد مهمة منها إليك."
                }
              />
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td data-label="المشروع">
                    <div className={styles.projectHeading}>
                      <div>
                        <div className="aqua-table__primary">
                          {project.name}
                        </div>
                        <div className="aqua-table__secondary">
                          {project.client?.name ?? "مشروع داخلي"}
                          {project.code ? (
                            <>
                              {" · "}
                              <span dir="ltr">{project.code}</span>
                            </>
                          ) : null}
                        </div>
                        {project.budgetDisplay ? (
                          <div
                            className="aqua-table__secondary"
                            dir="ltr"
                          >
                            {project.budgetDisplay}
                          </div>
                        ) : null}
                        {project.workflow ? (
                          <div className={styles.workflowLine}>
                            <GitBranch aria-hidden="true" />
                            <span>{project.workflow.templateName}</span>
                            <span dir="ltr">
                              v{project.workflow.templateVersion}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <AquaBadge
                        variant={priorityVariant(project.priority)}
                        size="sm"
                      >
                        {projectPriorityLabel(project.priority)}
                      </AquaBadge>
                    </div>
                  </td>
                  <td data-label="الحالة">
                    <AquaBadge
                      variant={statusVariant(project.status)}
                      size="sm"
                      dot
                    >
                      {projectStatusLabel(project.status)}
                    </AquaBadge>
                    {project.openBlockers > 0 ? (
                      <div className={styles.inlineAlert}>
                        {project.openBlockers} عائق مفتوح
                      </div>
                    ) : null}
                  </td>
                  <td data-label="التقدم">
                    <div className={styles.progressLabel}>
                      <span dir="ltr">{project.progress}%</span>
                      <span>
                        {project.completedTasks}/{project.totalTasks}
                      </span>
                    </div>
                    <div
                      className={styles.progressTrack}
                      role="progressbar"
                      aria-label={`تقدم مشروع ${project.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={project.progress}
                    >
                      <span
                        className={styles.progressValue}
                        style={{
                          inlineSize: `${project.progress}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td data-label="التسليم">
                    <div
                      className={
                        project.isOverdue
                          ? styles.overdueDate
                          : "aqua-table__secondary"
                      }
                    >
                      {project.dueDisplay}
                    </div>
                    {project.isOverdue ? (
                      <AquaBadge variant="danger" size="sm">
                        متأخر
                      </AquaBadge>
                    ) : null}
                  </td>
                  <td data-label="التنفيذ">
                    <div className={styles.executionMeta}>
                      <span>
                        <UsersRound aria-hidden="true" />
                        {project.memberCount}
                      </span>
                      <span>
                        <ListChecks aria-hidden="true" />
                        {project.totalTasks}
                      </span>
                    </div>
                  </td>
                  <td data-label="الإجراءات">
                    <div className="aqua-table__actions">
                      <AquaLinkButton
                        href={`/dashboard/projects/${project.id}`}
                        size="sm"
                        leadingIcon={<ExternalLink />}
                      >
                        فتح
                      </AquaLinkButton>
                      {project.canEdit ? (
                        <>
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Edit3 />}
                            onClick={() => openEdit(project)}
                          >
                            تعديل
                          </AquaButton>
                          {project.status !== "COMPLETED" &&
                          project.status !== "ARCHIVED" ? (
                            <AquaButton
                              variant="ghost"
                              size="sm"
                              loading={
                                busyProjectId === project.id
                              }
                              leadingIcon={<CheckCircle2 />}
                              onClick={() =>
                                updateProjectStatus(
                                  project,
                                  "COMPLETED"
                                )
                              }
                            >
                              إكمال
                            </AquaButton>
                          ) : null}
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            leadingIcon={
                              project.status === "ARCHIVED" ? (
                                <RotateCcw />
                              ) : (
                                <Archive />
                              )
                            }
                            onClick={() =>
                              setPendingArchive(project)
                            }
                          >
                            {project.status === "ARCHIVED"
                              ? "استرجاع"
                              : "أرشفة"}
                          </AquaButton>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>

      <AquaModal
        open={modalOpen}
        onClose={closeModal}
        title={isEditing ? "تعديل المشروع" : "مشروع جديد"}
        description={
          isEditing
            ? "حدّث بيانات المشروع. سير العمل المنسوخ يبقى مستقلًا عن القالب."
            : "اختر قالب سير العمل ثم أضف بيانات المشروع؛ ستُنشأ المراحل والمهام تلقائيًا."
        }
        size="xl"
        className={styles.projectModal}
        closeOnBackdrop={!loading}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={closeModal}
              disabled={loading}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-form"
              loading={loading}
              disabled={!isEditing && workflowTemplates.length === 0}
              loadingLabel="جارٍ الحفظ"
            >
              {isEditing ? "حفظ التعديلات" : "إنشاء المشروع"}
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-form"
          className={styles.projectForm}
          onSubmit={submitProject}
        >
          {error ? (
            <AquaAlert variant="danger" title="تعذر الحفظ">
              {error}
            </AquaAlert>
          ) : null}

          {!isEditing ? (
            <AquaAlert
              variant="info"
              title="يبدأ المشروع في التخطيط"
            >
              يُنشأ المشروع وسير العمل دون بدء التنفيذ. فعّله من بوابة
              الجاهزية بعد توثيق شروط العقد والدفعة المطلوبة.
            </AquaAlert>
          ) : null}

          <div className="aqua-form-grid">
            {isEditing ? (
              <div
                className={styles.workflowLocked}
                data-aqua-span="12"
              >
                <span className={styles.workflowIcon} aria-hidden="true">
                  <GitBranch />
                </span>
                <div>
                  <strong>
                    {projects.find((project) => project.id === editingId)
                      ?.workflow?.templateName ?? "سير المشروع الحالي"}
                  </strong>
                  <p>
                    تعديل القالب الأصلي لا يغيّر مراحل أو مهام هذا المشروع.
                  </p>
                </div>
              </div>
            ) : workflowTemplates.length > 0 ? (
              <>
                <AquaSelect
                  label="قالب سير العمل"
                  value={workflowTemplateId}
                  onChange={(event) =>
                    setWorkflowTemplateId(event.target.value)
                  }
                  required
                  span={12}
                >
                  {workflowTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.isDefault ? " — الافتراضي" : ""}
                    </option>
                  ))}
                </AquaSelect>
                {selectedWorkflowTemplate ? (
                  <div
                    className={styles.workflowPreview}
                    data-aqua-span="12"
                  >
                    <span
                      className={styles.workflowIcon}
                      aria-hidden="true"
                    >
                      <GitBranch />
                    </span>
                    <div className={styles.workflowPreviewCopy}>
                      <div className={styles.workflowPreviewTitle}>
                        <strong>{selectedWorkflowTemplate.name}</strong>
                        <AquaBadge variant="aqua" size="sm">
                          نسخة مستقلة
                        </AquaBadge>
                      </div>
                      <p>
                        {selectedWorkflowTemplate.description ??
                          "سيتم إنشاء مراحل ومهام المشروع من هذا القالب."}
                      </p>
                      <div className={styles.workflowCounts}>
                        <span>
                          {selectedWorkflowTemplate.stageCount} مراحل
                        </span>
                        <span>
                          {selectedWorkflowTemplate.taskCount} مهام
                        </span>
                        <span>
                          {selectedWorkflowTemplate.approvalCount} موافقات
                        </span>
                        <span>
                          {selectedWorkflowTemplate.ruleCount} قواعد تنبيه
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div data-aqua-span="12">
                <AquaAlert
                  variant="warning"
                  title="لا يوجد قالب سير عمل مفعّل"
                >
                  يجب تفعيل قالب واحد على الأقل قبل إنشاء المشروع.
                </AquaAlert>
              </div>
            )}
            <AquaInput
              label="اسم المشروع"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: منصة العميل"
              required
              span={6}
              data-aqua-autofocus
            />
            <AquaInput
              label="كود المشروع"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="AQ-001"
              dir="ltr"
              span={3}
            />
            <AquaSelect
              label="العميل"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              span={3}
            >
              <option value="">مشروع داخلي</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </AquaSelect>
            <AquaSelect
              label="الحالة"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ProjectStatus)
              }
              span={3}
            >
              {(isEditing
                ? status === "PLANNING"
                  ? projectStatuses.filter((item) =>
                      ["PLANNING", "CANCELLED", "ARCHIVED"].includes(
                        item,
                      ),
                    )
                  : projectStatuses
                : ["PLANNING"] as ProjectStatus[]
              ).map((item) => (
                <option key={item} value={item}>
                  {projectStatusLabel(item)}
                </option>
              ))}
            </AquaSelect>
            <AquaSelect
              label="الأولوية"
              value={priority}
              onChange={(event) =>
                setPriority(
                  event.target.value as ProjectPriority
                )
              }
              span={3}
            >
              {projectPriorities.map((item) => (
                <option key={item} value={item}>
                  {projectPriorityLabel(item)}
                </option>
              ))}
            </AquaSelect>
            <AquaInput
              label="الميزانية"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="1200"
              inputMode="decimal"
              dir="ltr"
              span={3}
            />
            <AquaInput
              label="العملة"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              placeholder="JOD"
              maxLength={3}
              dir="ltr"
              span={3}
            />
            <div className={styles.dateField} data-aqua-span="6">
              <label>تاريخ البداية</label>
              <AquaDatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="اختر تاريخ البداية"
              />
            </div>
            <div className={styles.dateField} data-aqua-span="6">
              <label>تاريخ التسليم</label>
              <AquaDatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="اختر تاريخ التسليم"
              />
            </div>
            <AquaTextarea
              label="وصف المشروع"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={3}
              placeholder="النتيجة المطلوبة ونطاق العمل"
              span={12}
            />
          </div>
        </form>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(pendingArchive)}
        onClose={() => {
          if (!archiveLoading) setPendingArchive(null)
        }}
        onConfirm={confirmArchive}
        loading={archiveLoading}
        title={
          pendingArchive?.status === "ARCHIVED"
            ? "استرجاع المشروع"
            : "أرشفة المشروع"
        }
        description={
          pendingArchive?.status === "ARCHIVED"
            ? pendingArchive.startDate
              ? `سيعود مشروع «${pendingArchive?.name ?? ""}» إلى حالة قيد التنفيذ.`
              : `سيعود مشروع «${pendingArchive?.name ?? ""}» إلى حالة التخطيط دون بدء التنفيذ.`
            : `سيختفي مشروع «${pendingArchive?.name ?? ""}» من قوائم العمل النشطة مع بقاء بياناته محفوظة.`
        }
        confirmLabel={
          pendingArchive?.status === "ARCHIVED"
            ? "استرجاع"
            : "أرشفة"
        }
        tone={
          pendingArchive?.status === "ARCHIVED"
            ? "neutral"
            : "warning"
        }
      />
    </div>
  )
}
