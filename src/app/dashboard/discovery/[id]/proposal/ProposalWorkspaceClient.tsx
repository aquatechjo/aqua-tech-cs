"use client"

import {
  CheckCircle2,
  Copy,
  Eye,
  FileClock,
  Link2,
  Mail,
  MessageCircle,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
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
  AquaDetailList,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaSelect,
  AquaTabs,
  AquaTextarea,
} from "@/components/aqua"
import type { AquaBadgeProps } from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  DiscoveryServiceTrack,
  ProposalWorkspaceStatus,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import type { PricingVersionContent } from "@/lib/pricing"
import {
  clientSafeProposalProjection,
  normalizeProposalContent,
  PROPOSAL_AUDIENCES,
  PROPOSAL_SECTION_KINDS,
  proposalDraftInputSchema,
  proposalReviewIssues,
  proposalSectionKindLabel,
  type ProposalDraftInput,
  type ProposalSection,
  type ProposalVersionContent,
} from "@/lib/proposal"

type WorkspaceItem = {
  id: string
  proposalNumber: string
  status: ProposalWorkspaceStatus
  currentVersion: number
  reviewNotes: string | null
  submittedAt: string | null
  changesRequestedAt: string | null
  approvedAt: string | null
  sentVersion: number | null
  sentClientContentHash: string | null
  sentAt: string | null
  clientRespondedAt: string | null
  clientResponseName: string | null
  clientResponseEmail: string | null
  clientResponseTitle: string | null
  clientResponseNotes: string | null
  createdAt: string
  updatedAt: string
  createdBy: {
    id: string
    name: string
  } | null
  reviewedBy: {
    id: string
    name: string
  } | null
  versions: Array<{
    id: string
    version: number
    content: ProposalVersionContent | null
    clientContentHash: string
    pricingVersion: number
    pricingContentHash: string
    discoveryReportVersion: number
    discoveryContentHash: string
    createdAt: string
    createdBy: {
      id: string
      name: string
    } | null
  }>
  deliveries: Array<{
    id: string
    channel: "EMAIL" | "SECURE_LINK" | "WHATSAPP"
    status: "PREPARED" | "SENT" | "FAILED" | "REVOKED"
    version: number
    recipientName: string | null
    recipientEmail: string | null
    recipientPhone: string | null
    expiresAt: string
    sentAt: string | null
    firstViewedAt: string | null
    lastViewedAt: string | null
    viewCount: number
    failureCode: string | null
    createdAt: string
  }>
}

type TabId = "EDIT" | "CLIENT" | "DELIVERY" | "VERSIONS"

function workspaceStatusLabel(status: ProposalWorkspaceStatus) {
  const labels: Record<ProposalWorkspaceStatus, string> = {
    DRAFT: "مسودة",
    IN_REVIEW: "قيد المراجعة",
    CHANGES_REQUESTED: "تحتاج تعديلات",
    APPROVED: "معتمدة",
    SENT: "مرسلة",
    CLIENT_CHANGES_REQUESTED: "تعديل من العميل",
    ACCEPTED: "مقبولة",
    REJECTED: "مرفوضة",
  }
  return labels[status]
}

function workspaceStatusVariant(
  status: ProposalWorkspaceStatus,
): AquaBadgeProps["variant"] {
  if (status === "APPROVED" || status === "ACCEPTED") {
    return "success"
  }
  if (status === "SENT") return "blue"
  if (status === "REJECTED") return "danger"
  if (status === "IN_REVIEW") return "blue"
  if (
    status === "CHANGES_REQUESTED" ||
    status === "CLIENT_CHANGES_REQUESTED"
  ) {
    return "warning"
  }
  return "aqua"
}

function audienceLabel(audience: ProposalSection["audience"]) {
  return audience === "CLIENT" ? "نسخة العميل" : "داخلي فقط"
}

function deliveryChannelLabel(
  channel: WorkspaceItem["deliveries"][number]["channel"],
) {
  if (channel === "EMAIL") return "بريد إلكتروني"
  if (channel === "WHATSAPP") return "واتساب"
  return "رابط آمن"
}

function deliveryStatusLabel(
  status: WorkspaceItem["deliveries"][number]["status"],
) {
  if (status === "SENT") return "مرسل"
  if (status === "PREPARED") return "بانتظار التأكيد"
  if (status === "FAILED") return "فشل"
  return "ملغى"
}

