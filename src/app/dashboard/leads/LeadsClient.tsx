"use client"

import {
  ArrowUpRight,
  CircleCheckBig,
  Clock3,
  CopyCheck,
  Pencil,
  Search,
  UserRoundPlus,
  UsersRound,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaFilterBar,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaSelect,
  AquaTable,
  AquaTableStateRow,
  AquaTextarea,
} from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type { AquaBadgeVariant } from "@/design-system"
import {
  LeadSource,
  LeadStatus,
  ServiceRequestPriority,
} from "@/generated/prisma/enums"
import { leadActionBucket } from "@/lib/crm-lead"

type OwnerOption = {
  id: string
  name: string
  email: string
}

type LeadItem = {
  id: string
  contactName: string
  email: string | null
  phone: string | null
  companyName: string | null
  serviceType: string
  status: LeadStatus
  source: LeadSource
  priority: ServiceRequestPriority
  campaign: string | null
  completionScore: number
  contactConsent: boolean | null
  nextAction: string | null
  nextActionAt: string | null
  notes: string | null
  owner: OwnerOption | null
  possibleDuplicateOf: {
    id: string
    contactName: string
    companyName: string | null
    email: string | null
    phone: string | null
  } | null
  opportunity: {
    id: string
    title: string
    stage: string
  } | null
  serviceRequest: {
    id: string
    customerName: string
    status: string
  } | null
  createdAt: string
  updatedAt: string
}

type Filters = {
  q: string
  status: string
  source: string
  priority: string
  ownerId: string
  attention: string
}

type Stats = {
  totalLeads: number
  activeLeads: number
  overdueLeads: number
  unassignedLeads: number
  duplicateCandidates: number
  qualifiedLeads: number
  from: number
  to: number
  currentPage: number
  totalPages: number
}

type LeadFormState = {
  contactName: string
  email: string
  phone: string
  companyName: string
  serviceType: string
  status: LeadStatus
  source: LeadSource
  priority: ServiceRequestPriority
  campaign: string
  ownerId: string
  contactConsent: "" | "YES" | "NO"
  nextAction: string
  nextActionAt: string
  notes: string
}

const leadStatuses: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "DISCOVERY",
  "NEEDS_INFO",
  "QUALIFIED",
  "DISQUALIFIED",
  "NURTURE",
  "DUPLICATE",
  "SPAM",
  "CONVERTED",
  "ARCHIVED",
]

const editableLeadStatuses = leadStatuses.filter(
  (status) => status !== "CONVERTED",
)

const leadSources: LeadSource[] = [
  "WEBSITE",
  "CHATBOT",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "CALL",
  "MEETING",
  "REFERRAL",
  "CAMPAIGN",
  "MANUAL",
  "DIRECT",
  "OTHER",
]

const leadPriorities: ServiceRequestPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

const emptyForm: LeadFormState = {
  contactName: "",
  email: "",
  phone: "",
  companyName: "",
  serviceType: "",
  status: "NEW",
  source: "MANUAL",
  priority: "MEDIUM",
  campaign: "",
  ownerId: "",
  contactConsent: "",
  nextAction: "",
  nextActionAt: "",
  notes: "",
}

const PAGE_SIZE = 20

function statusLabel(status: LeadStatus) {
  const labels: Record<LeadStatus, string> = {
    NEW: "جديد",
    CONTACTED: "تم التواصل",
    DISCOVERY: "استكشاف",
    NEEDS_INFO: "يحتاج معلومات",
    QUALIFIED: "مؤهل",
    DISQUALIFIED: "غير مؤهل",
    NURTURE: "متابعة لاحقة",
    DUPLICATE: "مكرر",
    SPAM: "غير صالح",
    CONVERTED: "تحول لفرصة",
    ARCHIVED: "مؤرشف",
  }

  return labels[status]
}

function statusVariant(status: LeadStatus): AquaBadgeVariant {
  if (status === "QUALIFIED") return "blue"
  if (status === "CONVERTED") return "success"
  if (status === "NEEDS_INFO" || status === "DUPLICATE") return "warning"
  if (status === "DISQUALIFIED" || status === "SPAM") return "danger"
  if (status === "NURTURE" || status === "ARCHIVED") return "muted"
  return "aqua"
}

