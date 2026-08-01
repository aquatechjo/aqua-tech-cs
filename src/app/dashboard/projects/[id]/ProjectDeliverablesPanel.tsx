"use client"

import {
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaInput,
  AquaModal,
  AquaSelect,
  AquaTextarea,
  aquaToast,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"

import styles from "./ProjectDeliverablesPanel.module.css"

export type ProjectDeliverableView = {
  id: string
  title: string
  description: string | null
  acceptanceCriteria: string | null
  status:
    | "PLANNED"
    | "IN_PROGRESS"
    | "READY_FOR_REVIEW"
    | "CHANGES_REQUESTED"
    | "ACCEPTED"
    | "CANCELLED"
  source: "ACCEPTED_PROPOSAL" | "CHANGE_REQUEST" | "MANUAL"
  sortOrder: number
  dueDate: string | null
  submittedAt: string | null
  decidedAt: string | null
  reviewNotes: string | null
  acceptanceReference: string | null
  phaseId: string | null
  phase: { id: string; name: string } | null
  decidedBy: { id: string; name: string } | null
}

type PhaseOption = {
  id: string
  name: string
}

type TransitionTarget = ProjectDeliverableView["status"]

type TransitionState = {
  deliverable: ProjectDeliverableView
  status: TransitionTarget
} | null

const statusCopy: Record<
  ProjectDeliverableView["status"],
  { label: string; variant: AquaBadgeVariant }
> = {
  PLANNED: { label: "مخطط", variant: "muted" },
  IN_PROGRESS: { label: "قيد التنفيذ", variant: "blue" },
  READY_FOR_REVIEW: { label: "جاهز للمراجعة", variant: "warning" },
  CHANGES_REQUESTED: { label: "تعديلات مطلوبة", variant: "danger" },
  ACCEPTED: { label: "معتمد", variant: "success" },
  CANCELLED: { label: "ملغي", variant: "muted" },
}

const transitionCopy: Record<
  TransitionTarget,
  { title: string; button: string; description: string }
> = {
  PLANNED: {
    title: "إرجاع التسليم إلى التخطيط",
    button: "إرجاع للتخطيط",
    description: "سيعود التسليم إلى حالة التخطيط دون حذف سجله.",
  },
  IN_PROGRESS: {
    title: "بدء أو استئناف التنفيذ",
    button: "بدء التنفيذ",
    description: "سيظهر التسليم كعمل نشط ضمن المشروع.",
  },
  READY_FOR_REVIEW: {
    title: "إرسال التسليم للمراجعة",
    button: "جاهز للمراجعة",
    description: "أكد أن المخرج جاهز للفحص وفق معايير القبول.",
  },
  CHANGES_REQUESTED: {
    title: "طلب تعديلات على التسليم",
    button: "طلب تعديلات",
    description: "الملاحظة إلزامية حتى يعرف الفريق المطلوب تعديله.",
  },
  ACCEPTED: {
    title: "اعتماد التسليم",
    button: "اعتماد التسليم",
    description: "سجل مرجع الاعتماد الخارجي مثل البريد أو محضر الاجتماع.",
  },
  CANCELLED: {
    title: "إلغاء التسليم",
    button: "إلغاء التسليم",
    description: "الإلغاء لا يحذف نطاق العرض ويحتاج سببًا موثقًا.",
  },
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

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "—"
}

function transitionsFor(
  deliverable: ProjectDeliverableView,
): TransitionTarget[] {
  const cancellable = deliverable.source === "MANUAL"
    ? (["CANCELLED"] as const)
    : []

  if (deliverable.status === "PLANNED") {
    return ["IN_PROGRESS", ...cancellable]
  }
  if (deliverable.status === "IN_PROGRESS") {
    return ["READY_FOR_REVIEW", "PLANNED", ...cancellable]
  }
  if (deliverable.status === "READY_FOR_REVIEW") {
    return [
      "ACCEPTED",
      "CHANGES_REQUESTED",
      "IN_PROGRESS",
      ...cancellable,
    ]
  }
  if (deliverable.status === "CHANGES_REQUESTED") {
    return ["IN_PROGRESS", ...cancellable]
  }
  return []
}

function transitionIcon(status: TransitionTarget) {
  if (status === "IN_PROGRESS") return <Play />
  if (status === "READY_FOR_REVIEW") return <Send />
  if (status === "ACCEPTED") return <CheckCircle2 />
  if (status === "CHANGES_REQUESTED") return <RotateCcw />
  if (status === "CANCELLED") return <XCircle />
  return <ClipboardCheck />
}

export default function ProjectDeliverablesPanel({
  projectId,
  deliverables,
  phases,
  canManage,
  executionActivated,
}: {
  projectId: string
  deliverables: ProjectDeliverableView[]
  phases: PhaseOption[]
  canManage: boolean
  executionActivated: boolean
}) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editDeliverable, setEditDeliverable] =
    useState<ProjectDeliverableView | null>(null)
  const [transition, setTransition] =
    useState<TransitionState>(null)
  const [deleteDeliverable, setDeleteDeliverable] =
    useState<ProjectDeliverableView | null>(null)

  const summary = useMemo(
    () => ({
      accepted: deliverables.filter(
        (deliverable) => deliverable.status === "ACCEPTED",
      ).length,
      review: deliverables.filter(
        (deliverable) =>
          deliverable.status === "READY_FOR_REVIEW" ||
          deliverable.status === "CHANGES_REQUESTED",
      ).length,
    }),
    [deliverables],
  )

  async function mutate(
    key: string,
    endpoint: string,
    options: RequestInit,
    message: string,
  ) {
    setBusyKey(key)
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
        throw new Error(errorMessage(payload, "تعذر تنفيذ الإجراء"))
      }

      aquaToast.success(message)
      router.refresh()
      return true
    } catch (error) {
      aquaToast.error(
        error instanceof Error ? error.message : "حدث خطأ غير متوقع",
      )
      return false
    } finally {
      setBusyKey("")
    }
  }

  async function createDeliverable(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const saved = await mutate(
      "deliverable-create",
      `/api/projects/${projectId}/deliverables`,
      {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description") || null,
          acceptanceCriteria:
            form.get("acceptanceCriteria") || null,
          phaseId: form.get("phaseId") || null,
          dueDate: form.get("dueDate") || null,
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      },
      "تمت إضافة التسليم",
    )
    if (saved) {
      formElement.reset()
      setAddOpen(false)
    }
  }

  async function updateDeliverable(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!editDeliverable) return
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      `deliverable-update-${editDeliverable.id}`,
      `/api/projects/${projectId}/deliverables/${editDeliverable.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "UPDATE_DETAILS",
          title: form.get("title"),
          description: form.get("description") || null,
          acceptanceCriteria:
            form.get("acceptanceCriteria") || null,
          phaseId: form.get("phaseId") || null,
          dueDate: form.get("dueDate") || null,
          sortOrder: Number(form.get("sortOrder") || 0),
        }),
      },
      "تم تحديث التسليم",
    )
    if (saved) setEditDeliverable(null)
  }

  async function transitionDeliverable(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    if (!transition) return
    const form = new FormData(event.currentTarget)
    const saved = await mutate(
      `deliverable-transition-${transition.deliverable.id}`,
      `/api/projects/${projectId}/deliverables/${transition.deliverable.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "TRANSITION",
          status: transition.status,
          reviewNotes: form.get("reviewNotes") || null,
          acceptanceReference:
            form.get("acceptanceReference") || null,
        }),
      },
      "تم تحديث حالة التسليم",
    )
    if (saved) setTransition(null)
  }

  async function removeDeliverable() {
    if (!deleteDeliverable) return
    const deleted = await mutate(
      `deliverable-delete-${deleteDeliverable.id}`,
      `/api/projects/${projectId}/deliverables/${deleteDeliverable.id}`,
      { method: "DELETE" },
      "تم حذف التسليم المخطط",
    )
    if (deleted) setDeleteDeliverable(null)
  }

  return (
    <>
      <AquaDataPanel
        title="التسليمات والمخرجات"
        eyebrow="Delivery baseline"
        description="سجل النطاق القابل للتسليم من العرض المقبول حتى المراجعة والاعتماد."
        meta={
          <div className={styles.summaryBadges}>
            <AquaBadge variant="muted" size="sm">
              {deliverables.length} تسليم
            </AquaBadge>
            <AquaBadge variant="warning" size="sm">
              {summary.review} للمراجعة
            </AquaBadge>
            <AquaBadge variant="success" size="sm">
              {summary.accepted} معتمد
            </AquaBadge>
          </div>
        }
        actions={
          canManage ? (
            <AquaButton
              size="sm"
              leadingIcon={<Plus />}
              onClick={() => setAddOpen(true)}
            >
              إضافة تسليم
            </AquaButton>
          ) : null
        }
      >
        {!executionActivated && deliverables.length > 0 ? (
          <AquaAlert variant="info" icon={<PackageCheck />}>
            يمكن ترتيب التسليمات اليدوية أثناء التخطيط، بينما تعديل النطاق
            المعتمد يحتاج طلب تغيير. بدء التنفيذ والمراجعة يحتاج تفعيل المشروع أولًا.
          </AquaAlert>
        ) : null}

        {deliverables.length === 0 ? (
          <div className={styles.emptyState}>
            <PackageCheck aria-hidden="true" />
            <div>
              <strong>لا توجد تسليمات مسجلة</strong>
              <p>
                أضف المخرجات يدويًا، أو ستُنسخ بنود DELIVERABLE تلقائيًا
                عند تحويل عرض مقبول جديد.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {deliverables.map((deliverable) => {
              const status = statusCopy[deliverable.status]
              const actions = transitionsFor(deliverable)

              return (
                <article key={deliverable.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div className={styles.titleBlock}>
                      <div className={styles.badgeRow}>
                        <AquaBadge variant={status.variant} size="sm" dot>
                          {status.label}
                        </AquaBadge>
                        <AquaBadge
                          variant={
                            deliverable.source === "ACCEPTED_PROPOSAL"
                              ? "aqua"
                              : deliverable.source === "CHANGE_REQUEST"
                                ? "blue"
                                : "muted"
                          }
                          size="sm"
                        >
                          {deliverable.source === "ACCEPTED_PROPOSAL"
                            ? "من العرض المقبول"
                            : deliverable.source === "CHANGE_REQUEST"
                              ? "من طلب تغيير"
                              : "يدوي"}
                        </AquaBadge>
                      </div>
                      <h3>{deliverable.title}</h3>
                      {deliverable.description ? (
                        <p>{deliverable.description}</p>
                      ) : null}
                    </div>

                    {canManage &&
                    deliverable.source === "MANUAL" &&
                    deliverable.status !== "ACCEPTED" &&
                    deliverable.status !== "CANCELLED" ? (
                      <div className={styles.headerActions}>
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Pencil />}
                          onClick={() =>
                            setEditDeliverable(deliverable)
                          }
                        >
                          تعديل
                        </AquaButton>
                        {deliverable.status === "PLANNED" ? (
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Trash2 />}
                            onClick={() =>
                              setDeleteDeliverable(deliverable)
                            }
                          >
                            حذف
                          </AquaButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <dl className={styles.metaGrid}>
                    <div>
                      <dt>المرحلة</dt>
                      <dd>{deliverable.phase?.name ?? "غير مرتبطة"}</dd>
                    </div>
                    <div>
                      <dt>تاريخ الاستحقاق</dt>
                      <dd dir="ltr">{dateOnly(deliverable.dueDate)}</dd>
                    </div>
                    <div>
                      <dt>معايير القبول</dt>
                      <dd>
                        {deliverable.acceptanceCriteria || "لم تحدد بعد"}
                      </dd>
                    </div>
                  </dl>

                  {deliverable.reviewNotes ||
                  deliverable.acceptanceReference ? (
                    <div className={styles.decisionBox}>
                      {deliverable.reviewNotes ? (
                        <p>
                          <strong>ملاحظة القرار:</strong>{" "}
                          {deliverable.reviewNotes}
                        </p>
                      ) : null}
                      {deliverable.acceptanceReference ? (
                        <p>
                          <strong>مرجع الاعتماد:</strong>{" "}
                          {deliverable.acceptanceReference}
                        </p>
                      ) : null}
                      {deliverable.decidedBy ? (
                        <small>
                          بواسطة {deliverable.decidedBy.name} ·{" "}
                          <span dir="ltr">
                            {dateOnly(deliverable.decidedAt)}
                          </span>
                        </small>
                      ) : null}
                    </div>
                  ) : null}

                  {canManage && actions.length > 0 ? (
                    <div className={styles.transitionRow}>
                      {actions.map((target) => {
                        const needsActivation = ![
                          "PLANNED",
                          "CANCELLED",
                        ].includes(target)
                        return (
                          <AquaButton
                            key={target}
                            variant={
                              target === "ACCEPTED"
                                ? "primary"
                                : target === "CANCELLED"
                                  ? "danger"
                                  : "secondary"
                            }
                            size="sm"
                            leadingIcon={transitionIcon(target)}
                            disabled={
                              needsActivation && !executionActivated
                            }
                            title={
                              needsActivation && !executionActivated
                                ? "فعّل المشروع أولًا"
                                : undefined
                            }
                            onClick={() =>
                              setTransition({
                                deliverable,
                                status: target,
                              })
                            }
                          >
                            {transitionCopy[target].button}
                          </AquaButton>
                        )
                      })}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </AquaDataPanel>

      <AquaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="إضافة تسليم يدوي"
        description="أضف مخرجًا تشغيليًا غير منسوخ من العرض."
        closeOnBackdrop={busyKey !== "deliverable-create"}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={busyKey === "deliverable-create"}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-deliverable-create-form"
              loading={busyKey === "deliverable-create"}
            >
              حفظ التسليم
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-deliverable-create-form"
          className={styles.formGrid}
          onSubmit={createDeliverable}
        >
          <AquaInput name="title" label="العنوان" required span={12} />
          <AquaTextarea
            name="description"
            label="الوصف"
            rows={4}
            span={12}
          />
          <AquaTextarea
            name="acceptanceCriteria"
            label="معايير القبول"
            hint="كيف نثبت أن هذا المخرج مكتمل ومقبول؟"
            rows={4}
            span={12}
          />
          <AquaSelect name="phaseId" label="المرحلة" span={6}>
            <option value="">غير مرتبطة</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </AquaSelect>
          <AquaInput
            name="dueDate"
            type="date"
            label="تاريخ الاستحقاق"
            span={3}
          />
          <AquaInput
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={deliverables.length}
            label="الترتيب"
            span={3}
          />
        </form>
      </AquaModal>

      <AquaModal
        open={Boolean(editDeliverable)}
        onClose={() => setEditDeliverable(null)}
        title="تعديل التسليم"
        description={
          editDeliverable?.source !== "MANUAL"
            ? "عنوان ووصف نطاق العرض ثابتان؛ يمكن ضبط المرحلة والموعد ومعايير القبول."
            : "حدّث تفاصيل التسليم المخطط."
        }
        closeOnBackdrop={!busyKey.startsWith("deliverable-update-")}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setEditDeliverable(null)}
              disabled={busyKey.startsWith("deliverable-update-")}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-deliverable-update-form"
              loading={busyKey.startsWith("deliverable-update-")}
            >
              حفظ التعديل
            </AquaButton>
          </div>
        }
      >
        {editDeliverable ? (
          <form
            key={editDeliverable.id}
            id="project-deliverable-update-form"
            className={styles.formGrid}
            onSubmit={updateDeliverable}
          >
            <AquaInput
              name="title"
              label="العنوان"
              defaultValue={editDeliverable.title}
              required
              span={12}
            />
            <AquaTextarea
              name="description"
              label="الوصف"
              defaultValue={editDeliverable.description ?? ""}
              rows={4}
              span={12}
            />
            <AquaTextarea
              name="acceptanceCriteria"
              label="معايير القبول"
              defaultValue={
                editDeliverable.acceptanceCriteria ?? ""
              }
              rows={4}
              span={12}
            />
            <AquaSelect
              name="phaseId"
              label="المرحلة"
              defaultValue={editDeliverable.phaseId ?? ""}
              span={6}
            >
              <option value="">غير مرتبطة</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </AquaSelect>
            <AquaInput
              name="dueDate"
              type="date"
              label="تاريخ الاستحقاق"
              defaultValue={dateOnly(editDeliverable.dueDate).replace(
                "—",
                "",
              )}
              span={3}
            />
            <AquaInput
              name="sortOrder"
              type="number"
              min={0}
              label="الترتيب"
              defaultValue={editDeliverable.sortOrder}
              span={3}
            />
          </form>
        ) : null}
      </AquaModal>

      <AquaModal
        open={Boolean(transition)}
        onClose={() => setTransition(null)}
        title={
          transition
            ? transitionCopy[transition.status].title
            : "تحديث حالة التسليم"
        }
        description={
          transition
            ? transitionCopy[transition.status].description
            : undefined
        }
        closeOnBackdrop={!busyKey.startsWith("deliverable-transition-")}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setTransition(null)}
              disabled={busyKey.startsWith("deliverable-transition-")}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-deliverable-transition-form"
              variant={
                transition?.status === "CANCELLED"
                  ? "danger"
                  : "primary"
              }
              loading={busyKey.startsWith("deliverable-transition-")}
            >
              {transition
                ? transitionCopy[transition.status].button
                : "تأكيد"}
            </AquaButton>
          </div>
        }
      >
        {transition ? (
          <form
            key={`${transition.deliverable.id}-${transition.status}`}
            id="project-deliverable-transition-form"
            className={styles.formGrid}
            onSubmit={transitionDeliverable}
          >
            <AquaAlert
              variant={
                transition.status === "ACCEPTED"
                  ? "success"
                  : transition.status === "CANCELLED" ||
                      transition.status === "CHANGES_REQUESTED"
                    ? "warning"
                    : "neutral"
              }
            >
              {transition.deliverable.title}
            </AquaAlert>
            {transition.status === "ACCEPTED" ? (
              <AquaInput
                name="acceptanceReference"
                label="مرجع الاعتماد"
                placeholder="مثال: بريد العميل بتاريخ 2026-08-01"
                required
                span={12}
              />
            ) : null}
            <AquaTextarea
              name="reviewNotes"
              label={
                ["CHANGES_REQUESTED", "CANCELLED"].includes(
                  transition.status,
                )
                  ? "ملاحظة القرار"
                  : "ملاحظات"
              }
              required={[
                "CHANGES_REQUESTED",
                "CANCELLED",
              ].includes(transition.status)}
              rows={4}
              span={12}
            />
          </form>
        ) : null}
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(deleteDeliverable)}
        onClose={() => setDeleteDeliverable(null)}
        onConfirm={removeDeliverable}
        title="حذف التسليم المخطط"
        description={`سيُحذف ${deleteDeliverable?.title ?? "التسليم"} نهائيًا. هذا متاح للتسليم اليدوي قبل بدء العمل فقط.`}
        confirmLabel="حذف التسليم"
        confirmVariant="danger"
        tone="danger"
        loading={busyKey.startsWith("deliverable-delete-")}
      />
    </>
  )
}
