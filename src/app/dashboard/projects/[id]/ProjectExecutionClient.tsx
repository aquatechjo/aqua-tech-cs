"use client"

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  GitBranch,
  ListChecks,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaConfirmDialog,
  AquaDataPanel,
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

import styles from "./ProjectExecution.module.css"

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
  employeeProfile: Employee & {
    user: Employee["user"] & { isActive: boolean }
  }
}

type Phase = {
  id: string
  name: string
  code: string | null
  workflowStageCode: string | null
  description: string | null
  status:
    | "PLANNED"
    | "ACTIVE"
    | "BLOCKED"
    | "COMPLETED"
    | "CANCELLED"
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
  assignedTo: {
    id: string
    name: string
    email: string
  } | null
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
  workflowTaskCode: string | null
  workflowOwnerRole:
    | "PROJECT_LEAD"
    | "MANAGER"
    | "CONTRIBUTOR"
    | "VIEWER"
    | null
  dueDate: string | null
  startedAt: string | null
  completedAt: string | null
  canEdit: boolean
  canManageParticipants: boolean
  canAssignOwner: boolean
  participants: Participant[]
  dependencies: Array<{
    id: string
    type:
      | "FINISH_TO_START"
      | "START_TO_START"
      | "FINISH_TO_FINISH"
      | "START_TO_FINISH"
    dependsOnTaskId: string
    dependsOnTask: {
      id: string
      title: string
      status: string
      progress: number
    }
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
type PendingAction = {
  title: string
  description: string
  endpoint: string
  key: string
  successMessage: string
  tone?: "warning" | "danger" | "neutral"
}

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
const taskPriorityLabels: Record<Task["priority"], string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
}
const participantRoleLabels: Record<
  Participant["role"],
  string
> = {
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
  return value?.slice(0, 10) ?? "دون موعد"
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

function statusVariant(status: string): AquaBadgeVariant {
  if (status === "DONE" || status === "COMPLETED") return "success"
  if (status === "IN_PROGRESS" || status === "ACTIVE") return "aqua"
  if (status === "REVIEW" || status === "ON_HOLD") return "warning"
  if (status === "BLOCKED" || status === "CANCELLED") return "danger"
  if (status === "ARCHIVED") return "muted"
  return "blue"
}

function priorityVariant(priority: Task["priority"]): AquaBadgeVariant {
  if (priority === "URGENT") return "danger"
  if (priority === "HIGH") return "warning"
  if (priority === "MEDIUM") return "blue"
  return "muted"
}

function errorMessage(payload: unknown, fallback: string) {
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

export default function ProjectExecutionClient({
  project,
  workflow,
  scope,
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
    approvalCount: number
    pendingApprovalCount: number
    notificationRuleCount: number
    n8nRuleCount: number
  } | null
  scope: {
    label: string
    dataScope: "personal" | "team" | "company"
    description: string
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
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [phaseModalOpen, setPhaseModalOpen] = useState(false)
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState(
    tasks[0]?.id ?? ""
  )
  const [resolutionByBlocker, setResolutionByBlocker] =
    useState<Record<string, string>>({})
  const [phaseDrafts, setPhaseDrafts] = useState<
    Record<string, PhaseDraft>
  >({})
  const [taskDrafts, setTaskDrafts] = useState<
    Record<string, TaskDraft>
  >({})

  const effectiveSelectedTaskId =
    selectedTaskId &&
    tasks.some((task) => task.id === selectedTaskId)
      ? selectedTaskId
      : (tasks[0]?.id ?? "")
  const selectedTask = useMemo(
    () =>
      tasks.find(
        (task) => task.id === effectiveSelectedTaskId
      ) ?? null,
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
        headers: options.body
          ? { "Content-Type": "application/json" }
          : undefined,
      })
      const payload = (await response
        .json()
        .catch(() => null)) as unknown

      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "تعذر تنفيذ الإجراء")
        )
      }

      setSuccess(successMessage)
      aquaToast.success(successMessage)
      router.refresh()
      return true
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "حدث خطأ غير متوقع"
      setError(message)
      aquaToast.error(message)
      return false
    } finally {
      setBusyKey("")
    }
  }

  async function addMember(
    event: React.FormEvent<HTMLFormElement>
  ) {
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
    if (saved) {
      event.currentTarget.reset()
      setMemberModalOpen(false)
    }
  }

  async function addPhase(
    event: React.FormEvent<HTMLFormElement>
  ) {
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
    if (saved) {
      event.currentTarget.reset()
      setPhaseModalOpen(false)
    }
  }

  async function addParticipant(
    event: React.FormEvent<HTMLFormElement>
  ) {
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

  async function addDependency(
    event: React.FormEvent<HTMLFormElement>
  ) {
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

  async function addBlocker(
    event: React.FormEvent<HTMLFormElement>
  ) {
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

  async function confirmPendingAction() {
    if (!pendingAction) return
    const saved = await mutate(
      pendingAction.key,
      pendingAction.endpoint,
      { method: "DELETE" },
      pendingAction.successMessage
    )
    if (saved) setPendingAction(null)
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.introIcon} aria-hidden="true">
            <FolderKanban />
          </span>
          <div>
            <div className={styles.titleRow}>
              <h1>{project.name}</h1>
              <AquaBadge
                variant={statusVariant(project.status)}
                size="sm"
                dot
              >
                {projectStatusLabel(project.status)}
              </AquaBadge>
              <AquaBadge variant="muted" size="sm">
                {scope.label}
              </AquaBadge>
            </div>
            <p>{scope.description}</p>
          </div>
        </div>
        <div className={styles.introActions}>
          <AquaLinkButton
            href="/dashboard/my-day"
            variant="ghost"
            size="sm"
          >
            يومي
          </AquaLinkButton>
          <AquaLinkButton
            href="/dashboard/projects"
            variant="ghost"
            size="sm"
          >
            كل المشاريع
          </AquaLinkButton>
        </div>
      </section>

      {error ? (
        <AquaAlert variant="danger" title="تعذر تنفيذ الإجراء">
          {error}
        </AquaAlert>
      ) : null}
      {success ? (
        <AquaAlert variant="success">{success}</AquaAlert>
      ) : null}

      {workflow ? (
        <AquaCard padding="sm" className={styles.workflowSummary}>
          <span className={styles.workflowIcon} aria-hidden="true">
            <GitBranch />
          </span>
          <div className={styles.workflowCopy}>
            <div className={styles.workflowTitle}>
              <strong>{workflow.templateName}</strong>
              <AquaBadge variant="aqua" size="sm">
                سير المشروع
              </AquaBadge>
              <AquaBadge variant="muted" size="sm">
                <span dir="ltr">v{workflow.templateVersion}</span>
              </AquaBadge>
            </div>
            <p>
              نسخة مستقلة من القالب؛ المراحل والمهام أدناه هي مسار
              التنفيذ الفعلي لهذا المشروع.
            </p>
          </div>
          <div
            className={styles.workflowStats}
            aria-label="ملخص سير العمل"
          >
            <span>
              <strong>{phases.length}</strong>
              مراحل
            </span>
            <span>
              <strong>{tasks.length}</strong>
              مهام ظاهرة
            </span>
            <span>
              <strong>{workflow.pendingApprovalCount}</strong>
              موافقات متبقية
            </span>
            <span>
              <strong>
                {workflow.notificationRuleCount + workflow.n8nRuleCount}
              </strong>
              قواعد تشغيل
            </span>
          </div>
        </AquaCard>
      ) : null}

      <section className={styles.metrics} aria-label="ملخص التنفيذ">
        {[
          {
            label: "التقدم",
            value: `${summary.progress}%`,
            icon: <FolderKanban />,
            tone: "aqua",
          },
          {
            label: "المهام الظاهرة",
            value: summary.totalTasks,
            icon: <ListChecks />,
            tone: "blue",
          },
          {
            label: "المكتملة",
            value: summary.completedTasks,
            icon: <CheckCircle2 />,
            tone: "success",
          },
          {
            label: "المتعطلة",
            value: summary.blockedTasks,
            icon: <AlertTriangle />,
            tone: "danger",
          },
          {
            label: "العوائق",
            value: summary.openBlockers,
            icon: <ShieldCheck />,
            tone: "warning",
          },
        ].map((metric) => (
          <AquaCard
            key={metric.label}
            padding="sm"
            className={`${styles.metric} ${
              styles[`metric_${metric.tone}`]
            }`}
          >
            <span className={styles.metricIcon}>{metric.icon}</span>
            <div>
              <span>{metric.label}</span>
              <strong dir="ltr">{metric.value}</strong>
            </div>
          </AquaCard>
        ))}
      </section>

      <AquaCard padding="md" className={styles.projectSummary}>
        <div>
          <div className={styles.summaryBadges}>
            {project.code ? (
              <AquaBadge variant="aqua" size="sm">
                <span dir="ltr">{project.code}</span>
              </AquaBadge>
            ) : null}
            <AquaBadge variant="blue" size="sm">
              {project.priority}
            </AquaBadge>
          </div>
          <h2>{project.client?.name ?? "مشروع داخلي"}</h2>
          <p>
            {project.description || "لا يوجد وصف مضاف للمشروع."}
          </p>
        </div>
        <div className={styles.summaryProgress}>
          <span>
            <CalendarClock aria-hidden="true" />
            <bdi dir="ltr">{dateOnly(project.startDate)}</bdi>
            <span aria-hidden="true">—</span>
            <bdi dir="ltr">{dateOnly(project.dueDate)}</bdi>
          </span>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="التقدم العام"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.progress}
          >
            <span
              className={styles.progressValue}
              style={{ inlineSize: `${summary.progress}%` }}
            />
          </div>
        </div>
      </AquaCard>

      <div className={styles.workspaceGrid}>
        <AquaDataPanel
          title="فريق المشروع"
          description="الأعضاء وأدوار التنفيذ."
          meta={
            <AquaBadge variant="muted" size="sm">
              {members.length}
            </AquaBadge>
          }
          actions={
            canManage ? (
              <AquaButton
                size="sm"
                leadingIcon={<UserPlus />}
                onClick={() => setMemberModalOpen(true)}
              >
                إضافة عضو
              </AquaButton>
            ) : null
          }
        >
          <div className={styles.stack}>
            {members.length === 0 ? (
              <div className={styles.empty}>
                لم تتم إضافة أعضاء للمشروع.
              </div>
            ) : (
              members.map((member) => (
                <AquaCard
                  key={member.id}
                  variant="soft"
                  padding="sm"
                  className={styles.memberRow}
                >
                  <div>
                    <strong>
                      {member.employeeProfile.user.name}
                    </strong>
                    <span>
                      {member.employeeProfile.jobRole?.name ??
                        "دون مسمى"}
                      {" · "}
                      {memberRoleLabels[member.role]}
                    </span>
                    {member.responsibility ? (
                      <p>{member.responsibility}</p>
                    ) : null}
                  </div>
                  {canManage &&
                  member.role !== "PROJECT_LEAD" &&
                  (member.role !== "MANAGER" ||
                    canManageLeadership) ? (
                    <AquaButton
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Trash2 />}
                      onClick={() =>
                        setPendingAction({
                          title: "إزالة عضو المشروع",
                          description: `ستتم إزالة ${member.employeeProfile.user.name} من فريق المشروع دون حذف حسابه أو مهامه.`,
                          endpoint: `/api/projects/${project.id}/members/${member.id}`,
                          key: `member-${member.id}`,
                          successMessage:
                            "تمت إزالة عضو المشروع",
                          tone: "warning",
                        })
                      }
                    >
                      إزالة
                    </AquaButton>
                  ) : null}
                </AquaCard>
              ))
            )}
          </div>
        </AquaDataPanel>

        <AquaDataPanel
          title="مراحل التنفيذ"
          description="الحالة ونسبة الإنجاز لكل مرحلة."
          meta={
            <AquaBadge variant="muted" size="sm">
              {phases.length}
            </AquaBadge>
          }
          actions={
            canManage ? (
              <AquaButton
                size="sm"
                leadingIcon={<Plus />}
                onClick={() => setPhaseModalOpen(true)}
              >
                مرحلة جديدة
              </AquaButton>
            ) : null
          }
        >
          <div className={styles.stack}>
            {phases.length === 0 ? (
              <div className={styles.empty}>
                لم تتم إضافة مراحل تنفيذ.
              </div>
            ) : (
              phases.map((phase) => {
                const draft = phaseDrafts[phase.id] ?? {
                  status: phase.status,
                  progress: phase.progress,
                }
                const taskCount = tasks.filter(
                  (task) => task.phaseId === phase.id
                ).length

                return (
                  <AquaCard
                    key={phase.id}
                    variant="soft"
                    padding="sm"
                    className={styles.phaseCard}
                  >
                    <div className={styles.phaseHeading}>
                      <div>
                        <strong>{phase.name}</strong>
                        <span>
                          <bdi dir="ltr">
                            {phase.code || "—"}
                          </bdi>
                          {" · "}
                          {taskCount} مهمة
                        </span>
                      </div>
                      <AquaBadge
                        variant={statusVariant(draft.status)}
                        size="sm"
                      >
                        {phaseStatusLabels[draft.status]}
                      </AquaBadge>
                    </div>
                    <div className={styles.phaseControls}>
                      <label>
                        <span>الحالة</span>
                        <select
                          className="form-select aqua-control aqua-control--sm"
                          value={draft.status}
                          disabled={!canManage}
                          onChange={(event) =>
                            setPhaseDrafts((current) => ({
                              ...current,
                              [phase.id]: {
                                ...draft,
                                status: event.target
                                  .value as Phase["status"],
                              },
                            }))
                          }
                        >
                          {Object.entries(phaseStatusLabels).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <label>
                        <span>الإنجاز %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="form-control aqua-control aqua-control--sm"
                          value={draft.progress}
                          disabled={!canManage}
                          onChange={(event) =>
                            setPhaseDrafts((current) => ({
                              ...current,
                              [phase.id]: {
                                ...draft,
                                progress: Number(
                                  event.target.value
                                ),
                              },
                            }))
                          }
                        />
                      </label>
                      {canManage ? (
                        <div className={styles.phaseActions}>
                          <AquaButton
                            size="sm"
                            loading={
                              busyKey ===
                              `phase-save-${phase.id}`
                            }
                            onClick={() =>
                              mutate(
                                `phase-save-${phase.id}`,
                                `/api/projects/${project.id}/phases/${phase.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify(draft),
                                },
                                "تم تحديث المرحلة"
                              )
                            }
                          >
                            حفظ
                          </AquaButton>
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            disabled={taskCount > 0}
                            leadingIcon={<Trash2 />}
                            title={
                              taskCount > 0
                                ? "انقل مهام المرحلة قبل حذفها"
                                : "حذف المرحلة"
                            }
                            onClick={() =>
                              setPendingAction({
                                title: "حذف المرحلة",
                                description: `سيتم حذف مرحلة «${phase.name}» نهائيًا. لا يمكن حذفها إذا كانت تحتوي مهامًا.`,
                                endpoint: `/api/projects/${project.id}/phases/${phase.id}`,
                                key: `phase-delete-${phase.id}`,
                                successMessage:
                                  "تم حذف المرحلة",
                                tone: "danger",
                              })
                            }
                          >
                            حذف
                          </AquaButton>
                        </div>
                      ) : null}
                    </div>
                  </AquaCard>
                )
              })
            )}
          </div>
        </AquaDataPanel>
      </div>

      <AquaDataPanel
        title="تقدم المهام"
        description="تظهر المهام المسموح لك برؤيتها فقط."
        actions={
          <AquaLinkButton
            href={`/dashboard/tasks?projectId=${project.id}`}
            variant="ghost"
            size="sm"
          >
            فتح قائمة المهام
          </AquaLinkButton>
        }
        flush
      >
        <AquaTable
          density="compact"
          mobileStrategy="stack"
          minWidth="900px"
          caption="مهام المشروع ضمن نطاق المستخدم"
        >
          <thead>
            <tr>
              <th scope="col">المهمة</th>
              <th scope="col">المرحلة</th>
              <th scope="col">الحالة</th>
              <th scope="col">الإنجاز</th>
              <th scope="col">التسليم</th>
              <th scope="col">العوائق</th>
              <th scope="col">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <AquaTableStateRow
                colSpan={7}
                variant="empty"
                icon={<ListChecks />}
                title="لا توجد مهام ظاهرة لك"
                description="ستظهر المهام عند إسنادها إليك أو إلى فريقك حسب صلاحياتك."
              />
            ) : (
              tasks.map((task) => {
                const draft = taskDrafts[task.id] ?? {
                  phaseId: task.phaseId,
                  status: task.status,
                  progress: task.progress,
                }
                const openBlockers = task.blockers.filter(
                  (blocker) => blocker.status === "OPEN"
                ).length

                return (
                  <tr key={task.id}>
                    <td data-label="المهمة">
                      <div className={styles.taskHeading}>
                        <div>
                          <div className="aqua-table__primary">
                            {task.title}
                          </div>
                          <div className="aqua-table__secondary">
                            {task.assignedTo?.name ??
                              (task.workflowOwnerRole
                                ? `بانتظار ${memberRoleLabels[task.workflowOwnerRole]}`
                                : "غير مسندة")}
                          </div>
                        </div>
                        <AquaBadge
                          variant={priorityVariant(task.priority)}
                          size="sm"
                        >
                          {taskPriorityLabels[task.priority]}
                        </AquaBadge>
                      </div>
                    </td>
                    <td data-label="المرحلة">
                      <select
                        className="form-select aqua-control aqua-control--sm"
                        aria-label={`مرحلة ${task.title}`}
                        value={draft.phaseId ?? ""}
                        disabled={!task.canEdit}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...draft,
                              phaseId:
                                event.target.value || null,
                            },
                          }))
                        }
                      >
                        <option value="">دون مرحلة</option>
                        {phases.map((phase) => (
                          <option value={phase.id} key={phase.id}>
                            {phase.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="الحالة">
                      <select
                        className="form-select aqua-control aqua-control--sm"
                        aria-label={`حالة ${task.title}`}
                        value={draft.status}
                        disabled={!task.canEdit}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...draft,
                              status: event.target
                                .value as Task["status"],
                            },
                          }))
                        }
                      >
                        {Object.entries(taskStatusLabels).map(
                          ([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td data-label="الإنجاز">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="form-control aqua-control aqua-control--sm"
                        aria-label={`إنجاز ${task.title}`}
                        value={draft.progress}
                        disabled={!task.canEdit}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...draft,
                              progress: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </td>
                    <td data-label="التسليم">
                      <span dir="ltr">
                        {dateOnly(task.dueDate)}
                      </span>
                    </td>
                    <td data-label="العوائق">
                      <AquaBadge
                        variant={
                          openBlockers > 0 ? "danger" : "success"
                        }
                        size="sm"
                      >
                        {openBlockers}
                      </AquaBadge>
                    </td>
                    <td data-label="الإجراء">
                      <div className="aqua-table__actions">
                        {task.canEdit ? (
                          <AquaButton
                            size="sm"
                            loading={
                              busyKey === `task-save-${task.id}`
                            }
                            onClick={() =>
                              mutate(
                                `task-save-${task.id}`,
                                `/api/tasks/${task.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify(draft),
                                },
                                "تم تحديث المهمة"
                              )
                            }
                          >
                            حفظ
                          </AquaButton>
                        ) : null}
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedTaskId(task.id)
                          }
                        >
                          التفاصيل
                        </AquaButton>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>

      {selectedTask ? (
        <AquaDataPanel
          title={selectedTask.title}
          description={`${selectedTask.phase?.name ?? "دون مرحلة"} · ${
            taskStatusLabels[selectedTask.status]
          } · ${selectedTask.progress}%`}
          actions={
            <AquaSelect
              aria-label="اختيار المهمة"
              value={effectiveSelectedTaskId}
              onChange={(event) =>
                setSelectedTaskId(event.target.value)
              }
              size="sm"
              wrapperClassName={styles.taskPicker}
            >
              {tasks.map((task) => (
                <option value={task.id} key={task.id}>
                  {task.title}
                </option>
              ))}
            </AquaSelect>
          }
        >
          <div className={styles.controlGrid}>
            <AquaCard variant="soft" padding="sm">
              <div className={styles.controlTitle}>
                <UsersRound aria-hidden="true" />
                <h3>المشاركون</h3>
              </div>
              <div className={styles.controlList}>
                {selectedTask.participants.length === 0 ? (
                  <span className={styles.empty}>
                    لا يوجد مشاركون.
                  </span>
                ) : (
                  selectedTask.participants.map((participant) => (
                    <div
                      className={styles.controlRow}
                      key={participant.id}
                    >
                      <div>
                        <strong>
                          {
                            participant.employeeProfile.user
                              .name
                          }
                        </strong>
                        <span>
                          {participantRoleLabels[participant.role]}
                        </span>
                      </div>
                      {selectedTask.canManageParticipants &&
                      (participant.role !== "OWNER" ||
                        selectedTask.canAssignOwner) ? (
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingAction({
                              title: "إزالة المشارك",
                              description: `ستتم إزالة ${participant.employeeProfile.user.name} من هذه المهمة.`,
                              endpoint: `/api/tasks/${selectedTask.id}/participants/${participant.id}`,
                              key: `participant-${participant.id}`,
                              successMessage:
                                "تمت إزالة المشارك",
                              tone: "warning",
                            })
                          }
                        >
                          إزالة
                        </AquaButton>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {selectedTask.canManageParticipants ? (
                <form
                  className={styles.controlForm}
                  onSubmit={addParticipant}
                >
                  <AquaSelect
                    name="employeeProfileId"
                    label="الموظف"
                    required
                    defaultValue=""
                    size="sm"
                  >
                    <option value="" disabled>
                      اختر الموظف
                    </option>
                    {employees.map((employee) => (
                      <option value={employee.id} key={employee.id}>
                        {employee.user.name}
                      </option>
                    ))}
                  </AquaSelect>
                  <AquaSelect
                    name="role"
                    label="الدور"
                    defaultValue="CONTRIBUTOR"
                    size="sm"
                  >
                    {Object.entries(participantRoleLabels)
                      .filter(
                        ([value]) =>
                          selectedTask.canAssignOwner ||
                          value !== "OWNER"
                      )
                      .map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                  </AquaSelect>
                  <AquaButton
                    type="submit"
                    size="sm"
                    loading={busyKey === "participant-add"}
                  >
                    إضافة مشارك
                  </AquaButton>
                </form>
              ) : null}
            </AquaCard>

            <AquaCard variant="soft" padding="sm">
              <div className={styles.controlTitle}>
                <GitBranch aria-hidden="true" />
                <h3>التبعيات</h3>
              </div>
              <div className={styles.controlList}>
                {selectedTask.dependencies.length === 0 ? (
                  <span className={styles.empty}>
                    لا توجد تبعيات.
                  </span>
                ) : (
                  selectedTask.dependencies.map((dependency) => (
                    <div
                      className={styles.controlRow}
                      key={dependency.id}
                    >
                      <div>
                        <strong>
                          {dependency.dependsOnTask.title}
                        </strong>
                        <span>
                          {dependencyTypeLabels[dependency.type]}
                        </span>
                      </div>
                      {selectedTask.canEdit ? (
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingAction({
                              title: "إزالة التبعية",
                              description: `سيتم فك ارتباط المهمة بـ «${dependency.dependsOnTask.title}».`,
                              endpoint: `/api/tasks/${selectedTask.id}/dependencies/${dependency.id}`,
                              key: `dependency-${dependency.id}`,
                              successMessage:
                                "تمت إزالة التبعية",
                              tone: "neutral",
                            })
                          }
                        >
                          إزالة
                        </AquaButton>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {selectedTask.canEdit ? (
                <form
                  className={styles.controlForm}
                  onSubmit={addDependency}
                >
                  <AquaSelect
                    name="dependsOnTaskId"
                    label="المهمة السابقة"
                    required
                    defaultValue=""
                    size="sm"
                  >
                    <option value="" disabled>
                      اختر المهمة
                    </option>
                    {tasks
                      .filter(
                        (task) => task.id !== selectedTask.id
                      )
                      .map((task) => (
                        <option value={task.id} key={task.id}>
                          {task.title}
                        </option>
                      ))}
                  </AquaSelect>
                  <AquaSelect
                    name="type"
                    label="نوع التبعية"
                    defaultValue="FINISH_TO_START"
                    size="sm"
                  >
                    {Object.entries(dependencyTypeLabels).map(
                      ([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      )
                    )}
                  </AquaSelect>
                  <AquaButton
                    type="submit"
                    size="sm"
                    loading={busyKey === "dependency-add"}
                  >
                    إضافة تبعية
                  </AquaButton>
                </form>
              ) : null}
            </AquaCard>

            <AquaCard variant="soft" padding="sm">
              <div className={styles.controlTitle}>
                <AlertTriangle aria-hidden="true" />
                <h3>العوائق</h3>
              </div>
              <div className={styles.controlList}>
                {selectedTask.blockers.length === 0 ? (
                  <span className={styles.empty}>
                    لا توجد عوائق.
                  </span>
                ) : (
                  selectedTask.blockers.map((blocker) => (
                    <div
                      className={styles.blocker}
                      key={blocker.id}
                    >
                      <div className={styles.blockerHeading}>
                        <strong>{blocker.title}</strong>
                        <AquaBadge
                          variant={
                            blocker.status === "OPEN"
                              ? "danger"
                              : "success"
                          }
                          size="sm"
                        >
                          {
                            blockerSeverityLabels[
                              blocker.severity
                            ]
                          }
                        </AquaBadge>
                      </div>
                      {blocker.description ? (
                        <p>{blocker.description}</p>
                      ) : null}
                      {blocker.status === "OPEN" &&
                      selectedTask.canEdit ? (
                        <div className={styles.resolveRow}>
                          <input
                            className="form-control aqua-control aqua-control--sm"
                            placeholder="طريقة المعالجة"
                            value={
                              resolutionByBlocker[blocker.id] ??
                              ""
                            }
                            onChange={(event) =>
                              setResolutionByBlocker(
                                (current) => ({
                                  ...current,
                                  [blocker.id]:
                                    event.target.value,
                                })
                              )
                            }
                          />
                          <AquaButton
                            size="sm"
                            loading={
                              busyKey === `blocker-${blocker.id}`
                            }
                            onClick={() =>
                              mutate(
                                `blocker-${blocker.id}`,
                                `/api/tasks/${selectedTask.id}/blockers/${blocker.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    status: "RESOLVED",
                                    resolution:
                                      resolutionByBlocker[
                                        blocker.id
                                      ],
                                  }),
                                },
                                "تمت معالجة العائق"
                              )
                            }
                          >
                            إغلاق
                          </AquaButton>
                        </div>
                      ) : blocker.resolution ? (
                        <span>
                          المعالجة: {blocker.resolution}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              {selectedTask.canEdit ? (
                <form
                  className={styles.controlForm}
                  onSubmit={addBlocker}
                >
                  <AquaInput
                    name="title"
                    label="عنوان العائق"
                    required
                    size="sm"
                  />
                  <AquaTextarea
                    name="description"
                    label="التفاصيل"
                    rows={2}
                    size="sm"
                  />
                  <AquaSelect
                    name="severity"
                    label="الحدة"
                    defaultValue="MEDIUM"
                    size="sm"
                  >
                    {Object.entries(blockerSeverityLabels).map(
                      ([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      )
                    )}
                  </AquaSelect>
                  <AquaButton
                    type="submit"
                    size="sm"
                    loading={busyKey === "blocker-add"}
                  >
                    تسجيل عائق
                  </AquaButton>
                </form>
              ) : null}
            </AquaCard>
          </div>
        </AquaDataPanel>
      ) : null}

      <AquaModal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title="إضافة عضو للمشروع"
        description="القائمة مقيدة بالموظفين المسموح لك بإدارتهم."
        size="sm"
        closeOnBackdrop={busyKey !== "member-add"}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setMemberModalOpen(false)}
              disabled={busyKey === "member-add"}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-member-form"
              loading={busyKey === "member-add"}
            >
              حفظ العضو
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-member-form"
          className={styles.modalForm}
          onSubmit={addMember}
        >
          <AquaSelect
            name="employeeProfileId"
            label="الموظف"
            required
            defaultValue=""
            data-aqua-autofocus
          >
            <option value="" disabled>
              اختر الموظف
            </option>
            {employees.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.user.name} —{" "}
                {employee.jobRole?.name ?? "دون مسمى"}
              </option>
            ))}
          </AquaSelect>
          <AquaSelect
            name="role"
            label="الدور داخل المشروع"
            defaultValue="CONTRIBUTOR"
          >
            {Object.entries(memberRoleLabels)
              .filter(
                ([value]) =>
                  canManageLeadership ||
                  (value !== "PROJECT_LEAD" &&
                    value !== "MANAGER")
              )
              .map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
          </AquaSelect>
          <AquaInput
            name="responsibility"
            label="المسؤولية"
            placeholder="مثال: واجهة المستخدم"
          />
        </form>
      </AquaModal>

      <AquaModal
        open={phaseModalOpen}
        onClose={() => setPhaseModalOpen(false)}
        title="مرحلة تنفيذ جديدة"
        description="أضف المرحلة ومواعيدها وترتيبها داخل المشروع."
        size="md"
        closeOnBackdrop={busyKey !== "phase-add"}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setPhaseModalOpen(false)}
              disabled={busyKey === "phase-add"}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-phase-form"
              loading={busyKey === "phase-add"}
            >
              إضافة المرحلة
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-phase-form"
          className={styles.modalForm}
          onSubmit={addPhase}
        >
          <AquaInput
            name="name"
            label="اسم المرحلة"
            required
            data-aqua-autofocus
          />
          <AquaInput
            name="code"
            label="الرمز"
            placeholder="DISCOVERY"
            dir="ltr"
          />
          <AquaSelect
            name="status"
            label="الحالة"
            defaultValue="PLANNED"
          >
            {Object.entries(phaseStatusLabels).map(
              ([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              )
            )}
          </AquaSelect>
          <AquaInput
            name="sortOrder"
            label="الترتيب"
            type="number"
            min={0}
            defaultValue={phases.length * 10}
            dir="ltr"
          />
          <AquaInput
            name="startDate"
            label="تاريخ البداية"
            type="date"
            dir="ltr"
          />
          <AquaInput
            name="dueDate"
            label="تاريخ النهاية"
            type="date"
            dir="ltr"
          />
        </form>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!busyKey) setPendingAction(null)
        }}
        onConfirm={confirmPendingAction}
        loading={Boolean(pendingAction && busyKey)}
        title={pendingAction?.title ?? "تأكيد الإجراء"}
        description={pendingAction?.description ?? ""}
        confirmLabel="تأكيد"
        confirmVariant={
          pendingAction?.tone === "danger" ? "danger" : "primary"
        }
        tone={pendingAction?.tone ?? "warning"}
      />
    </div>
  )
}