function sourceLabel(source: LeadSource) {
  const labels: Record<LeadSource, string> = {
    WEBSITE: "الموقع",
    CHATBOT: "الشات بوت",
    FACEBOOK: "فيسبوك",
    INSTAGRAM: "إنستغرام",
    WHATSAPP: "واتساب",
    EMAIL: "البريد",
    CALL: "مكالمة",
    MEETING: "اجتماع",
    REFERRAL: "ترشيح",
    CAMPAIGN: "حملة",
    MANUAL: "يدوي",
    DIRECT: "مباشر",
    OTHER: "أخرى",
  }

  return labels[source]
}

function priorityLabel(priority: ServiceRequestPriority) {
  const labels: Record<ServiceRequestPriority, string> = {
    LOW: "منخفضة",
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    URGENT: "عاجلة",
  }

  return labels[priority]
}

function priorityVariant(
  priority: ServiceRequestPriority,
): AquaBadgeVariant {
  if (priority === "URGENT") return "danger"
  if (priority === "HIGH") return "warning"
  if (priority === "LOW") return "muted"
  return "aqua"
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ""

  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return "غير محدد"

  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value))
}

function actionBadge(lead: LeadItem, timeZone: string) {
  const bucket = leadActionBucket({
    status: lead.status,
    nextActionAt: lead.nextActionAt,
  })

  if (bucket === "CLOSED") {
    return <AquaBadge variant="muted">مغلق</AquaBadge>
  }

  if (bucket === "MISSING") {
    return <AquaBadge variant="warning">بلا موعد</AquaBadge>
  }

  if (bucket === "OVERDUE") {
    return <AquaBadge variant="danger">متأخر</AquaBadge>
  }

  return (
    <AquaBadge variant="blue">
      {formatDateTime(lead.nextActionAt, timeZone)}
    </AquaBadge>
  )
}

