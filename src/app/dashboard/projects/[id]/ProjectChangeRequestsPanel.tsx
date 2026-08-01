"use client"

import {
  CheckCircle2,
  CircleDollarSign,
  FileDiff,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
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
  AquaModal,
  AquaSelect,
  AquaTextarea,
  aquaToast,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"

import styles from "./ProjectChangeRequestsPanel.module.css"

type ChangeStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "CANCELLED"

type CommercialImpact = "NONE" | "REQUIRES_QUOTE" | "APPROVED"
type ItemAction =
  | "ADD_DELIVERABLE"
  | "MODIFY_DELIVERABLE"
  | "CANCEL_DELIVERABLE"

export type ProjectChangeRequestView = {
  id: string
  requestNumber: string
  title: string
  businessReason: string
  status: ChangeStatus
  scheduleImpactDays: number
  commercialImpact: CommercialImpact
  commercialReference: string | null
  clientApprovalRequired: boolean
  clientApprovalReference: string | null
  reviewNotes: string | null
  submittedAt: string | null
  changesRequestedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  appliedAt: string | null
  cancelledAt: string | null
  createdAt: string
  createdBy: { id: string; name: string } | null
  reviewedBy: { id: string; name: string } | null
  appliedBy: { id: string; name: string } | null
  canReview: boolean
  items: Array<{
    id: string
    action: ItemAction
    targetDeliverableId: string | null
    resultDeliverableId: string | null
    title: string | null
    description: string | null
    acceptanceCriteria: string | null
    reason: string | null
    phaseId: string | null
    phase: { id: string; name: string } | null
    targetDeliverable: { id: string; title: string } | null
    resultDeliverable: { id: string; title: string } | null
    dueDate: string | null
    sortOrder: number
  }>
}

type DeliverableOption = {
  id: string
  title: string
  description: string | null
  acceptanceCriteria: string | null
  phaseId: string | null
  dueDate: string | null
  sortOrder: number
  status: string
}

type PhaseOption = { id: string; name: string }

type DraftItem = {
  key: string
  action: ItemAction
  targetDeliverableId: string
  title: string
  description: string
  acceptanceCriteria: string
  reason: string
  phaseId: string
  dueDate: string
  sortOrder: number
}

type EditorDraft = {
  title: string
  businessReason: string
  scheduleImpactDays: number
  commercialImpact: CommercialImpact
  commercialReference: string
  clientApprovalRequired: boolean
  clientApprovalReference: string
  items: DraftItem[]
}

type DecisionAction =
  | "REQUEST_CHANGES"
  | "APPROVE"
  | "REJECT"
  | "CANCEL"

type ConfirmAction = "SUBMIT" | "APPLY"

const statusLabels: Record<ChangeStatus, string> = {
  DRAFT: "مسودة",
  IN_REVIEW: "قيد المراجعة",
  CHANGES_REQUESTED: "تعديلات مطلوبة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  APPLIED: "مطبق",
  CANCELLED: "ملغى",
}

const commercialLabels: Record<CommercialImpact, string> = {
  NONE: "دون أثر تجاري",
  REQUIRES_QUOTE: "يحتاج تسعيرًا",
  APPROVED: "أثر تجاري معتمد",
}

const actionLabels: Record<ItemAction, string> = {
  ADD_DELIVERABLE: "إضافة تسليم",
  MODIFY_DELIVERABLE: "تعديل تسليم",
  CANCEL_DELIVERABLE: "إلغاء تسليم",
}

function statusVariant(status: ChangeStatus): AquaBadgeVariant {
  if (status === "APPLIED") return "success"
  if (status === "APPROVED") return "aqua"
  if (status === "IN_REVIEW" || status === "CHANGES_REQUESTED") {
    return "warning"
  }
  if (status === "REJECTED" || status === "CANCELLED") return "danger"
  return "muted"
}

function dateOnly(value: string | null) {
  return value?.slice(0, 10) ?? "—"
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

function blankItem(index = 0): DraftItem {
  return {
    key: `${Date.now()}-${Math.random()}-${index}`,
    action: "ADD_DELIVERABLE",
    targetDeliverableId: "",
    title: "",
    description: "",
    acceptanceCriteria: "",
    reason: "",
    phaseId: "",
    dueDate: "",
    sortOrder: index,
  }
}

function blankDraft(): EditorDraft {
  return {
    title: "",
    businessReason: "",
    scheduleImpactDays: 0,
    commercialImpact: "NONE",
    commercialReference: "",
    clientApprovalRequired: true,
    clientApprovalReference: "",
    items: [blankItem()],
  }
}

function requestToDraft(request: ProjectChangeRequestView): EditorDraft {
  return {
    title: request.title,
    businessReason: request.businessReason,
    scheduleImpactDays: request.scheduleImpactDays,
    commercialImpact: request.commercialImpact,
    commercialReference: request.commercialReference ?? "",
    clientApprovalRequired: request.clientApprovalRequired,
    clientApprovalReference: request.clientApprovalReference ?? "",
    items: request.items.map((item, index) => ({
      key: item.id,
      action: item.action,
      targetDeliverableId: item.targetDeliverableId ?? "",
      title: item.title ?? "",
      description: item.description ?? "",
      acceptanceCriteria: item.acceptanceCriteria ?? "",
      reason: item.reason ?? "",
      phaseId: item.phaseId ?? "",
      dueDate: item.dueDate?.slice(0, 10) ?? "",
      sortOrder: item.sortOrder ?? index,
    })),
  }
}

export default function ProjectChangeRequestsPanel({
  projectId,
  changeRequests,
  deliverables,
  phases,
  canManage,
  projectClosed,
}: {
  projectId: string
  changeRequests: ProjectChangeRequestView[]
  deliverables: DeliverableOption[]
  phases: PhaseOption[]
  canManage: boolean
  projectClosed: boolean
}) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRequest, setEditingRequest] =
    useState<ProjectChangeRequestView | null>(null)
  const [draft, setDraft] = useState<EditorDraft>(blankDraft)
  const [decision, setDecision] = useState<{
    request: ProjectChangeRequestView
    action: DecisionAction
  } | null>(null)
  const [decisionNotes, setDecisionNotes] = useState("")
  const [decisionClientReference, setDecisionClientReference] =
    useState("")
  const [confirm, setConfirm] = useState<{
    request: ProjectChangeRequestView
    action: ConfirmAction
  } | null>(null)

  const editableDeliverables = useMemo(
    () =>
      deliverables.filter(
        (deliverable) =>
          !["ACCEPTED", "CANCELLED"].includes(deliverable.status),
      ),
    [deliverables],
  )

  function openCreate() {
    setEditingRequest(null)
    setDraft(blankDraft())
    setEditorOpen(true)
  }

  function openEdit(request: ProjectChangeRequestView) {
    setEditingRequest(request)
    setDraft(requestToDraft(request))
    setEditorOpen(true)
  }

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }))
  }

  function selectTarget(item: DraftItem, targetId: string) {
    const target = deliverables.find(
      (deliverable) => deliverable.id === targetId,
    )
    patchItem(item.key, {
      targetDeliverableId: targetId,
      ...(item.action === "MODIFY_DELIVERABLE" && target
        ? {
            title: target.title,
            description: target.description ?? "",
            acceptanceCriteria: target.acceptanceCriteria ?? "",
            phaseId: target.phaseId ?? "",
            dueDate: target.dueDate?.slice(0, 10) ?? "",
            sortOrder: target.sortOrder,
          }
        : {}),
    })
  }

  async function mutate(
    key: string,
    endpoint: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyKey(key)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as unknown
      if (!response.ok) {
        throw new Error(
          errorMessage(payload, "تعذر تنفيذ إجراء طلب التغيير"),
        )
      }

      setSuccess(successMessage)
      aquaToast.success(successMessage)
      router.refresh()
      return true
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "حدث خطأ غير متوقع"
      setError(message)
      aquaToast.error(message)
      return false
    } finally {
      setBusyKey("")
    }
  }

  function draftPayload() {
    return {
      title: draft.title,
      businessReason: draft.businessReason,
      scheduleImpactDays: Number(draft.scheduleImpactDays || 0),
      commercialImpact: draft.commercialImpact,
      commercialReference: draft.commercialReference || null,
      clientApprovalRequired: draft.clientApprovalRequired,
      clientApprovalReference: draft.clientApprovalReference || null,
      items: draft.items.map((item) => {
        if (item.action === "CANCEL_DELIVERABLE") {
          return {
            action: item.action,
            targetDeliverableId: item.targetDeliverableId,
            reason: item.reason,
          }
        }
        return {
          action: item.action,
          ...(item.action === "MODIFY_DELIVERABLE"
            ? { targetDeliverableId: item.targetDeliverableId }
            : {}),
          title: item.title,
          description: item.description || null,
          acceptanceCriteria: item.acceptanceCriteria || null,
          phaseId: item.phaseId || null,
          dueDate: item.dueDate || null,
          sortOrder: Number(item.sortOrder || 0),
        }
      }),
    }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const endpoint = editingRequest
      ? `/api/projects/${projectId}/change-requests/${editingRequest.id}`
      : `/api/projects/${projectId}/change-requests`
    const saved = await mutate(
      editingRequest ? `change-edit-${editingRequest.id}` : "change-create",
      endpoint,
      editingRequest ? "PATCH" : "POST",
      editingRequest
        ? { action: "UPDATE_DRAFT", ...draftPayload() }
        : draftPayload(),
      editingRequest ? "تم تحديث طلب التغيير" : "تم إنشاء طلب التغيير",
    )
    if (saved) setEditorOpen(false)
  }

  async function confirmAction() {
    if (!confirm) return
    const saved = await mutate(
      `change-${confirm.action.toLowerCase()}-${confirm.request.id}`,
      `/api/projects/${projectId}/change-requests/${confirm.request.id}`,
      "PATCH",
      { action: confirm.action },
      confirm.action === "SUBMIT"
        ? "تم إرسال طلب التغيير للمراجعة"
        : "تم تطبيق طلب التغيير على سجل التسليمات",
    )
    if (saved) setConfirm(null)
  }

  async function submitDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!decision) return
    const body = {
      action: decision.action,
      reviewNotes: decisionNotes,
      ...(decision.action === "APPROVE"
        ? {
            clientApprovalReference:
              decisionClientReference ||
              decision.request.clientApprovalReference ||
              null,
          }
        : {}),
    }
    const labels: Record<DecisionAction, string> = {
      REQUEST_CHANGES: "تمت إعادة الطلب للتعديل",
      APPROVE: "تم اعتماد طلب التغيير",
      REJECT: "تم رفض طلب التغيير",
      CANCEL: "تم إلغاء طلب التغيير",
    }
    const saved = await mutate(
      `change-${decision.action.toLowerCase()}-${decision.request.id}`,
      `/api/projects/${projectId}/change-requests/${decision.request.id}`,
      "PATCH",
      body,
      labels[decision.action],
    )
    if (saved) {
      setDecision(null)
      setDecisionNotes("")
      setDecisionClientReference("")
    }
  }

  function openDecision(
    request: ProjectChangeRequestView,
    action: DecisionAction,
  ) {
    setDecision({ request, action })
    setDecisionNotes(request.reviewNotes ?? "")
    setDecisionClientReference(request.clientApprovalReference ?? "")
  }

  return (
    <AquaDataPanel
      title="طلبات تغيير النطاق"
      description="مسار رسمي لتعديل التسليمات مع مراجعة واعتماد وتطبيق قابل للتدقيق."
      meta={
        <AquaBadge variant="muted" size="sm">
          {changeRequests.length}
        </AquaBadge>
      }
      actions={
        canManage && !projectClosed ? (
          <AquaButton size="sm" leadingIcon={<Plus />} onClick={openCreate}>
            طلب تغيير
          </AquaButton>
        ) : null
      }
    >
      <div className={styles.panelBody}>
        {error ? (
          <AquaAlert variant="danger" title="تعذر تنفيذ الإجراء">
            {error}
          </AquaAlert>
        ) : null}
        {success ? <AquaAlert variant="success">{success}</AquaAlert> : null}

        {changeRequests.length === 0 ? (
          <div className={styles.empty}>
            لا توجد طلبات تغيير. يبقى نطاق العرض المقبول ثابتًا حتى يمر أي
            تعديل من هذا المسار.
          </div>
        ) : (
          <div className={styles.list}>
            {changeRequests.map((request) => (
              <AquaCard
                key={request.id}
                variant="soft"
                padding="sm"
                className={styles.requestCard}
              >
                <div className={styles.requestHeader}>
                  <div>
                    <div className={styles.requestTitleRow}>
                      <strong>{request.title}</strong>
                      <AquaBadge variant={statusVariant(request.status)} size="sm">
                        {statusLabels[request.status]}
                      </AquaBadge>
                      <AquaBadge variant="muted" size="sm">
                        <bdi dir="ltr">{request.requestNumber}</bdi>
                      </AquaBadge>
                    </div>
                    <p>{request.businessReason}</p>
                  </div>
                  <div className={styles.requestActions}>
                    {canManage &&
                    ["DRAFT", "CHANGES_REQUESTED"].includes(request.status) ? (
                      <>
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Pencil />}
                          onClick={() => openEdit(request)}
                        >
                          تعديل
                        </AquaButton>
                        <AquaButton
                          size="sm"
                          leadingIcon={<Send />}
                          onClick={() => setConfirm({ request, action: "SUBMIT" })}
                        >
                          إرسال
                        </AquaButton>
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<XCircle />}
                          onClick={() => openDecision(request, "CANCEL")}
                        >
                          إلغاء
                        </AquaButton>
                      </>
                    ) : null}
                    {canManage && request.status === "IN_REVIEW" ? (
                      <AquaButton
                        variant="ghost"
                        size="sm"
                        leadingIcon={<XCircle />}
                        onClick={() => openDecision(request, "CANCEL")}
                      >
                        سحب الطلب
                      </AquaButton>
                    ) : null}
                    {request.status === "IN_REVIEW" && request.canReview ? (
                      <>
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<RotateCcw />}
                          onClick={() =>
                            openDecision(request, "REQUEST_CHANGES")
                          }
                        >
                          طلب تعديل
                        </AquaButton>
                        <AquaButton
                          size="sm"
                          leadingIcon={<ShieldCheck />}
                          onClick={() => openDecision(request, "APPROVE")}
                        >
                          اعتماد
                        </AquaButton>
                        <AquaButton
                          variant="danger"
                          size="sm"
                          leadingIcon={<XCircle />}
                          onClick={() => openDecision(request, "REJECT")}
                        >
                          رفض
                        </AquaButton>
                      </>
                    ) : null}
                    {canManage && request.status === "APPROVED" ? (
                      <AquaButton
                        size="sm"
                        leadingIcon={<CheckCircle2 />}
                        onClick={() => setConfirm({ request, action: "APPLY" })}
                      >
                        تطبيق
                      </AquaButton>
                    ) : null}
                  </div>
                </div>

                <div className={styles.impactGrid}>
                  <span>
                    <FileDiff aria-hidden="true" />
                    {request.items.length} بنود تغيير
                  </span>
                  <span>
                    <bdi dir="ltr">{request.scheduleImpactDays}</bdi>
                    يوم أثر زمني
                  </span>
                  <span>
                    <CircleDollarSign aria-hidden="true" />
                    {commercialLabels[request.commercialImpact]}
                  </span>
                  <span>
                    أنشأه {request.createdBy?.name ?? "مستخدم سابق"}
                  </span>
                </div>

                {request.reviewNotes ? (
                  <AquaAlert
                    variant={
                      request.status === "REJECTED" ||
                      request.status === "CANCELLED"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {request.reviewNotes}
                  </AquaAlert>
                ) : null}

                <div className={styles.items}>
                  {request.items.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      <AquaBadge
                        variant={
                          item.action === "ADD_DELIVERABLE"
                            ? "success"
                            : item.action === "CANCEL_DELIVERABLE"
                              ? "danger"
                              : "blue"
                        }
                        size="sm"
                      >
                        {actionLabels[item.action]}
                      </AquaBadge>
                      <div>
                        <strong>
                          {item.title ?? item.targetDeliverable?.title ?? "بند تغيير"}
                        </strong>
                        <span>
                          {item.phase?.name ?? "دون مرحلة"}
                          {item.dueDate ? ` · ${dateOnly(item.dueDate)}` : ""}
                        </span>
                        {item.reason ? <p>{item.reason}</p> : null}
                      </div>
                      {item.resultDeliverable ? (
                        <AquaBadge variant="aqua" size="sm">
                          تم الربط
                        </AquaBadge>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className={styles.auditRow}>
                  <span>
                    موافقة العميل: {request.clientApprovalRequired ? "مطلوبة" : "داخلية"}
                  </span>
                  {request.clientApprovalReference ? (
                    <span>{request.clientApprovalReference}</span>
                  ) : null}
                  {request.commercialReference ? (
                    <span>المرجع التجاري: {request.commercialReference}</span>
                  ) : null}
                  {request.reviewedBy ? (
                    <span>راجعه {request.reviewedBy.name}</span>
                  ) : null}
                  {request.appliedBy ? (
                    <span>طبقه {request.appliedBy.name}</span>
                  ) : null}
                </div>
              </AquaCard>
            ))}
          </div>
        )}
      </div>

      <AquaModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingRequest ? "تعديل طلب التغيير" : "إنشاء طلب تغيير"}
        description="حدّد سبب التغيير وبنوده بدقة؛ لن يتغير سجل التسليمات قبل الاعتماد والتطبيق."
        size="xl"
        closeOnBackdrop={!busyKey}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setEditorOpen(false)}
              disabled={Boolean(busyKey)}
            >
              إغلاق
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-change-editor"
              loading={Boolean(busyKey)}
              loadingLabel="جارٍ الحفظ"
            >
              حفظ المسودة
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-change-editor"
          className={styles.editor}
          onSubmit={saveDraft}
        >
          <div className={styles.formGrid}>
            <AquaInput
              label="عنوان الطلب"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
            />
            <AquaInput
              label="الأثر الزمني بالأيام"
              type="number"
              min={-3650}
              max={3650}
              value={draft.scheduleImpactDays}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  scheduleImpactDays: Number(event.target.value || 0),
                }))
              }
            />
            <AquaSelect
              label="الأثر التجاري"
              value={draft.commercialImpact}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  commercialImpact: event.target.value as CommercialImpact,
                }))
              }
            >
              {Object.entries(commercialLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </AquaSelect>
            <AquaInput
              label="مرجع التسعير أو الملحق"
              value={draft.commercialReference}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  commercialReference: event.target.value,
                }))
              }
              required={draft.commercialImpact === "APPROVED"}
            />
            <AquaSelect
              label="هل موافقة العميل مطلوبة؟"
              value={draft.clientApprovalRequired ? "true" : "false"}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  clientApprovalRequired: event.target.value === "true",
                }))
              }
            >
              <option value="true">نعم</option>
              <option value="false">لا، تغيير داخلي</option>
            </AquaSelect>
            <AquaInput
              label="مرجع موافقة العميل"
              value={draft.clientApprovalReference}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  clientApprovalReference: event.target.value,
                }))
              }
              hint="يمكن إضافته عند الاعتماد إذا لم يتوفر الآن."
            />
          </div>
          <AquaTextarea
            label="مبرر التغيير"
            value={draft.businessReason}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                businessReason: event.target.value,
              }))
            }
            rows={4}
            required
          />

          <div className={styles.editorSectionHeader}>
            <div>
              <h3>بنود التغيير</h3>
              <p>يمكن جمع أكثر من إضافة أو تعديل أو إلغاء في طلب واحد.</p>
            </div>
            <AquaButton
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<Plus />}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    blankItem(current.items.length),
                  ],
                }))
              }
            >
              إضافة بند
            </AquaButton>
          </div>

          <div className={styles.editorItems}>
            {draft.items.map((item, index) => (
              <AquaCard key={item.key} variant="soft" padding="sm">
                <div className={styles.itemEditorHeader}>
                  <strong>البند {index + 1}</strong>
                  {draft.items.length > 1 ? (
                    <AquaButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          items: current.items.filter(
                            (candidate) => candidate.key !== item.key,
                          ),
                        }))
                      }
                    >
                      إزالة
                    </AquaButton>
                  ) : null}
                </div>
                <div className={styles.formGrid}>
                  <AquaSelect
                    label="نوع البند"
                    value={item.action}
                    onChange={(event) =>
                      patchItem(item.key, {
                        action: event.target.value as ItemAction,
                        targetDeliverableId: "",
                        reason: "",
                      })
                    }
                  >
                    {Object.entries(actionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </AquaSelect>
                  {item.action !== "ADD_DELIVERABLE" ? (
                    <AquaSelect
                      label="التسليم المستهدف"
                      value={item.targetDeliverableId}
                      onChange={(event) =>
                        selectTarget(item, event.target.value)
                      }
                      required
                    >
                      <option value="">اختر تسليمًا</option>
                      {editableDeliverables.map((deliverable) => (
                        <option key={deliverable.id} value={deliverable.id}>
                          {deliverable.title}
                        </option>
                      ))}
                    </AquaSelect>
                  ) : null}
                </div>

                {item.action === "CANCEL_DELIVERABLE" ? (
                  <AquaTextarea
                    label="سبب الإلغاء"
                    value={item.reason}
                    onChange={(event) =>
                      patchItem(item.key, { reason: event.target.value })
                    }
                    rows={3}
                    required
                  />
                ) : (
                  <>
                    <AquaInput
                      label="عنوان التسليم بعد التغيير"
                      value={item.title}
                      onChange={(event) =>
                        patchItem(item.key, { title: event.target.value })
                      }
                      required
                    />
                    <div className={styles.formGrid}>
                      <AquaSelect
                        label="المرحلة"
                        value={item.phaseId}
                        onChange={(event) =>
                          patchItem(item.key, { phaseId: event.target.value })
                        }
                      >
                        <option value="">دون مرحلة</option>
                        {phases.map((phase) => (
                          <option key={phase.id} value={phase.id}>
                            {phase.name}
                          </option>
                        ))}
                      </AquaSelect>
                      <AquaInput
                        label="موعد التسليم"
                        type="date"
                        value={item.dueDate}
                        onChange={(event) =>
                          patchItem(item.key, { dueDate: event.target.value })
                        }
                      />
                      <AquaInput
                        label="الترتيب"
                        type="number"
                        min={0}
                        max={10000}
                        value={item.sortOrder}
                        onChange={(event) =>
                          patchItem(item.key, {
                            sortOrder: Number(event.target.value || 0),
                          })
                        }
                      />
                    </div>
                    <AquaTextarea
                      label="الوصف بعد التغيير"
                      value={item.description}
                      onChange={(event) =>
                        patchItem(item.key, {
                          description: event.target.value,
                        })
                      }
                      rows={3}
                    />
                    <AquaTextarea
                      label="معايير القبول بعد التغيير"
                      value={item.acceptanceCriteria}
                      onChange={(event) =>
                        patchItem(item.key, {
                          acceptanceCriteria: event.target.value,
                        })
                      }
                      rows={3}
                    />
                  </>
                )}
              </AquaCard>
            ))}
          </div>
        </form>
      </AquaModal>

      <AquaModal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={
          decision?.action === "APPROVE"
            ? "اعتماد طلب التغيير"
            : decision?.action === "REQUEST_CHANGES"
              ? "إعادة الطلب للتعديل"
              : decision?.action === "REJECT"
                ? "رفض طلب التغيير"
                : "إلغاء طلب التغيير"
        }
        size="md"
        closeOnBackdrop={!busyKey}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setDecision(null)}
              disabled={Boolean(busyKey)}
            >
              رجوع
            </AquaButton>
            <AquaButton
              type="submit"
              form="project-change-decision"
              variant={
                decision?.action === "REJECT" || decision?.action === "CANCEL"
                  ? "danger"
                  : "primary"
              }
              loading={Boolean(busyKey)}
            >
              تأكيد
            </AquaButton>
          </div>
        }
      >
        <form
          id="project-change-decision"
          className={styles.decisionForm}
          onSubmit={submitDecision}
        >
          {decision?.action === "APPROVE" &&
          decision.request.clientApprovalRequired ? (
            <AquaInput
              label="مرجع موافقة العميل"
              value={decisionClientReference}
              onChange={(event) =>
                setDecisionClientReference(event.target.value)
              }
              required
            />
          ) : null}
          <AquaTextarea
            label={
              decision?.action === "APPROVE"
                ? "ملاحظات الاعتماد"
                : "سبب القرار"
            }
            value={decisionNotes}
            onChange={(event) => setDecisionNotes(event.target.value)}
            rows={4}
            required={decision?.action !== "APPROVE"}
          />
        </form>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={confirmAction}
        title={
          confirm?.action === "SUBMIT"
            ? "إرسال طلب التغيير للمراجعة"
            : "تطبيق طلب التغيير"
        }
        description={
          confirm?.action === "SUBMIT"
            ? "ستُقفل المسودة حتى تعتمدها الإدارة أو تعيدها للتعديل."
            : "سيتم إنشاء أو تعديل أو إلغاء التسليمات وفق النسخة المعتمدة. يتوقف التطبيق إذا تغير أي تسليم مستهدف بعد إعداد الطلب."
        }
        confirmLabel={confirm?.action === "SUBMIT" ? "إرسال" : "تطبيق"}
        loading={Boolean(busyKey)}
        tone={confirm?.action === "APPLY" ? "warning" : "neutral"}
        icon={confirm?.action === "APPLY" ? <FileDiff /> : <Send />}
      />
    </AquaDataPanel>
  )
}
