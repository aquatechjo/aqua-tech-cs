"use client"

import {
  Calculator,
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
  AquaFormSection,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaSelect,
  AquaTextarea,
} from "@/components/aqua"
import type { AquaBadgeProps } from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  DiscoveryServiceTrack,
  PricingWorkspaceStatus,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import {
  calculatePricingTotals,
  PRICING_ADJUSTMENT_MODES,
  PRICING_AUDIENCES,
  PRICING_ITEM_KINDS,
  pricingDraftInputSchema,
  pricingItemKindLabel,
  type PricingDraftInput,
  type PricingLineItem,
  type PricingVersionContent,
} from "@/lib/pricing"

type WorkspaceItem = {
  id: string
  status: PricingWorkspaceStatus
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
    content: PricingVersionContent | null
    discoveryReportVersion: number
    discoveryContentHash: string
    createdAt: string
    createdBy: {
      id: string
      name: string
    } | null
  }>
}

function pricingStatusLabel(status: PricingWorkspaceStatus) {
  const labels: Record<PricingWorkspaceStatus, string> = {
    DRAFT: "مسودة",
    IN_REVIEW: "قيد المراجعة",
    CHANGES_REQUESTED: "تحتاج تعديلات",
    APPROVED: "معتمدة",
  }
  return labels[status]
}

function pricingStatusVariant(
  status: PricingWorkspaceStatus,
): AquaBadgeProps["variant"] {
  if (status === "APPROVED") return "success"
  if (status === "IN_REVIEW") return "blue"
  if (status === "CHANGES_REQUESTED") return "warning"
  return "aqua"
}

function audienceLabel(audience: PricingLineItem["audience"]) {
  return audience === "CLIENT" ? "يظهر للعميل" : "داخلي فقط"
}

function adjustmentModeLabel(
  mode: PricingDraftInput["discount"]["mode"],
) {
  const labels: Record<
    PricingDraftInput["discount"]["mode"],
    string
  > = {
    NONE: "بدون",
    PERCENTAGE: "نسبة مئوية",
    FIXED: "مبلغ ثابت",
  }
  return labels[mode]
}