export default function LeadsClient({
  leads,
  owners,
  canManage,
  company,
  filters,
  stats,
  pagination,
}: {
  leads: LeadItem[]
  owners: OwnerOption[]
  canManage: boolean
  company: { timezone: string }
  filters: Filters
  stats: Stats
  pagination: ReactNode
}) {
  const router = useRouter()
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<LeadFormState>(emptyForm)
  const [pendingDuplicate, setPendingDuplicate] = useState<LeadItem | null>(
    null,
  )
  const [pendingConvert, setPendingConvert] = useState<LeadItem | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const activeFilterCount = [
    filters.q,
    filters.status,
    filters.source,
    filters.priority,
    filters.ownerId,
    filters.attention,
  ].filter(Boolean).length

  function updateForm<K extends keyof LeadFormState>(
    key: K,
    value: LeadFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function startCreate() {
    setEditingLead(null)
    setForm({
      ...emptyForm,
      ownerId: owners[0]?.id ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  function startEdit(lead: LeadItem) {
    setEditingLead(lead)
    setForm({
      contactName: lead.contactName,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      companyName: lead.companyName ?? "",
      serviceType: lead.serviceType,
      status: lead.status,
      source: lead.source,
      priority: lead.priority,
      campaign: lead.campaign ?? "",
      ownerId: lead.owner?.id ?? "",
      contactConsent:
        lead.contactConsent === null
          ? ""
          : lead.contactConsent
            ? "YES"
            : "NO",
      nextAction: lead.nextAction ?? "",
      nextActionAt: toDateTimeLocal(lead.nextActionAt),
      notes: lead.notes ?? "",
    })
    setError("")
    setFormOpen(true)
  }

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const isEditing = Boolean(editingLead)
      const response = await fetch(
        isEditing ? `/api/leads/${editingLead?.id}` : "/api/leads",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactName: form.contactName,
            email: form.email,
            phone: form.phone,
            companyName: form.companyName,
            serviceType: form.serviceType,
            ...(isEditing ? { status: form.status } : {}),
            source: form.source,
            priority: form.priority,
            campaign: form.campaign,
            ownerId: form.ownerId || null,
            contactConsent:
              form.contactConsent === ""
                ? null
                : form.contactConsent === "YES",
            nextAction: form.nextAction,
            nextActionAt: form.nextActionAt
              ? new Date(form.nextActionAt).toISOString()
              : null,
            notes: form.notes,
          }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ العميل المحتمل")
        return
      }

      setFormOpen(false)
      setEditingLead(null)
      setForm(emptyForm)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  async function confirmDuplicate() {
    if (!pendingDuplicate) return

    setError("")
    setConfirmLoading(true)

    try {
      const response = await fetch(`/api/leads/${pendingDuplicate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "DUPLICATE",
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر اعتماد السجل المكرر")
        return
      }

      setPendingDuplicate(null)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setConfirmLoading(false)
    }
  }

  async function convertLead() {
    if (!pendingConvert) return

    setError("")
    setConfirmLoading(true)

    try {
      const response = await fetch(
        `/api/leads/${pendingConvert.id}/convert`,
        {
          method: "POST",
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر إنشاء فرصة البيع")
        return
      }

      setPendingConvert(null)
      router.push(
        `/dashboard/sales/opportunities/${data.data.opportunityId}`,
      )
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setConfirmLoading(false)
    }
  }

  const summaryCards: {
    label: string
    value: number
    hint: string
    variant: AquaBadgeVariant
  }[] = [
    {
      label: "قيد التأهيل",
      value: stats.activeLeads,
      hint: "Leads مفتوحة",
      variant: "aqua",
    },
    {
      label: "إجراء متأخر",
      value: stats.overdueLeads,
      hint: "تحتاج متابعة الآن",
      variant: "danger",
    },
    {
      label: "دون مسؤول",
      value: stats.unassignedLeads,
      hint: "تحتاج تعيين مالك",
      variant: "warning",
    },
    {
      label: "تطابقات محتملة",
      value: stats.duplicateCandidates,
      hint: "تحتاج مراجعة بشرية",
      variant: "warning",
    },
    {
      label: "جاهزة للتحويل",
      value: stats.qualifiedLeads,
      hint: "مؤهلة بلا فرصة",
      variant: "success",
    },
  ]

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Leads CRM"
        title="العملاء المحتملون"
        description="استقبال العملاء المحتملين وتأهيلهم وتحديد المسؤول والإجراء التالي قبل تحويلهم إلى فرص مبيعات."
        brandValue="CRM"
      />

      <div className="d-flex flex-wrap gap-2 mb-3">
        {canManage ? (
          <AquaButton
            leadingIcon={<UserRoundPlus />}
            onClick={startCreate}
          >
            إضافة Lead يدوي
          </AquaButton>
        ) : null}
        <AquaLinkButton href="/dashboard/sales" variant="secondary">
          خط المبيعات
        </AquaLinkButton>
        <AquaLinkButton
          href="/dashboard/service-requests"
          variant="ghost"
        >
          طلبات الخدمة
        </AquaLinkButton>
      </div>

      {error ? (
        <AquaAlert
          variant="danger"
          title="تعذر إكمال العملية"
          className="mb-3"
        >
          {error}
        </AquaAlert>
      ) : null}

      <div className="row g-3 mb-3">
        {summaryCards.map((card) => (
          <div className="col-12 col-sm-6 col-xl" key={card.label}>
            <AquaCard variant="soft" padding="sm" className="h-100">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div className="small aqua-muted">{card.label}</div>
                  <div className="h4 fw-black mb-1 mt-2" dir="ltr">
                    {card.value}
                  </div>
                  <div className="small aqua-soft">{card.hint}</div>
                </div>
                <AquaBadge variant={card.variant} size="sm">
                  {card.value}
                </AquaBadge>
              </div>
            </AquaCard>
          </div>
        ))}
      </div>

      <AquaDataPanel
        title="قائمة العملاء المحتملين"
        description={`عرض ${stats.from}–${stats.to} من أصل ${stats.totalLeads} نتيجة`}
        meta={
          <span dir="ltr">
            Page {stats.currentPage} / {stats.totalPages}
          </span>
        }
        footer={pagination}
      >
        <AquaFilterBar
          action="/dashboard/leads"
          method="get"
          activeCount={activeFilterCount}
          description="صفِّ حسب مرحلة التأهيل أو المسؤول أو الإجراء المطلوب."
          className="mb-3"
        >
          <AquaInput
            span={4}
            name="q"
            defaultValue={filters.q}
            label="بحث"
            placeholder="الاسم، الشركة، التواصل، الخدمة..."
          />

          <AquaSelect
            span={2}
            name="status"
            defaultValue={filters.status}
            label="الحالة"
          >
            <option value="">الكل</option>
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </AquaSelect>

          <AquaSelect
            span={2}
            name="ownerId"
            defaultValue={filters.ownerId}
            label="المسؤول"
          >
            <option value="">الكل</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </AquaSelect>

          <AquaSelect
            span={2}
            name="source"
            defaultValue={filters.source}
            label="المصدر"
          >
            <option value="">الكل</option>
            {leadSources.map((source) => (
              <option key={source} value={source}>
                {sourceLabel(source)}
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
            {leadPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority)}
              </option>
            ))}
          </AquaSelect>

          <AquaSelect
            span={4}
            name="attention"
            defaultValue={filters.attention}
            label="تحتاج انتباه"
          >
            <option value="">كل الحالات</option>
            <option value="OVERDUE">إجراء متأخر</option>
            <option value="MISSING_ACTION">بلا موعد متابعة</option>
            <option value="UNASSIGNED">دون مسؤول</option>
            <option value="DUPLICATE_CANDIDATE">
              تطابق محتمل
            </option>
          </AquaSelect>

          <div className="aqua-filter-bar__actions" data-aqua-span="2">
            <AquaButton
              type="submit"
              size="sm"
              fullWidth
              leadingIcon={<Search />}
            >
              تطبيق
            </AquaButton>
            <AquaLinkButton
              href="/dashboard/leads"
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
          minWidth="1040px"
          caption="قائمة العملاء المحتملين في Aqua.Tech"
        >
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">العميل المحتمل</th>
              <th scope="col">التأهيل</th>
              <th scope="col">المسؤول</th>
              <th scope="col">الإجراء التالي</th>
              <th scope="col">المصدر</th>
              <th scope="col">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <AquaTableStateRow
                colSpan={7}
                variant="empty"
                icon={<UsersRound />}
                title="لا توجد Leads مطابقة"
                description="غيّر معايير البحث أو أضف عميلًا محتملًا يدويًا."
              />
            ) : (
              leads.map((lead, index) => (
                <tr key={lead.id}>
                  <td
                    data-label="#"
                    className="aqua-table__secondary"
                    dir="ltr"
                  >
                    {(stats.currentPage - 1) * PAGE_SIZE + index + 1}
                  </td>

                  <td data-label="العميل المحتمل">
                    <div className="aqua-table__primary">
                      {lead.companyName || lead.contactName}
                    </div>
                    <div className="aqua-table__secondary">
                      {lead.companyName ? lead.contactName : lead.serviceType}
                    </div>
                    <div className="aqua-table__secondary" dir="ltr">
                      {lead.email || lead.phone || "لا توجد وسيلة تواصل"}
                    </div>
                    {lead.possibleDuplicateOf &&
                    lead.status !== "DUPLICATE" ? (
                      <div className="mt-2">
                        <AquaBadge variant="warning" size="sm">
                          يشبه:{" "}
                          {lead.possibleDuplicateOf.companyName ||
                            lead.possibleDuplicateOf.contactName}
                        </AquaBadge>
                      </div>
                    ) : null}
                  </td>

                  <td data-label="التأهيل">
                    <div className="d-flex flex-wrap gap-2">
                      <AquaBadge
                        variant={statusVariant(lead.status)}
                        size="sm"
                        dot
                      >
                        {statusLabel(lead.status)}
                      </AquaBadge>
                      <AquaBadge
                        variant={priorityVariant(lead.priority)}
                        size="sm"
                      >
                        {priorityLabel(lead.priority)}
                      </AquaBadge>
                    </div>
                    <div className="aqua-table__secondary mt-2" dir="ltr">
                      اكتمال {lead.completionScore}%
                    </div>
                  </td>

                  <td data-label="المسؤول">
                    <div className="aqua-table__primary">
                      {lead.owner?.name || "غير معيّن"}
                    </div>
                    <div className="aqua-table__secondary" dir="ltr">
                      {lead.owner?.email || "—"}
                    </div>
                  </td>

                  <td data-label="الإجراء التالي">
                    <div className="mb-2">
                      {actionBadge(lead, company.timezone)}
                    </div>
                    <div className="aqua-table__secondary">
                      {lead.nextAction || "لم يحدد إجراء"}
                    </div>
                  </td>

                  <td data-label="المصدر">
                    <div className="aqua-table__primary">
                      {sourceLabel(lead.source)}
                    </div>
                    <div className="aqua-table__secondary">
                      {lead.serviceRequest
                        ? `طلب خدمة: ${lead.serviceRequest.status}`
                        : lead.campaign || "إدخال مباشر"}
                    </div>
                  </td>

                  <td data-label="إجراء">
                    <div className="aqua-table__actions">
                      {canManage &&
                      lead.status !== "CONVERTED" &&
                      !lead.opportunity ? (
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<Pencil />}
                          onClick={() => startEdit(lead)}
                        >
                          مراجعة
                        </AquaButton>
                      ) : null}

                      {canManage &&
                      lead.possibleDuplicateOf &&
                      lead.status !== "DUPLICATE" &&
                      !lead.opportunity ? (
                        <AquaButton
                          variant="ghost"
                          size="sm"
                          leadingIcon={<CopyCheck />}
                          onClick={() => setPendingDuplicate(lead)}
                        >
                          اعتماد مكرر
                        </AquaButton>
                      ) : null}

                      {canManage &&
                      lead.status === "QUALIFIED" &&
                      !lead.opportunity ? (
                        <AquaButton
                          size="sm"
                          leadingIcon={<CircleCheckBig />}
                          onClick={() => setPendingConvert(lead)}
                        >
                          إنشاء فرصة
                        </AquaButton>
                      ) : null}

                      {lead.opportunity ? (
                        <AquaLinkButton
                          href={`/dashboard/sales/opportunities/${lead.opportunity.id}`}
                          variant="secondary"
                          size="sm"
                          trailingIcon={<ArrowUpRight />}
                        >
                          فتح الفرصة
                        </AquaLinkButton>
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
        open={formOpen}
        onClose={() => {
          if (!loading) setFormOpen(false)
        }}
        title={editingLead ? "مراجعة العميل المحتمل" : "إضافة Lead يدوي"}
        description={
          editingLead
            ? "حدّث بيانات التأهيل والمسؤول والإجراء التالي. سيتم مزامنة طلب الخدمة المرتبط إن وجد."
            : "سجّل بيانات التواصل والخدمة وحدد المسؤول والإجراء التالي."
        }
        size="xl"
        closeOnBackdrop={!loading}
        footer={
          <div className="aqua-modal__action-row">
            <AquaButton
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={loading}
            >
              إلغاء
            </AquaButton>
            <AquaButton
              type="submit"
              form="lead-management-form"
              loading={loading}
              loadingLabel="جارٍ الحفظ"
            >
              {editingLead ? "حفظ المراجعة" : "إضافة Lead"}
            </AquaButton>
          </div>
        }
      >
        <form id="lead-management-form" onSubmit={submitLead}>
          <div className="aqua-form-grid">
            <AquaInput
              span={6}
              required
              minLength={2}
              label="جهة الاتصال"
              value={form.contactName}
              onChange={(event) =>
                updateForm("contactName", event.target.value)
              }
            />

            <AquaInput
              span={6}
              label="الشركة"
              value={form.companyName}
              onChange={(event) =>
                updateForm("companyName", event.target.value)
              }
            />

            <AquaInput
              span={6}
              required
              minLength={2}
              label="الخدمة المطلوبة"
              value={form.serviceType}
              onChange={(event) =>
                updateForm("serviceType", event.target.value)
              }
            />

            <AquaSelect
              span={6}
              label="المسؤول"
              value={form.ownerId}
              onChange={(event) =>
                updateForm("ownerId", event.target.value)
              }
            >
              <option value="">غير معيّن</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </AquaSelect>

            <AquaInput
              span={6}
              dir="ltr"
              type="email"
              label="البريد الإلكتروني"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
              className="text-start"
            />

            <AquaInput
              span={6}
              dir="ltr"
              label="الهاتف"
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              className="text-start"
            />

            {editingLead ? (
              <AquaSelect
                span={4}
                label="حالة التأهيل"
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as LeadStatus)
                }
              >
                {editableLeadStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </AquaSelect>
            ) : null}

            <AquaSelect
              span={editingLead ? 4 : 6}
              label="المصدر"
              value={form.source}
              onChange={(event) =>
                updateForm("source", event.target.value as LeadSource)
              }
            >
              {leadSources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source)}
                </option>
              ))}
            </AquaSelect>

            <AquaSelect
              span={editingLead ? 4 : 6}
              label="الأولوية"
              value={form.priority}
              onChange={(event) =>
                updateForm(
                  "priority",
                  event.target.value as ServiceRequestPriority,
                )
              }
            >
              {leadPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel(priority)}
                </option>
              ))}
            </AquaSelect>

            <AquaInput
              span={6}
              label="الحملة"
              value={form.campaign}
              onChange={(event) =>
                updateForm("campaign", event.target.value)
              }
              placeholder="اختياري"
            />

            <AquaSelect
              span={6}
              label="موافقة التواصل"
              value={form.contactConsent}
              onChange={(event) =>
                updateForm(
                  "contactConsent",
                  event.target.value as LeadFormState["contactConsent"],
                )
              }
            >
              <option value="">غير محددة</option>
              <option value="YES">موافق</option>
              <option value="NO">غير موافق</option>
            </AquaSelect>

            <AquaInput
              span={6}
              label="الإجراء التالي"
              value={form.nextAction}
              onChange={(event) =>
                updateForm("nextAction", event.target.value)
              }
              placeholder="مثال: اتصال لفهم النطاق"
            />

            <AquaInput
              span={6}
              dir="ltr"
              type="datetime-local"
              label="موعد الإجراء"
              value={form.nextActionAt}
              onChange={(event) =>
                updateForm("nextActionAt", event.target.value)
              }
              className="text-start"
            />

            <AquaTextarea
              label="ملاحظات التأهيل"
              rows={4}
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
            />
          </div>
        </form>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(pendingDuplicate)}
        onClose={() => {
          if (!confirmLoading) setPendingDuplicate(null)
        }}
        onConfirm={confirmDuplicate}
        title="اعتماد السجل كمكرر"
        description={`سيُغلق ${
          pendingDuplicate?.companyName ||
          pendingDuplicate?.contactName ||
          "السجل"
        } كمكرر مع الاحتفاظ بالبيانات وسجل المصدر.`}
        confirmLabel="اعتماد مكرر"
        confirmVariant="danger"
        tone="warning"
        loading={confirmLoading}
      />

      <AquaConfirmDialog
        open={Boolean(pendingConvert)}
        onClose={() => {
          if (!confirmLoading) setPendingConvert(null)
        }}
        onConfirm={convertLead}
        title="إنشاء فرصة بيع"
        description={`سيتم تحويل ${
          pendingConvert?.companyName ||
          pendingConvert?.contactName ||
          "العميل المحتمل"
        } إلى فرصة مؤهلة داخل خط المبيعات مع نقل المسؤول والمتابعة الحالية.`}
        confirmLabel="إنشاء الفرصة"
        tone="neutral"
        icon={<Clock3 />}
        loading={confirmLoading}
      />
    </div>
  )
}
