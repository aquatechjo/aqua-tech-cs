"use client"

import {
  CheckCircle2,
  Eye,
  FileClock,
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
}

type TabId = "EDIT" | "CLIENT" | "VERSIONS"

function workspaceStatusLabel(status: ProposalWorkspaceStatus) {
  const labels: Record<ProposalWorkspaceStatus, string> = {
    DRAFT: "مسودة",
    IN_REVIEW: "قيد المراجعة",
    CHANGES_REQUESTED: "تحتاج تعديلات",
    APPROVED: "معتمدة",
  }
  return labels[status]
}

function workspaceStatusVariant(
  status: ProposalWorkspaceStatus,
): AquaBadgeProps["variant"] {
  if (status === "APPROVED") return "success"
  if (status === "IN_REVIEW") return "blue"
  if (status === "CHANGES_REQUESTED") return "warning"
  return "aqua"
}

function audienceLabel(audience: ProposalSection["audience"]) {
  return audience === "CLIENT" ? "نسخة العميل" : "داخلي فقط"
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
  timeZone: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(initialDraft)
  const [activeTab, setActiveTab] = useState<TabId>("EDIT")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loadingAction, setLoadingAction] = useState<
    "SAVE" | "SUBMIT" | "REQUEST_CHANGES" | "APPROVE" | null
  >(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const [reviewNotes, setReviewNotes] = useState("")
  const [previewVersion, setPreviewVersion] = useState<
    WorkspaceItem["versions"][number] | null
  >(null)
  const status = workspace?.status ?? "DRAFT"
  const locked = status === "IN_REVIEW" || status === "APPROVED"
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
            ? "تم اعتماد العرض وأصبح جاهزًا للإرسال في PROP‑02."
            : "تم توثيق التعديلات المطلوبة.",
    })

    if (completed) {
      setShowApprove(false)
      setShowChanges(false)
      setReviewNotes("")
    }
  }

  const tabItems = [
    { id: "EDIT", label: "تحرير العرض" },
    { id: "CLIENT", label: "معاينة العميل" },
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
        description="صياغة فنية ومالية بإصدارات، مع نسخة عميل آمنة واعتماد بشري قبل الإرسال."
        brandValue={workspace?.proposalNumber ?? "PROP‑01"}
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
          أصبح جاهزًا لمرحلة الإرسال والمشاركة في PROP‑02. لم يُرسل
          للعميل ولم يُنشأ مشروع أو عقد.
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
        description="سيصبح العرض جاهزًا للإرسال في PROP‑02، لكنه لن يُرسل ولن ينشئ مشروعًا أو عقدًا الآن."
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