function lineKey() {
  return `item-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export default function PricingWorkspaceClient({
  session,
  displayName,
  report,
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
  report: {
    id: string
    version: number
    contentHash: string
    scopeItems: string[]
  }
  workspace: WorkspaceItem | null
  initialDraft: PricingDraftInput
  canManage: boolean
  canApprove: boolean
  approvalBlockedBySelf: boolean
  timeZone: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<PricingDraftInput>(initialDraft)
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
  const previewContent = previewVersion?.content ?? null
  const status = workspace?.status ?? "DRAFT"
  const locked = status === "IN_REVIEW" || status === "APPROVED"
  const canEdit = canManage && !locked
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const validation = useMemo(
    () => pricingDraftInputSchema.safeParse(draft),
    [draft],
  )
  const totals = useMemo(() => {
    if (!validation.success) return null
    try {
      return calculatePricingTotals(validation.data)
    } catch {
      return null
    }
  }, [validation])
  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })

  function money(value: string, currency = draft.currency) {
    return `${Number(value).toLocaleString("en-JO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`
  }

  function updateItem(
    id: string,
    patch: Partial<PricingLineItem>,
  ) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }))
  }

  function addItem(audience: PricingLineItem["audience"]) {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: lineKey(),
          kind: audience === "CLIENT" ? "DELIVERABLE" : "SERVICE",
          audience,
          title: "",
          description: "",
          quantity: "1",
          unitPrice: "0.00",
          unitCost: "0.00",
          internalNotes: "",
        },
      ],
    }))
  }

  function removeItem(id: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
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
          "راجع بيانات بنود التسعير",
      )
      return
    }

    if (!totals) {
      setError(
        "راجع الخصم والقيم؛ لا يمكن أن يتجاوز الخصم مجموع العميل",
      )
      return
    }

    await runRequest({
      action: "SAVE",
      url: `/api/discovery/sessions/${session.id}/pricing`,
      method: "PATCH",
      body: validation.data,
      successMessage: "تم حفظ إصدار تسعير بشري مستقل.",
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
      url: `/api/discovery/sessions/${session.id}/pricing/review`,
      method: "POST",
      body: {
        action,
        ...(action === "REQUEST_CHANGES"
          ? { notes: reviewNotes }
          : {}),
      },
      successMessage:
        action === "SUBMIT"
          ? "أُرسل التسعير للمراجعة."
          : action === "APPROVE"
            ? "تم اعتماد التسعير وأصبح جاهزًا لبناء العرض."
            : "تم توثيق التعديلات المطلوبة.",
    })

    if (completed) {
      setShowApprove(false)
      setShowChanges(false)
      setReviewNotes("")
    }
  }

  return (
    <div className="aqua-pricing-page">
      <AquaPageHeader
        badge="Human Pricing"
        title={`النطاق والتسعير — ${displayName}`}
        description="حوّل التقرير المعتمد إلى بنود قابلة للتسعير، واحفظ التاريخ التجاري قبل إنشاء العرض."
        brandValue="Pricing Gate"
      />

      <div className="aqua-workspace-actions">
        <AquaLinkButton
          href={`/dashboard/discovery/${session.id}/report`}
          variant="ghost"
        >
          رجوع إلى التقرير
        </AquaLinkButton>
        <AquaLinkButton
          href={`/dashboard/discovery/${session.id}`}
          variant="secondary"
        >
          جلسة الاكتشاف
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
          title="التسعير معتمد"
          icon={<CheckCircle2 />}
        >
          أصبح هذا الإصدار مدخلًا صالحًا لبناء العرض المركزي في
          PROP‑01. لم يُنشئ النظام عرضًا أو يرسله للعميل تلقائيًا.
          <div className="mt-3">
            <AquaLinkButton
              href={`/dashboard/discovery/${session.id}/proposal`}
              variant="primary"
              size="sm"
            >
              فتح مساحة العرض
            </AquaLinkButton>
          </div>
        </AquaAlert>
      ) : null}

      {dirty && workspace ? (
        <AquaAlert variant="warning" title="تعديلات غير محفوظة">
          احفظ إصدارًا جديدًا قبل إرسال التسعير للمراجعة.
        </AquaAlert>
      ) : null}

      <div className="row g-3 aqua-workspace-metrics">
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">حالة التسعير</div>
            <div className="mt-2">
              <AquaBadge variant={pricingStatusVariant(status)} dot>
                {pricingStatusLabel(status)}
              </AquaBadge>
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الإصدار الحالي</div>
            <div className="h4 fw-black mb-1 mt-2" dir="ltr">
              {workspace?.currentVersion ?? 0}
            </div>
            <div className="small aqua-soft">
              تقرير الاكتشاف v{report.version}
            </div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">إجمالي العميل</div>
            <div className="h5 fw-black mb-1 mt-2" dir="ltr">
              {totals
                ? money(totals.display.grandTotal)
                : "—"}
            </div>
            <div className="small aqua-soft">بعد الخصم والضريبة</div>
          </AquaCard>
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <AquaCard variant="soft" padding="sm" className="h-100">
            <div className="small aqua-muted">الهامش المتوقع</div>
            <div className="h5 fw-black mb-1 mt-2" dir="ltr">
              {totals ? `${totals.display.marginPercent}%` : "—"}
            </div>
            <div className="small aqua-soft">قبل الضريبة</div>
          </AquaCard>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="d-flex flex-column gap-3">
            <AquaDataPanel
              eyebrow="Approved discovery scope"
              title="مرجع النطاق المعتمد"
              description="هذا المرجع للقراءة فقط؛ تعديل النطاق التجاري يتم كبنود تسعير بإصدار جديد."
              meta={
                <AquaBadge variant="success" size="sm">
                  تقرير v{report.version}
                </AquaBadge>
              }
            >
              <ul className="mb-0">
                {report.scopeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Scope and commercial lines"
              title="بنود الخدمة والمخرجات والمراحل"
              description="بنود CLIENT تدخل سعر العميل. بنود INTERNAL وتكاليف جميع البنود لا تظهر للعميل."
              meta={
                <AquaBadge variant="muted" size="sm">
                  {draft.items.length} بنود
                </AquaBadge>
              }
            >
              <AquaFormSection
                eyebrow="Pricing identity"
                title="هوية الإصدار"
              >
                <div className="row g-3">
                  <div className="col-12 col-md-8">
                    <AquaInput
                      label="عنوان التسعير"
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
                  <div className="col-12 col-md-4">
                    <AquaInput
                      label="العملة"
                      value={draft.currency}
                      maxLength={3}
                      dir="ltr"
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          currency: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                </div>
              </AquaFormSection>

              <div className="d-flex flex-column gap-3 mt-3">
                {draft.items.map((item, index) => (
                  <AquaCard
                    key={item.id}
                    variant="soft"
                    padding="sm"
                  >
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <AquaBadge variant="muted" size="sm">
                          #{index + 1}
                        </AquaBadge>
                        <AquaBadge
                          variant={
                            item.audience === "CLIENT"
                              ? "blue"
                              : "warning"
                          }
                          size="sm"
                        >
                          {audienceLabel(item.audience)}
                        </AquaBadge>
                        <AquaBadge variant="aqua" size="sm">
                          {pricingItemKindLabel(item.kind)}
                        </AquaBadge>
                      </div>
                      {canEdit && draft.items.length > 1 ? (
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Trash2 />}
                          onClick={() => removeItem(item.id)}
                        >
                          إزالة
                        </AquaButton>
                      ) : null}
                    </div>

                    <div className="row g-3">
                      <div className="col-12 col-md-3">
                        <AquaSelect
                          label="النوع"
                          value={item.kind}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              kind: event.target
                                .value as PricingLineItem["kind"],
                            })
                          }
                        >
                          {PRICING_ITEM_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {pricingItemKindLabel(kind)}
                            </option>
                          ))}
                        </AquaSelect>
                      </div>
                      <div className="col-12 col-md-3">
                        <AquaSelect
                          label="الجمهور"
                          value={item.audience}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const audience = event.target
                              .value as PricingLineItem["audience"]
                            updateItem(item.id, {
                              audience,
                              ...(audience === "INTERNAL"
                                ? { unitPrice: "0.00" }
                                : {}),
                            })
                          }}
                        >
                          {PRICING_AUDIENCES.map((audience) => (
                            <option key={audience} value={audience}>
                              {audienceLabel(audience)}
                            </option>
                          ))}
                        </AquaSelect>
                      </div>
                      <div className="col-12 col-md-6">
                        <AquaInput
                          label="اسم البند"
                          value={item.title}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              title: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <AquaTextarea
                          label="الوصف الظاهر"
                          rows={2}
                          value={item.description}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              description: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <AquaInput
                          label="الكمية"
                          type="number"
                          min="0.0001"
                          step="0.01"
                          dir="ltr"
                          value={item.quantity}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <AquaInput
                          label="سعر الوحدة للعميل"
                          type="number"
                          min="0"
                          step="0.01"
                          dir="ltr"
                          value={item.unitPrice}
                          disabled={
                            !canEdit || item.audience === "INTERNAL"
                          }
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitPrice: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12 col-md-4">
                        <AquaInput
                          label="التكلفة الداخلية للوحدة"
                          type="number"
                          min="0"
                          step="0.01"
                          dir="ltr"
                          value={item.unitCost}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              unitCost: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <AquaTextarea
                          label="ملاحظات داخلية للبند"
                          rows={2}
                          value={item.internalNotes}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateItem(item.id, {
                              internalNotes: event.target.value,
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
                    onClick={() => addItem("CLIENT")}
                  >
                    إضافة بند عميل
                  </AquaButton>
                  <AquaButton
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Plus />}
                    onClick={() => addItem("INTERNAL")}
                  >
                    إضافة بند داخلي
                  </AquaButton>
                </div>
              ) : null}
            </AquaDataPanel>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-3">
            <AquaDataPanel
              eyebrow="Commercial controls"
              title="الخصم والضريبة"
              description="لا توجد نسبة مفترضة؛ اختر الطريقة والقيمة لكل إصدار."
            >
              <div className="d-flex flex-column gap-3">
                {(["discount", "tax"] as const).map((field) => (
                  <AquaCard key={field} variant="soft" padding="sm">
                    <div className="fw-bold mb-3">
                      {field === "discount" ? "الخصم" : "الضريبة"}
                    </div>
                    <div className="row g-3">
                      <div className="col-12">
                        <AquaSelect
                          label="الطريقة"
                          value={draft[field].mode}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const mode = event.target
                              .value as PricingDraftInput[typeof field]["mode"]
                            setDraft((current) => ({
                              ...current,
                              [field]: {
                                mode,
                                value:
                                  mode === "NONE"
                                    ? "0.00"
                                    : current[field].value,
                              },
                            }))
                          }}
                        >
                          {PRICING_ADJUSTMENT_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {adjustmentModeLabel(mode)}
                            </option>
                          ))}
                        </AquaSelect>
                      </div>
                      <div className="col-12">
                        <AquaInput
                          label={
                            draft[field].mode === "PERCENTAGE"
                              ? "النسبة %"
                              : "المبلغ"
                          }
                          type="number"
                          min="0"
                          max={
                            draft[field].mode === "PERCENTAGE"
                              ? "100"
                              : undefined
                          }
                          step="0.01"
                          dir="ltr"
                          value={draft[field].value}
                          disabled={
                            !canEdit || draft[field].mode === "NONE"
                          }
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              [field]: {
                                ...current[field],
                                value: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </AquaCard>
                ))}
              </div>
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Margin preview"
              title="الملخص المالي الداخلي"
              description="الضريبة لا تدخل في حساب الربح والهامش."
              meta={<Calculator aria-hidden="true" />}
            >
              {totals ? (
                <AquaDetailList
                  columns={1}
                  items={[
                    {
                      label: "مجموع بنود العميل",
                      value: money(totals.display.clientSubtotal),
                      dir: "ltr",
                    },
                    {
                      label: "الخصم",
                      value: money(totals.display.discountAmount),
                      dir: "ltr",
                    },
                    {
                      label: "صافي الإيراد",
                      value: money(totals.display.netRevenue),
                      dir: "ltr",
                    },
                    {
                      label: "التكلفة الداخلية",
                      value: money(totals.display.internalCost),
                      dir: "ltr",
                    },
                    {
                      label: "الربح الإجمالي",
                      value: money(totals.display.grossProfit),
                      dir: "ltr",
                    },
                    {
                      label: "الهامش",
                      value: `${totals.display.marginPercent}%`,
                      dir: "ltr",
                    },
                    {
                      label: "الضريبة",
                      value: money(totals.display.taxAmount),
                      dir: "ltr",
                    },
                    {
                      label: "الإجمالي النهائي",
                      value: money(totals.display.grandTotal),
                      dir: "ltr",
                    },
                  ]}
                />
              ) : (
                <AquaAlert variant="warning" title="الحساب غير مكتمل">
                  راجع الحقول الرقمية والخصم. يجب ألا يتجاوز الخصم
                  مجموع بنود العميل.
                </AquaAlert>
              )}
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Notes"
              title="ملاحظات الإصدار"
              description="افصل النص الذي قد يصل للعميل عن ملاحظات القرار الداخلية."
            >
              <div className="d-flex flex-column gap-3">
                <AquaTextarea
                  label="ملاحظات العميل"
                  rows={4}
                  value={draft.clientNotes}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      clientNotes: event.target.value,
                    }))
                  }
                />
                <AquaTextarea
                  label="ملاحظات داخلية"
                  rows={5}
                  value={draft.internalNotes}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      internalNotes: event.target.value,
                    }))
                  }
                />
              </div>
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Human approval"
              title="الحفظ والمراجعة"
              description="الحفظ ينشئ إصدارًا مستقلًا. الاعتماد لا ينشئ العرض بعد."
            >
              {canEdit ? (
                <div className="d-grid gap-2">
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<Save />}
                    loading={loadingAction === "SAVE"}
                    loadingLabel="جارٍ حفظ الإصدار"
                    disabled={!totals}
                    onClick={saveVersion}
                  >
                    حفظ إصدار تسعير
                  </AquaButton>
                  {workspace &&
                  (status === "DRAFT" ||
                    status === "CHANGES_REQUESTED") ? (
                    <AquaButton
                      leadingIcon={<Send />}
                      loading={loadingAction === "SUBMIT"}
                      loadingLabel="جارٍ الإرسال"
                      disabled={dirty || !totals}
                      onClick={() => reviewAction("SUBMIT")}
                    >
                      إرسال للمراجعة
                    </AquaButton>
                  ) : null}
                </div>
              ) : null}

              {status === "IN_REVIEW" ? (
                <div className="d-grid gap-2">
                  {canApprove ? (
                    <AquaButton
                      leadingIcon={<ShieldCheck />}
                      onClick={() => setShowApprove(true)}
                    >
                      اعتماد التسعير
                    </AquaButton>
                  ) : null}
                  <AquaButton
                    variant="secondary"
                    leadingIcon={<FileClock />}
                    disabled={!canApprove && !approvalBlockedBySelf}
                    onClick={() => setShowChanges(true)}
                  >
                    طلب تعديلات
                  </AquaButton>
                </div>
              ) : null}

              {approvalBlockedBySelf && status === "IN_REVIEW" ? (
                <AquaAlert
                  variant="warning"
                  title="فصل إعداد السعر عن اعتماده"
                  className="mt-3"
                >
                  أنشأت هذا الإصدار؛ يلزم مراجع مالي مخول أو مالك
                  النظام لاعتماده.
                </AquaAlert>
              ) : null}

              {!canManage && status !== "IN_REVIEW" ? (
                <AquaAlert variant="info" title="وضع القراءة">
                  يمكنك مراجعة الإصدارات، لكن التحرير متاح لفريق
                  المبيعات والمالية المخول.
                </AquaAlert>
              ) : null}
            </AquaDataPanel>

            <AquaDataPanel
              eyebrow="Version history"
              title="سجل إصدارات التسعير"
              description="يبقى كل قرار تجاري محفوظًا مع صاحبه ومرجع التقرير."
              meta={
                <AquaBadge variant="muted" size="sm">
                  {workspace?.versions.length ?? 0} إصدارات
                </AquaBadge>
              }
            >
              {workspace?.versions.length ? (
                <div className="d-flex flex-column gap-2">
                  {workspace.versions.map((version) => (
                    <AquaCard
                      key={version.id}
                      variant="soft"
                      padding="sm"
                    >
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <div className="d-flex flex-wrap gap-2">
                          <AquaBadge variant="aqua" size="sm">
                            v{version.version}
                          </AquaBadge>
                          <AquaBadge variant="muted" size="sm">
                            تقرير v{version.discoveryReportVersion}
                          </AquaBadge>
                          {version.version ===
                          workspace.currentVersion ? (
                            <AquaBadge variant="success" size="sm">
                              الحالي
                            </AquaBadge>
                          ) : null}
                        </div>
                        <span className="small aqua-soft">
                          {formatDate.format(
                            new Date(version.createdAt),
                          )}
                        </span>
                      </div>
                      <div className="small mt-2">
                        {version.createdBy?.name ?? "النظام"}
                      </div>
                      {version.content ? (
                        <div className="d-flex align-items-center justify-content-between gap-2 mt-2">
                          <strong dir="ltr">
                            {money(
                              version.content.totals.grandTotal,
                              version.content.currency,
                            )}
                          </strong>
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Eye />}
                            onClick={() => setPreviewVersion(version)}
                          >
                            عرض
                          </AquaButton>
                        </div>
                      ) : null}
                    </AquaCard>
                  ))}
                </div>
              ) : (
                <AquaAlert variant="neutral" title="لا توجد إصدارات">
                  راجع البنود ثم احفظ الإصدار الأول.
                </AquaAlert>
              )}
            </AquaDataPanel>
          </div>
        </div>
      </div>

      <AquaConfirmDialog
        open={showApprove}
        onClose={() => setShowApprove(false)}
        onConfirm={() => reviewAction("APPROVE")}
        title="اعتماد التسعير؟"
        description="سيُثبت الإصدار الحالي ويحدّث قيمة الفرصة والخطوة التالية إلى بناء العرض المركزي. لن يُنشأ عرض ولن يُرسل شيء للعميل."
        confirmLabel="اعتماد التسعير"
        loading={loadingAction === "APPROVE"}
        tone="neutral"
      />

      <AquaModal
        open={showChanges}
        onClose={() => {
          if (loadingAction !== "REQUEST_CHANGES") {
            setShowChanges(false)
          }
        }}
        title="طلب تعديلات على التسعير"
        description="وثّق المطلوب بوضوح ليظهر لمحرر الإصدار التالي."
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
              leadingIcon={<FileClock />}
              loading={loadingAction === "REQUEST_CHANGES"}
              loadingLabel="جارٍ طلب التعديلات"
              onClick={() => reviewAction("REQUEST_CHANGES")}
            >
              توثيق التعديلات
            </AquaButton>
          </div>
        }
      >
        <AquaTextarea
          label="ملاحظات المراجع"
          rows={6}
          value={reviewNotes}
          onChange={(event) => setReviewNotes(event.target.value)}
        />
      </AquaModal>

      <AquaModal
        open={Boolean(previewVersion)}
        onClose={() => setPreviewVersion(null)}
        title={`معاينة إصدار التسعير ${previewVersion?.version ?? ""}`}
        description="نسخة محفوظة للقراءة فقط"
        size="lg"
      >
        {previewContent ? (
          <div className="d-flex flex-column gap-3">
            <AquaDetailList
              columns={2}
              items={[
                {
                  label: "العنوان",
                  value: previewContent.title,
                },
                {
                  label: "الإجمالي",
                  value: money(
                    previewContent.totals.grandTotal,
                    previewContent.currency,
                  ),
                  dir: "ltr",
                },
                {
                  label: "التكلفة الداخلية",
                  value: money(
                    previewContent.totals.internalCost,
                    previewContent.currency,
                  ),
                  dir: "ltr",
                },
                {
                  label: "الهامش",
                  value: `${previewContent.totals.marginPercent}%`,
                  dir: "ltr",
                },
              ]}
            />
            {previewContent.items.map((item) => (
              <AquaCard key={item.id} variant="soft" padding="sm">
                <div className="d-flex flex-wrap gap-2 mb-2">
                  <AquaBadge
                    variant={
                      item.audience === "CLIENT" ? "blue" : "warning"
                    }
                    size="sm"
                  >
                    {audienceLabel(item.audience)}
                  </AquaBadge>
                  <AquaBadge variant="muted" size="sm">
                    {pricingItemKindLabel(item.kind)}
                  </AquaBadge>
                </div>
                <div className="fw-bold">{item.title}</div>
                {item.description ? (
                  <p className="small aqua-muted mb-2 mt-1">
                    {item.description}
                  </p>
                ) : null}
                <div className="small" dir="ltr">
                  {item.quantity} ×{" "}
                  {money(
                    item.audience === "CLIENT"
                      ? item.unitPrice
                      : item.unitCost,
                    previewContent.currency,
                  )}
                </div>
              </AquaCard>
            ))}
          </div>
        ) : null}
      </AquaModal>
    </div>
  )
}