function itemKey(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export default function ProposalWorkspaceClient({
  session,
  displayName,
  source,
  pricing,
  workspace,
  initialDraft,
  canManage,
  canApprove,
  approvalBlockedBySelf,
  canDeliver,
  recipient,
  timeZone,
}: {
  session: {
    id: string
    serviceTrack: DiscoveryServiceTrack
    lead: {
      id: string
      contactName: string
      companyName: string | null
      serviceType: string
    }
    opportunity: {
      id: string
      title: string
      stage: SalesOpportunityStage
    } | null
  }
  displayName: string
  source: {
    reportVersion: number
    reportContentHash: string
    pricingVersion: number
    pricingContentHash: string
  }
  pricing: PricingVersionContent
  workspace: WorkspaceItem | null
  initialDraft: ProposalDraftInput
  canManage: boolean
  canApprove: boolean
  approvalBlockedBySelf: boolean
  canDeliver: boolean
  recipient: {
    name: string
    email: string
    phone: string
  }
  timeZone: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(initialDraft)
  const [activeTab, setActiveTab] = useState<TabId>("EDIT")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loadingAction, setLoadingAction] = useState<
    | "SAVE"
    | "SUBMIT"
    | "REQUEST_CHANGES"
    | "APPROVE"
    | "PREPARE_LINK"
    | "PREPARE_WHATSAPP"
    | "SEND_EMAIL"
    | "CONFIRM_DELIVERY"
    | "REVOKE"
    | null
  >(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")
  const [previewVersion, setPreviewVersion] = useState<
    WorkspaceItem["versions"][number] | null
  >(null)
  const [recipientName, setRecipientName] = useState(recipient.name)
  const [recipientEmail, setRecipientEmail] = useState(recipient.email)
  const [recipientPhone, setRecipientPhone] = useState(recipient.phone)
  const [preparedDelivery, setPreparedDelivery] = useState<{
    deliveryId: string
    channel: "SECURE_LINK" | "WHATSAPP"
    publicUrl: string
    whatsappUrl: string | null
    expiresAt: string
  } | null>(null)
  const status = workspace?.status ?? "DRAFT"
  const locked =
    status !== "DRAFT" &&
    status !== "CHANGES_REQUESTED" &&
    status !== "CLIENT_CHANGES_REQUESTED"
  const canEdit = canManage && !locked
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const validation = useMemo(
    () => proposalDraftInputSchema.safeParse(draft),
    [draft],
  )
  const previewContent = useMemo(() => {
    if (!validation.success) return null
    return normalizeProposalContent({
      draft: validation.data,
      pricing,
    })
  }, [pricing, validation])
  const reviewIssues = previewContent
    ? proposalReviewIssues(previewContent)
    : ["راجع حقول العرض"]
  const clientProjection = previewContent
    ? clientSafeProposalProjection(previewContent)
    : null
  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })

  function money(value: string) {
    return `${Number(value).toLocaleString("en-JO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${pricing.currency}`
  }

  function updateSection(
    id: string,
    patch: Partial<ProposalSection>,
  ) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    }))
  }

  function addSection(audience: ProposalSection["audience"]) {
    setDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: itemKey("section"),
          kind: audience === "CLIENT" ? "CUSTOM" : "INTERNAL_NOTE",
          audience,
          title: "",
          body: "",
        },
      ],
    }))
  }

  function addMilestone() {
    setDraft((current) => ({
      ...current,
      paymentMilestones: [
        ...current.paymentMilestones,
        {
          id: itemKey("payment"),
          label: "",
          percentage: "0.00",
          dueCondition: "",
        },
      ],
    }))
  }

  async function runRequest({
    action,
    url,
    method,
    body,
    successMessage,
  }: {
    action: NonNullable<typeof loadingAction>
    url: string
    method: "POST" | "PATCH"
    body: unknown
    successMessage: string
  }) {
    setError("")
    setSuccess("")
    setLoadingAction(action)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تنفيذ الإجراء")
        return false
      }

      setSuccess(successMessage)
      router.refresh()
      return true
    } catch {
      setError("تعذر الاتصال بالخادم")
      return false
    } finally {
      setLoadingAction(null)
    }
  }

  async function saveVersion() {
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ??
          "راجع بيانات العرض",
      )
      return
    }

    await runRequest({
      action: "SAVE",
      url: `/api/discovery/sessions/${session.id}/proposal`,
      method: "PATCH",
      body: validation.data,
      successMessage: "تم حفظ إصدار عرض مستقل.",
    })
  }

  async function reviewAction(
    action: "SUBMIT" | "REQUEST_CHANGES" | "APPROVE",
  ) {
    const completed = await runRequest({
      action:
        action === "SUBMIT"
          ? "SUBMIT"
          : action === "APPROVE"
            ? "APPROVE"
            : "REQUEST_CHANGES",
      url: `/api/discovery/sessions/${session.id}/proposal/review`,
      method: "POST",
      body: {
        action,
        ...(action === "REQUEST_CHANGES"
          ? { notes: reviewNotes }
          : {}),
      },
      successMessage:
        action === "SUBMIT"
          ? "أُرسل العرض للمراجعة."
          : action === "APPROVE"
            ? "تم اعتماد العرض وأصبح جاهزًا للإرسال."
            : "تم توثيق التعديلات المطلوبة.",
    })

    if (completed) {
      setShowApprove(false)
      setShowChanges(false)
      setReviewNotes("")
    }
  }

  async function deliveryRequest({
    action,
    body,
    successMessage,
  }: {
    action:
      | "PREPARE_LINK"
      | "PREPARE_WHATSAPP"
      | "SEND_EMAIL"
      | "CONFIRM_DELIVERY"
      | "REVOKE"
    body: unknown
    successMessage: string
  }) {
    setError("")
    setSuccess("")
    setLoadingAction(action)

    try {
      const response = await fetch(
        `/api/discovery/sessions/${session.id}/proposal/deliver`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تنفيذ تسليم العرض")
        return null
      }

      setSuccess(successMessage)
      router.refresh()
      return data.data
    } catch {
      setError("تعذر الاتصال بالخادم")
      return null
    } finally {
      setLoadingAction(null)
    }
  }

  async function prepareManualDelivery(
    channel: "SECURE_LINK" | "WHATSAPP",
  ) {
    const data = await deliveryRequest({
      action:
        channel === "WHATSAPP"
          ? "PREPARE_WHATSAPP"
          : "PREPARE_LINK",
      body: {
        action: "PREPARE",
        channel,
        recipientName,
        recipientEmail: recipientEmail || null,
        recipientPhone: recipientPhone || null,
      },
      successMessage:
        channel === "WHATSAPP"
          ? "تم إعداد رسالة واتساب. أكد التسليم بعد الإرسال."
          : "تم إنشاء الرابط. يظهر مرة واحدة، فانسخه ثم أكد التسليم.",
    })

    if (data) {
      setPreparedDelivery({
        deliveryId: data.deliveryId,
        channel,
        publicUrl: data.publicUrl,
        whatsappUrl: data.whatsappUrl,
        expiresAt: data.expiresAt,
      })
    }
  }

  async function sendEmailDelivery() {
    if (!recipientEmail.trim()) {
      setError("أدخل بريد العميل قبل الإرسال.")
      return
    }

    const data = await deliveryRequest({
      action: "SEND_EMAIL",
      body: {
        action: "SEND_EMAIL",
        channel: "EMAIL",
        recipientName,
        recipientEmail,
        recipientPhone: recipientPhone || null,
      },
      successMessage: "أُرسل العرض بالبريد وسُجل كنسخة مرسلة.",
    })

    if (data) setPreparedDelivery(null)
  }

  async function confirmPreparedDelivery() {
    if (!preparedDelivery) return

    const data = await deliveryRequest({
      action: "CONFIRM_DELIVERY",
      body: {
        action: "CONFIRM",
        deliveryId: preparedDelivery.deliveryId,
      },
      successMessage: "تم تأكيد تسليم العرض للعميل.",
    })

    if (data) setPreparedDelivery(null)
  }

  async function revokeDelivery(deliveryId?: string) {
    const data = await deliveryRequest({
      action: "REVOKE",
      body: {
        action: "REVOKE",
        ...(deliveryId ? { deliveryId } : {}),
      },
      successMessage: "تم إلغاء الرابط النشط.",
    })

    if (data) setPreparedDelivery(null)
  }

  async function copyPreparedLink() {
    if (!preparedDelivery) return

    try {
      await navigator.clipboard.writeText(preparedDelivery.publicUrl)
      setSuccess("تم نسخ رابط العرض.")
    } catch {
      setError("تعذر نسخ الرابط تلقائيًا. انسخه من الحقل.")
    }
  }

  const tabItems = [
    { id: "EDIT", label: "تحرير العرض" },
    { id: "CLIENT", label: "معاينة العميل" },
    {
      id: "DELIVERY",
      label: "الإرسال والرد",
      count: workspace?.deliveries.length ?? 0,
    },
    {
      id: "VERSIONS",
      label: "الإصدارات",
      count: workspace?.versions.length ?? 0,
    },
  ]

  return (
    <div className="d-flex flex-column gap-3">
      <AquaPageHeader
        badge="Central Proposal"
        title={`العرض المركزي — ${displayName}`}
        description="صياغة واعتماد وإرسال آمن بإصدارات، مع متابعة مشاهدة العميل وقراره."
        brandValue={workspace?.proposalNumber ?? "PROP‑02"}
      />

      <div className="d-flex flex-wrap gap-2">
        <AquaLinkButton
          href={`/dashboard/discovery/${session.id}/pricing`}
          variant="ghost"
        >
          رجوع إلى التسعير
        </AquaLinkButton>
        <AquaLinkButton
          href="/dashboard/proposals"
          variant="secondary"
        >
          قائمة العروض
        </AquaLinkButton>
      </div>

      {error ? (
        <AquaAlert variant="danger" title="تعذر التنفيذ">
          {error}
        </AquaAlert>
      ) : null}
      {success ? (
        <AquaAlert variant="success" title="تم التحديث">
          {success}
        </AquaAlert>
      ) : null}
      {workspace?.reviewNotes ? (
        <AquaAlert variant="warning" title="تعديلات مطلوبة">
          {workspace.reviewNotes}
        </AquaAlert>
      ) : null}
      {status === "APPROVED" ? (
        <AquaAlert
          variant="success"
          title="العرض معتمد داخليًا"
          icon={<CheckCircle2 />}
        >
          أصبح جاهزًا للإرسال عبر بريد العميل أو رابط آمن أو واتساب.
        </AquaAlert>
      ) : null}
      {status === "SENT" ? (
        <AquaAlert
          variant="info"
          title="العرض لدى العميل"
          icon={<Send />}
        >
          أُرسل الإصدار {workspace?.sentVersion}. تتم متابعة المشاهدة
          والرد من تبويب «الإرسال والرد».
        </AquaAlert>
      ) : null}
      {status === "CLIENT_CHANGES_REQUESTED" ? (
        <AquaAlert
          variant="warning"
          title="طلب العميل تعديلات"
          icon={<FileClock />}
        >
          {workspace?.clientResponseNotes ??
            "راجع ملاحظات العميل ثم احفظ إصدارًا جديدًا وأعد دورة المراجعة."}
        </AquaAlert>
      ) : null}
      {status === "ACCEPTED" ? (
        <AquaAlert
          variant="success"
          title="قبل العميل العرض"
          icon={<CheckCircle2 />}
        >
          سُجل القبول باسم {workspace?.clientResponseName ?? "العميل"}.
          التحويل إلى مشروع يبقى خطوة مستقلة ضمن PROJ‑01.
        </AquaAlert>
      ) : null}
      {status === "REJECTED" ? (
        <AquaAlert
          variant="danger"
          title="رفض العميل العرض"
        >
          {workspace?.clientResponseNotes ??
            "تم إغلاق هذه النسخة وفق رد العميل."}
        </AquaAlert>
      ) : null}
      {dirty && workspace ? (
        <AquaAlert variant="warning" title="تعديلات غير محفوظة">
          احفظ إصدارًا جديدًا قبل إرسال العرض للمراجعة.
        </AquaAlert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">حالة العرض</div>
            <div className="mt-2">
              <AquaBadge
                variant={workspaceStatusVariant(status)}
                dot
              >
                {workspaceStatusLabel(status)}
              </AquaBadge>
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">رقم العرض</div>
            <div className="h5 fw-black mb-1 mt-2" dir="ltr">
              {workspace?.proposalNumber ?? "يُنشأ عند الحفظ"}
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الإصدار</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {workspace?.currentVersion ?? 0}
            </div>
            <div className="small aqua-soft">
              تسعير v{source.pricingVersion}
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">قيمة العميل</div>
            <div className="h5 fw-black mb-1 mt-2" dir="ltr">
              {money(pricing.totals.grandTotal)}
            </div>
            <div className="small aqua-soft">من التسعير المعتمد</div>
          </AquaCard>
        </div>
      </div>

      <AquaTabs
        items={tabItems}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as TabId)}
      />

      {activeTab === "EDIT" ? (
        <div className="row g-3">
          <div className="col-12 col-xl-8">
            <div className="d-flex flex-column gap-3">
              <AquaDataPanel
                eyebrow="Proposal identity"
                title="هوية العرض وصلاحيته"
                description="هذه المعلومات تظهر في النسخة المعتمدة للعميل."
              >
                <div className="row g-3">
                  <div className="col-12 col-md-7">
                    <AquaInput
                      label="عنوان العرض"
                      value={draft.title}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <AquaInput
                      label="الصلاحية بالأيام"
                      type="number"
                      min="1"
                      max="365"
                      value={draft.validityDays}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          validityDays: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <AquaInput
                      label="المدة التقديرية"
                      value={draft.estimatedDuration}
                      disabled={!canEdit}
                      placeholder="مثال: 6–8 أسابيع"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          estimatedDuration: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </AquaDataPanel>

              <AquaDataPanel
                eyebrow="Versioned narrative"
                title="أقسام العرض"
                description="أقسام CLIENT تظهر في معاينة العميل؛ أقسام INTERNAL تبقى ضمن العرض المركزي فقط."
                meta={
                  <AquaBadge variant="muted" size="sm">
                    {draft.sections.length} أقسام
                  </AquaBadge>
                }
              >
                <div className="d-flex flex-column gap-3">
                  {draft.sections.map((section, index) => (
                    <AquaCard
                      key={section.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <div className="d-flex flex-wrap gap-2">
                          <AquaBadge variant="muted" size="sm">
                            #{index + 1}
                          </AquaBadge>
                          <AquaBadge
                            variant={
                              section.audience === "CLIENT"
                                ? "blue"
                                : "warning"
                            }
                            size="sm"
                          >
                            {audienceLabel(section.audience)}
                          </AquaBadge>
                        </div>
                        {canEdit && draft.sections.length > 1 ? (
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Trash2 />}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                sections: current.sections.filter(
                                  (item) => item.id !== section.id,
                                ),
                              }))
                            }
                          >
                            إزالة
                          </AquaButton>
                        ) : null}
                      </div>
                      <div className="row g-3">
                        <div className="col-12 col-md-3">
                          <AquaSelect
                            label="النوع"
                            value={section.kind}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateSection(section.id, {
                                kind: event.target
                                  .value as ProposalSection["kind"],
                              })
                            }
                          >
                            {PROPOSAL_SECTION_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {proposalSectionKindLabel(kind)}
                              </option>
                            ))}
                          </AquaSelect>
                        </div>
                        <div className="col-12 col-md-3">
                          <AquaSelect
                            label="الجمهور"
                            value={section.audience}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateSection(section.id, {
                                audience: event.target
                                  .value as ProposalSection["audience"],
                              })
                            }
                          >
                            {PROPOSAL_AUDIENCES.map((audience) => (
                              <option key={audience} value={audience}>
                                {audienceLabel(audience)}
                              </option>
                            ))}
                          </AquaSelect>
                        </div>
                        <div className="col-12 col-md-6">
                          <AquaInput
                            label="عنوان القسم"
                            value={section.title}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateSection(section.id, {
                                title: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-12">
                          <AquaTextarea
                            label="المحتوى"
                            rows={6}
                            value={section.body}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateSection(section.id, {
                                body: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </AquaCard>
                  ))}
                </div>
                {canEdit ? (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <AquaButton
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Plus />}
                      onClick={() => addSection("CLIENT")}
                    >
                      إضافة قسم عميل
                    </AquaButton>
                    <AquaButton
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Plus />}
                      onClick={() => addSection("INTERNAL")}
                    >
                      إضافة قسم داخلي
                    </AquaButton>
                  </div>
                ) : null}
              </AquaDataPanel>

              <AquaDataPanel
                eyebrow="Payment schedule"
                title="جدول الدفعات"
                description="يجب أن يساوي مجموع النسب 100% قبل إرسال العرض للمراجعة."
              >
                <div className="d-flex flex-column gap-3">
                  {draft.paymentMilestones.map((milestone) => (
                    <AquaCard
                      key={milestone.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-4">
                          <AquaInput
                            label="اسم الدفعة"
                            value={milestone.label}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                paymentMilestones:
                                  current.paymentMilestones.map(
                                    (item) =>
                                      item.id === milestone.id
                                        ? {
                                            ...item,
                                            label: event.target.value,
                                          }
                                        : item,
                                  ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-12 col-md-2">
                          <AquaInput
                            label="النسبة %"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            dir="ltr"
                            value={milestone.percentage}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                paymentMilestones:
                                  current.paymentMilestones.map(
                                    (item) =>
                                      item.id === milestone.id
                                        ? {
                                            ...item,
                                            percentage:
                                              event.target.value,
                                          }
                                        : item,
                                  ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-12 col-md-5">
                          <AquaInput
                            label="شرط الاستحقاق"
                            value={milestone.dueCondition}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                paymentMilestones:
                                  current.paymentMilestones.map(
                                    (item) =>
                                      item.id === milestone.id
                                        ? {
                                            ...item,
                                            dueCondition:
                                              event.target.value,
                                          }
                                        : item,
                                  ),
                              }))
                            }
                          />
                        </div>
                        <div className="col-12 col-md-1">
                          {canEdit ? (
                            <AquaButton
                              variant="ghost"
                              size="sm"
                              aria-label="إزالة الدفعة"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  paymentMilestones:
                                    current.paymentMilestones.filter(
                                      (item) =>
                                        item.id !== milestone.id,
                                    ),
                                }))
                              }
                            >
                              <Trash2 aria-hidden="true" />
                            </AquaButton>
                          ) : null}
                        </div>
                      </div>
                    </AquaCard>
                  ))}
                </div>
                {canEdit ? (
                  <AquaButton
                    className="mt-3"
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Plus />}
                    onClick={addMilestone}
                  >
                    إضافة دفعة
                  </AquaButton>
                ) : null}
              </AquaDataPanel>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="d-flex flex-column gap-3">
              <AquaDataPanel
                eyebrow="Approved pricing"
                title="الملخص التجاري"
                description="مشتق على الخادم من التسعير المعتمد، ولا يتضمن التكلفة أو الهامش."
              >
                <AquaDetailList
                  columns={1}
                  items={[
                    {
                      label: "مجموع البنود",
                      value: money(pricing.totals.clientSubtotal),
                      dir: "ltr",
                    },
                    {
                      label: "الخصم",
                      value: money(pricing.totals.discountAmount),
                      dir: "ltr",
                    },
                    {
                      label: "الضريبة",
                      value: money(pricing.totals.taxAmount),
                      dir: "ltr",
                    },
                    {
                      label: "الإجمالي",
                      value: money(pricing.totals.grandTotal),
                      dir: "ltr",
                    },
                  ]}
                />
              </AquaDataPanel>

              <AquaDataPanel
                eyebrow="Human gate"
                title="الحفظ والمراجعة"
                description="الحفظ ينشئ إصدارًا مستقلًا. الاعتماد لا يرسل العرض."
              >
                {reviewIssues.length > 0 ? (
                  <AquaAlert
                    variant="warning"
                    title="قبل المراجعة"
                  >
                    <ul className="mb-0">
                      {reviewIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </AquaAlert>
                ) : (
                  <AquaAlert
                    variant="success"
                    title="جاهز للمراجعة"
                  >
                    اكتملت المدة وجدول الدفعات والقيمة التجارية.
                  </AquaAlert>
                )}

                {canEdit ? (
                  <div className="d-grid gap-2 mt-3">
                    <AquaButton
                      variant="secondary"
                      leadingIcon={<Save />}
                      loading={loadingAction === "SAVE"}
                      loadingLabel="جارٍ حفظ الإصدار"
                      disabled={!validation.success}
                      onClick={saveVersion}
                    >
                      حفظ إصدار عرض
                    </AquaButton>
                    {workspace &&
                    (status === "DRAFT" ||
                      status === "CHANGES_REQUESTED") ? (
                      <AquaButton
                        leadingIcon={<Send />}
                        loading={loadingAction === "SUBMIT"}
                        loadingLabel="جارٍ الإرسال"
                        disabled={dirty || reviewIssues.length > 0}
                        onClick={() => reviewAction("SUBMIT")}
                      >
                        إرسال للمراجعة
                      </AquaButton>
                    ) : null}
                  </div>
                ) : null}

                {status === "IN_REVIEW" && canApprove ? (
                  <div className="d-grid gap-2 mt-3">
                    <AquaButton
                      leadingIcon={<ShieldCheck />}
                      onClick={() => setShowApprove(true)}
                    >
                      اعتماد العرض
                    </AquaButton>
                    <AquaButton
                      variant="secondary"
                      onClick={() => setShowChanges(true)}
                    >
                      طلب تعديلات
                    </AquaButton>
                  </div>
                ) : null}

                {status === "IN_REVIEW" &&
                approvalBlockedBySelf ? (
                  <AquaAlert
                    className="mt-3"
                    variant="warning"
                    title="فصل الاعتماد"
                  >
                    يجب أن يعتمد هذا الإصدار مستخدم مخوّل آخر.
                  </AquaAlert>
                ) : null}
              </AquaDataPanel>

              <AquaDataPanel
                eyebrow="Source trace"
                title="مصادر الإصدار"
                description="العرض مرتبط بالتقرير والتسعير المعتمدين."
              >
                <AquaDetailList
                  columns={1}
                  items={[
                    {
                      label: "تقرير الاكتشاف",
                      value: `v${source.reportVersion}`,
                      dir: "ltr",
                    },
                    {
                      label: "التسعير",
                      value: `v${source.pricingVersion}`,
                      dir: "ltr",
                    },
                  ]}
                />
              </AquaDataPanel>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "CLIENT" ? (
        <AquaDataPanel
          eyebrow="Client-safe projection"
          title="معاينة نسخة العميل"
          description="لا تتضمن الأقسام الداخلية أو التكلفة أو الربح أو الهامش."
          meta={<Eye aria-hidden="true" />}
        >
          {clientProjection ? (
            <ClientPreview
              content={clientProjection}
              money={money}
            />
          ) : (
            <AquaAlert variant="warning" title="المعاينة غير متاحة">
              راجع حقول العرض أولًا.
            </AquaAlert>
          )}
        </AquaDataPanel>
      ) : null}

      {activeTab === "DELIVERY" ? (
        <div className="row g-3">
          <div className="col-12 col-xl-7">
            <AquaDataPanel
              eyebrow="Secure delivery"
              title="إرسال النسخة المعتمدة"
              description="كل رابط مربوط بإصدار وHash محددين. لا تُخزن قيمة الرابط السرية، ويُلغى الرابط السابق عند تأكيد إرسال جديد."
              meta={<Send aria-hidden="true" />}
            >
              {status !== "APPROVED" && status !== "SENT" ? (
                <AquaAlert
                  variant="warning"
                  title="الإرسال غير متاح في هذه الحالة"
                >
                  يجب أن يكون العرض معتمدًا أو مرسلًا لإعادة الإرسال.
                </AquaAlert>
              ) : null}

              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <AquaInput
                    label="اسم المستلم"
                    value={recipientName}
                    disabled={!canDeliver}
                    onChange={(event) =>
                      setRecipientName(event.target.value)
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <AquaInput
                    label="البريد الإلكتروني"
                    type="email"
                    dir="ltr"
                    value={recipientEmail}
                    disabled={!canDeliver}
                    onChange={(event) =>
                      setRecipientEmail(event.target.value)
                    }
                  />
                </div>
                <div className="col-12 col-md-4">
                  <AquaInput
                    label="رقم واتساب"
                    type="tel"
                    dir="ltr"
                    value={recipientPhone}
                    disabled={!canDeliver}
                    onChange={(event) =>
                      setRecipientPhone(event.target.value)
                    }
                  />
                </div>
              </div>

              {canDeliver &&
              (status === "APPROVED" || status === "SENT") ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <AquaButton
                    leadingIcon={<Mail />}
                    loading={loadingAction === "SEND_EMAIL"}
                    loadingLabel="جارٍ إرسال البريد"
                    disabled={
                      recipientName.trim().length < 2 ||
                      !recipientEmail.trim()
                    }
                    onClick={sendEmailDelivery}
                  >
                    إرسال بالبريد
                  </AquaButton>
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<Link2 />}
                    loading={loadingAction === "PREPARE_LINK"}
                    loadingLabel="جارٍ إنشاء الرابط"
                    disabled={recipientName.trim().length < 2}
                    onClick={() =>
                      prepareManualDelivery("SECURE_LINK")
                    }
                  >
                    إنشاء رابط آمن
                  </AquaButton>
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<MessageCircle />}
                    loading={loadingAction === "PREPARE_WHATSAPP"}
                    loadingLabel="جارٍ إعداد واتساب"
                    disabled={
                      recipientName.trim().length < 2 ||
                      !recipientPhone.trim()
                    }
                    onClick={() =>
                      prepareManualDelivery("WHATSAPP")
                    }
                  >
                    إعداد واتساب
                  </AquaButton>
                </div>
              ) : null}

              {preparedDelivery ? (
                <AquaCard
                  className="mt-3"
                  variant="soft"
                  padding="md"
                >
                  <AquaAlert
                    variant="warning"
                    title="الرابط يظهر في هذه الجلسة فقط"
                  >
                    انسخه أو أرسل رسالة واتساب، ثم أكد التسليم. إنشاء
                    الرابط وحده لا يغيّر حالة العرض إلى «مرسل».
                  </AquaAlert>
                  <AquaInput
                    label="رابط العميل الآمن"
                    dir="ltr"
                    readOnly
                    value={preparedDelivery.publicUrl}
                  />
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <AquaButton
                      variant="secondary"
                      leadingIcon={<Copy />}
                      onClick={copyPreparedLink}
                    >
                      نسخ الرابط
                    </AquaButton>
                    {preparedDelivery.whatsappUrl ? (
                      <AquaLinkButton
                        href={preparedDelivery.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        variant="secondary"
                        leadingIcon={<MessageCircle />}
                      >
                        فتح واتساب
                      </AquaLinkButton>
                    ) : null}
                    <AquaButton
                      leadingIcon={<CheckCircle2 />}
                      loading={
                        loadingAction === "CONFIRM_DELIVERY"
                      }
                      loadingLabel="جارٍ التأكيد"
                      onClick={confirmPreparedDelivery}
                    >
                      تأكيد تم التسليم
                    </AquaButton>
                    <AquaButton
                      variant="ghost"
                      loading={loadingAction === "REVOKE"}
                      loadingLabel="جارٍ الإلغاء"
                      onClick={() =>
                        revokeDelivery(preparedDelivery.deliveryId)
                      }
                    >
                      إلغاء الرابط
                    </AquaButton>
                  </div>
                </AquaCard>
              ) : null}
            </AquaDataPanel>
          </div>

          <div className="col-12 col-xl-5">
            <AquaDataPanel
              eyebrow="Client outcome"
              title="حالة العميل"
              description="القبول والتعديل والرفض مسجلة على الإصدار المرسل نفسه."
            >
              <AquaDetailList
                columns={1}
                items={[
                  {
                    label: "الحالة",
                    value: workspaceStatusLabel(status),
                  },
                  {
                    label: "الإصدار المرسل",
                    value: workspace?.sentVersion
                      ? `v${workspace.sentVersion}`
                      : "—",
                    dir: "ltr",
                  },
                  {
                    label: "وقت الإرسال",
                    value: workspace?.sentAt
                      ? formatDate.format(new Date(workspace.sentAt))
                      : "—",
                  },
                  {
                    label: "رد العميل",
                    value: workspace?.clientRespondedAt
                      ? `${workspace.clientResponseName ?? "العميل"} · ${formatDate.format(
                          new Date(workspace.clientRespondedAt),
                        )}`
                      : "لم يصل رد بعد",
                  },
                ]}
              />

              {status === "SENT" && canDeliver ? (
                <AquaButton
                  className="mt-3"
                  variant="ghost"
                  loading={loadingAction === "REVOKE"}
                  loadingLabel="جارٍ الإلغاء"
                  onClick={() => revokeDelivery()}
                >
                  إلغاء جميع الروابط النشطة
                </AquaButton>
              ) : null}
            </AquaDataPanel>
          </div>

          <div className="col-12">
            <AquaDataPanel
              eyebrow="Delivery history"
              title="سجل التسليم والمشاهدة"
              description="لا يعرض الروابط السرية؛ يحتفظ بالقناة والإصدار والمستلم والنتيجة فقط."
            >
              {workspace?.deliveries.length ? (
                <div className="d-flex flex-column gap-2">
                  {workspace.deliveries.map((delivery) => (
                    <AquaCard
                      key={delivery.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                          <div className="d-flex flex-wrap gap-2 align-items-center">
                            <strong>
                              {deliveryChannelLabel(delivery.channel)}
                            </strong>
                            <AquaBadge
                              size="sm"
                              variant={
                                delivery.status === "SENT"
                                  ? "success"
                                  : delivery.status === "FAILED"
                                    ? "danger"
                                    : delivery.status === "PREPARED"
                                      ? "warning"
                                      : "muted"
                              }
                            >
                              {deliveryStatusLabel(delivery.status)}
                            </AquaBadge>
                            <AquaBadge variant="muted" size="sm">
                              v{delivery.version}
                            </AquaBadge>
                          </div>
                          <div className="small aqua-muted mt-2">
                            {delivery.recipientName ?? "مستلم غير محدد"}
                            {delivery.recipientEmail
                              ? ` · ${delivery.recipientEmail}`
                              : ""}
                            {delivery.recipientPhone
                              ? ` · ${delivery.recipientPhone}`
                              : ""}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="small">
                            {delivery.sentAt
                              ? formatDate.format(
                                  new Date(delivery.sentAt),
                                )
                              : formatDate.format(
                                  new Date(delivery.createdAt),
                                )}
                          </div>
                          <div className="small aqua-muted mt-1">
                            المشاهدات: {delivery.viewCount}
                          </div>
                          {delivery.status === "PREPARED" &&
                          canDeliver ? (
                            <AquaButton
                              className="mt-2"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                revokeDelivery(delivery.id)
                              }
                            >
                              إلغاء
                            </AquaButton>
                          ) : null}
                        </div>
                      </div>
                    </AquaCard>
                  ))}
                </div>
              ) : (
                <AquaAlert variant="neutral" title="لا يوجد تسليم بعد">
                  سيظهر هنا سجل البريد والروابط وواتساب بعد أول محاولة.
                </AquaAlert>
              )}
            </AquaDataPanel>
          </div>
        </div>
      ) : null}

      {activeTab === "VERSIONS" ? (
        <AquaDataPanel
          eyebrow="Immutable history"
          title="سجل إصدارات العرض"
          description="كل حفظ يضيف إصدارًا مستقلًا مرتبطًا بمصدر التسعير."
          meta={<FileClock aria-hidden="true" />}
        >
          {workspace?.versions.length ? (
            <div className="d-flex flex-column gap-2">
              {workspace.versions.map((version) => (
                <AquaCard
                  key={version.id}
                  variant="soft"
                  padding="sm"
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div>
                      <div className="fw-bold">
                        إصدار {version.version}
                      </div>
                      <div className="small aqua-muted mt-1">
                        {version.createdBy?.name ?? "مستخدم سابق"} ·{" "}
                        {formatDate.format(new Date(version.createdAt))}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <AquaBadge variant="muted" size="sm">
                        تسعير v{version.pricingVersion}
                      </AquaBadge>
                      <AquaButton
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Eye />}
                        disabled={!version.content}
                        onClick={() => setPreviewVersion(version)}
                      >
                        معاينة
                      </AquaButton>
                    </div>
                  </div>
                </AquaCard>
              ))}
            </div>
          ) : (
            <AquaAlert variant="neutral" title="لا توجد إصدارات">
              احفظ أول إصدار لبدء سجل العرض.
            </AquaAlert>
          )}
        </AquaDataPanel>
      ) : null}

      <AquaConfirmDialog
        open={showApprove}
        onClose={() => setShowApprove(false)}
        onConfirm={() => reviewAction("APPROVE")}
        title="اعتماد العرض المركزي"
        description="سيصبح العرض جاهزًا للإرسال، لكنه لن يُرسل تلقائيًا ولن ينشئ مشروعًا أو عقدًا."
        confirmLabel="اعتماد العرض"
        loading={loadingAction === "APPROVE"}
        tone="neutral"
        icon={<ShieldCheck />}
      />

      <AquaModal
        open={showChanges}
        onClose={() => setShowChanges(false)}
        title="طلب تعديلات على العرض"
        description="دوّن ملاحظات واضحة ليُنشئ المُعد إصدارًا جديدًا."
        size="sm"
        closeOnBackdrop={loadingAction !== "REQUEST_CHANGES"}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              disabled={loadingAction === "REQUEST_CHANGES"}
              onClick={() => setShowChanges(false)}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              disabled={reviewNotes.trim().length < 10}
              loading={loadingAction === "REQUEST_CHANGES"}
              loadingLabel="جارٍ الحفظ"
              onClick={() => reviewAction("REQUEST_CHANGES")}
            >
              توثيق الطلب
            </AquaButton>
          </div>
        }
      >
        <AquaTextarea
          label="التعديلات المطلوبة"
          rows={6}
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
        />
      </AquaModal>

      <AquaModal
        open={Boolean(previewVersion)}
        onClose={() => setPreviewVersion(null)}
        title={`معاينة الإصدار ${previewVersion?.version ?? ""}`}
        size="xl"
      >
        {previewVersion?.content ? (
          <ClientPreview
            content={clientSafeProposalProjection(
              previewVersion.content,
            )}
            money={money}
          />
        ) : null}
      </AquaModal>
    </div>
  )
}

function ClientPreview({
  content,
  money,
}: {
  content: ReturnType<typeof clientSafeProposalProjection>
  money: (value: string) => string
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <div className="h3 fw-black mb-2">{content.title}</div>
        <div className="aqua-muted">
          صالح لمدة {content.validityDays} يومًا · المدة التقديرية:{" "}
          {content.estimatedDuration || "غير محددة"}
        </div>
      </div>

      {content.sections.map((section) => (
        <section key={section.id}>
          <h3 className="h5 fw-bold">{section.title}</h3>
          <div className="aqua-pre-line">{section.body}</div>
        </section>
      ))}

      <section>
        <h3 className="h5 fw-bold">البنود التجارية</h3>
        <div className="d-flex flex-column gap-2">
          {content.commercial.items.map((item) => (
            <AquaCard key={item.id} variant="soft" padding="sm">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <div className="fw-bold">{item.title}</div>
                  {item.description ? (
                    <div className="small aqua-muted mt-1">
                      {item.description}
                    </div>
                  ) : null}
                </div>
                <div dir="ltr">{money(item.lineTotal)}</div>
              </div>
            </AquaCard>
          ))}
        </div>
        <AquaDetailList
          className="mt-3"
          columns={1}
          items={[
            {
              label: "الإجمالي النهائي",
              value: money(content.commercial.totals.grandTotal),
              dir: "ltr",
            },
          ]}
        />
      </section>

      <section>
        <h3 className="h5 fw-bold">جدول الدفعات</h3>
        {content.paymentMilestones.length ? (
          <div className="d-flex flex-column gap-2">
            {content.paymentMilestones.map((milestone) => (
              <AquaCard
                key={milestone.id}
                variant="soft"
                padding="sm"
              >
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <div className="fw-bold">{milestone.label}</div>
                    <div className="small aqua-muted mt-1">
                      {milestone.dueCondition}
                    </div>
                  </div>
                  <AquaBadge variant="blue">
                    {milestone.percentage}%
                  </AquaBadge>
                </div>
              </AquaCard>
            ))}
          </div>
        ) : (
          <div className="aqua-muted">لم يُحدد بعد.</div>
        )}
      </section>
    </div>
  )
}
