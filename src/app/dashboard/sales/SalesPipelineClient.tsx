"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type {
  SalesOpportunityStage,
  ServiceRequestPriority,
  ServiceRequestSource,
} from "@/generated/prisma/enums"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type OpportunityItem = {
  id: string
  title: string
  contactName: string
  companyName: string | null
  email: string | null
  phone: string | null
  serviceType: string
  stage: SalesOpportunityStage
  priority: ServiceRequestPriority
  source: ServiceRequestSource
  estimatedValue: string
  currency: string
  probability: number
  expectedCloseDate: string | null
  nextFollowUpAt: string | null
  lastContactAt: string | null
  lostReason: string | null
  owner: { id: string; name: string; email: string } | null
  client: { id: string; name: string } | null
  project: { id: string; name: string; code: string | null } | null
  serviceRequest: { id: string; customerName: string; status: string } | null
  nextActivity: { id: string; subject: string; scheduledAt: string | null } | null
  latestProposal: {
    id: string
    proposalNumber: string
    version: number
    status: string
    amount: string
  } | null
  activityCount: number
  proposalCount: number
  stale: boolean
  followUp: "OVERDUE" | "TODAY" | "UPCOMING" | "NONE"
  createdAt: string
  updatedAt: string
}

type ServiceRequestOption = {
  id: string
  customerName: string
  customerCompany: string | null
  serviceType: string
  status: string
  priority: string
  createdAt: string
}

type UserOption = { id: string; name: string; email: string }
type ClientOption = { id: string; name: string }

const openStages: SalesOpportunityStage[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "ON_HOLD",
]

const stageLabels: Record<SalesOpportunityStage, string> = {
  NEW: "جديدة",
  DISCOVERY: "استكشاف",
  QUALIFIED: "مؤهلة",
  PROPOSAL: "عرض سعر",
  NEGOTIATION: "تفاوض",
  ON_HOLD: "معلّقة",
  WON: "فوز",
  LOST: "خسارة",
}

const stageHints: Record<SalesOpportunityStage, string> = {
  NEW: "طلب أو تواصل أولي",
  DISCOVERY: "فهم الاحتياج والنطاق",
  QUALIFIED: "احتياج وميزانية مناسبَان",
  PROPOSAL: "عرض تجاري مرسل",
  NEGOTIATION: "مناقشة واعتماد نهائي",
  ON_HOLD: "متوقفة مؤقتًا",
  WON: "تحولت إلى مشروع",
  LOST: "أغلقت دون بيع",
}

const priorities: ServiceRequestPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const sources: ServiceRequestSource[] = [
  "WEBSITE",
  "MANUAL",
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "REFERRAL",
  "OTHER",
]

function priorityLabel(value: ServiceRequestPriority) {
  return { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة" }[
    value
  ]
}

function sourceLabel(value: ServiceRequestSource) {
  return {
    WEBSITE: "الموقع",
    MANUAL: "يدوي",
    WHATSAPP: "واتساب",
    INSTAGRAM: "إنستغرام",
    FACEBOOK: "فيسبوك",
    REFERRAL: "ترشيح",
    OTHER: "أخرى",
  }[value]
}

function money(value: string, currency: string) {
  return `${Number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function shortDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function followUpClass(bucket: OpportunityItem["followUp"]) {
  if (bucket === "OVERDUE") return "text-bg-danger"
  if (bucket === "TODAY") return "text-bg-warning"
  if (bucket === "UPCOMING") return "text-bg-info"
  return "text-bg-secondary"
}

function followUpLabel(bucket: OpportunityItem["followUp"]) {
  if (bucket === "OVERDUE") return "متابعة متأخرة"
  if (bucket === "TODAY") return "متابعة اليوم"
  if (bucket === "UPCOMING") return "متابعة قادمة"
  return "لا توجد متابعة"
}

export default function SalesPipelineClient({
  opportunities,
  serviceRequests,
  users,
  clients,
  company,
  canManage,
  summary,
}: {
  opportunities: OpportunityItem[]
  serviceRequests: ServiceRequestOption[]
  users: UserOption[]
  clients: ClientOption[]
  company: { currency: string; timezone: string }
  canManage: boolean
  summary: {
    openCount: number
    pipelineValue: string
    weightedValue: string
    staleCount: number
    overdueFollowUps: number
    todayFollowUps: number
    wonCount: number
    lostCount: number
    winRate: number
  }
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("")
  const [serviceRequestId, setServiceRequestId] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const [title, setTitle] = useState("")
  const [contactName, setContactName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [serviceType, setServiceType] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("0")
  const [probability, setProbability] = useState("10")
  const [expectedCloseDate, setExpectedCloseDate] = useState("")
  const [nextFollowUpAt, setNextFollowUpAt] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [clientId, setClientId] = useState("")
  const [priority, setPriority] = useState<ServiceRequestPriority>("MEDIUM")
  const [source, setSource] = useState<ServiceRequestSource>("MANUAL")
  const [notes, setNotes] = useState("")

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()

    return opportunities.filter((opportunity) => {
      if (ownerFilter && opportunity.owner?.id !== ownerFilter) return false
      if (!query) return true

      return [
        opportunity.title,
        opportunity.contactName,
        opportunity.companyName,
        opportunity.email,
        opportunity.phone,
        opportunity.serviceType,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [opportunities, ownerFilter, q])

  function resetForm() {
    setTitle("")
    setContactName("")
    setCompanyName("")
    setEmail("")
    setPhone("")
    setServiceType("")
    setEstimatedValue("0")
    setProbability("10")
    setExpectedCloseDate("")
    setNextFollowUpAt("")
    setOwnerId("")
    setClientId("")
    setPriority("MEDIUM")
    setSource("MANUAL")
    setNotes("")
    setError("")
  }

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setBusyId("create")

    try {
      const response = await fetch("/api/sales/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contactName,
          companyName,
          email,
          phone,
          serviceType,
          estimatedValue,
          currency: company.currency,
          probability: Number(probability),
          expectedCloseDate: expectedCloseDate || null,
          nextFollowUpAt: nextFollowUpAt || null,
          ownerId: ownerId || null,
          clientId: clientId || null,
          priority,
          source,
          notes,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر إنشاء الفرصة")
        return
      }

      resetForm()
      setShowForm(false)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusyId(null)
    }
  }

  async function createFromServiceRequest() {
    if (!serviceRequestId) return
    setError("")
    setBusyId(`request-${serviceRequestId}`)

    try {
      const response = await fetch("/api/sales/opportunities/from-service-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceRequestId }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تحويل طلب الخدمة إلى فرصة")
        return
      }

      setServiceRequestId("")
      router.push(`/dashboard/sales/opportunities/${data.data.opportunityId}`)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusyId(null)
    }
  }

  async function changeStage(
    opportunity: OpportunityItem,
    stage: SalesOpportunityStage,
  ) {
    if (stage === opportunity.stage || stage === "WON") return

    const lostReason =
      stage === "LOST"
        ? window.prompt("اكتب سبب خسارة الفرصة بوضوح")
        : null

    if (stage === "LOST" && !lostReason?.trim()) return

    setError("")
    setBusyId(opportunity.id)

    try {
      const response = await fetch(`/api/sales/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, lostReason }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر نقل الفرصة")
        return
      }

      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusyId(null)
    }
  }

  const cards = [
    { label: "الفرص المفتوحة", value: summary.openCount, hint: "Active opportunities" },
    { label: "قيمة خط المبيعات", value: money(summary.pipelineValue, company.currency), hint: "Open pipeline" },
    { label: "القيمة المرجحة", value: money(summary.weightedValue, company.currency), hint: "Probability weighted" },
    { label: "متابعات اليوم", value: summary.todayFollowUps, hint: `${summary.overdueFollowUps} متأخرة` },
    { label: "فرص خاملة", value: summary.staleCount, hint: "No contact for 7+ days" },
    { label: "معدل الفوز", value: `${summary.winRate}%`, hint: `${summary.wonCount} فوز / ${summary.lostCount} خسارة` },
  ]

  return (
    <div className="aqua-sales-page">
      <AquaPageHeader
        badge="Sales CRM"
        title="خط المبيعات والفرص"
        description="تحويل طلبات الخدمة إلى فرص قابلة للمتابعة، إدارة العروض التجارية، ومراقبة التحويل من أول تواصل حتى إنشاء المشروع."
        brandValue="Sales"
      />

      {error ? <div className="alert alert-danger border-0 rounded-4 mb-0">{error}</div> : null}

      <div className="aqua-crm-actions">
        {canManage ? (
          <button className="btn btn-info fw-bold" type="button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? "إغلاق نموذج الفرصة" : "إضافة فرصة يدوية"}
          </button>
        ) : null}
        <Link className="btn btn-outline-info fw-bold" href="/dashboard/service-requests">
          طلبات الخدمة
        </Link>
      </div>

      <div className="row g-3 aqua-sales-metrics">
        {cards.map((card) => (
          <div className="col-12 col-md-6 col-xl-4" key={card.label}>
            <div className="aqua-card p-4 h-100 aqua-sales-metric">
              <div className="small aqua-muted">{card.label}</div>
              <div className="h3 fw-black aqua-text-gradient mt-3 mb-0" dir="ltr">
                {card.value}
              </div>
              <div className="small aqua-soft mt-3">{card.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {canManage && serviceRequests.length > 0 ? (
        <div className="aqua-card p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg">
              <label className="form-label">إنشاء فرصة من طلب خدمة جديد</label>
              <select className="form-select" value={serviceRequestId} onChange={(event) => setServiceRequestId(event.target.value)}>
                <option value="">اختر طلب الخدمة</option>
                {serviceRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.customerCompany || request.customerName} — {request.serviceType} ({request.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-auto">
              <button
                className="btn btn-info fw-bold w-100"
                disabled={!serviceRequestId || busyId === `request-${serviceRequestId}`}
                type="button"
                onClick={createFromServiceRequest}
              >
                {busyId === `request-${serviceRequestId}` ? "جارٍ الإنشاء..." : "إنشاء الفرصة"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showForm && canManage ? (
        <form className="aqua-card p-4" onSubmit={createOpportunity}>
          <div className="d-flex align-items-center justify-content-between gap-3 mb-4">
            <div>
              <h2 className="h5 fw-black mb-1">فرصة بيع يدوية</h2>
              <div className="small aqua-muted">أدخل البيانات التجارية الأساسية ثم أضف المتابعات والعروض من صفحة الفرصة.</div>
            </div>
            <button className="btn btn-sm btn-outline-secondary" type="button" onClick={resetForm}>تفريغ</button>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <label className="form-label">عنوان الفرصة</label>
              <input className="form-control" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Website Revamp - Client" />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">جهة الاتصال</label>
              <input className="form-control" required value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">الشركة</label>
              <input className="form-control" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">الإيميل</label>
              <input className="form-control text-start" dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">الهاتف</label>
              <input className="form-control text-start" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">الخدمة</label>
              <input className="form-control" required value={serviceType} onChange={(event) => setServiceType(event.target.value)} />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">عميل موجود</label>
              <select className="form-select" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">غير مرتبط</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">القيمة المتوقعة</label>
              <div className="input-group" dir="ltr">
                <input className="form-control" min="0" step="0.01" type="number" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} />
                <span className="input-group-text">{company.currency}</span>
              </div>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">احتمال الفوز %</label>
              <input className="form-control" min="0" max="100" type="number" value={probability} onChange={(event) => setProbability(event.target.value)} />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">الإغلاق المتوقع</label>
              <input className="form-control text-start" dir="ltr" type="date" value={expectedCloseDate} onChange={(event) => setExpectedCloseDate(event.target.value)} />
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label className="form-label">المتابعة القادمة</label>
              <input className="form-control text-start" dir="ltr" type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">المسؤول</label>
              <select className="form-select" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">غير محدد</option>
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">الأولوية</label>
              <select className="form-select" value={priority} onChange={(event) => setPriority(event.target.value as ServiceRequestPriority)}>
                {priorities.map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">المصدر</label>
              <select className="form-select" value={source} onChange={(event) => setSource(event.target.value as ServiceRequestSource)}>
                {sources.map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">ملاحظات</label>
              <textarea className="form-control" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>

          <button className="btn btn-info fw-bold mt-4" disabled={busyId === "create"} type="submit">
            {busyId === "create" ? "جارٍ الحفظ..." : "إنشاء فرصة البيع"}
          </button>
        </form>
      ) : null}

      <div className="aqua-card p-4 aqua-sales-filter">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-8">
            <label className="form-label">بحث داخل الفرص</label>
            <input className="form-control" value={q} onChange={(event) => setQ(event.target.value)} placeholder="العنوان، العميل، الخدمة، الهاتف..." />
          </div>
          <div className="col-12 col-lg-4">
            <label className="form-label">المسؤول</label>
            <select className="form-select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="">كل المسؤولين</option>
              {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="row g-3 align-items-stretch aqua-sales-board">
        {openStages.map((stage) => {
          const stageItems = filtered.filter((opportunity) => opportunity.stage === stage)
          const stageTotal = stageItems.reduce((sum, item) => sum + Number(item.estimatedValue), 0)

          return (
            <div className="col-12 col-lg-6 col-xxl-4" key={stage}>
              <div className="aqua-card p-3 h-100 aqua-sales-stage">
                <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                  <div>
                    <h2 className="h6 fw-black mb-1">{stageLabels[stage]}</h2>
                    <div className="small aqua-muted">{stageHints[stage]}</div>
                  </div>
                  <span className="badge text-bg-info" dir="ltr">{stageItems.length}</span>
                </div>

                <div className="aqua-card-soft p-2 px-3 mb-3 d-flex justify-content-between small">
                  <span>قيمة المرحلة</span>
                  <strong dir="ltr">{money(stageTotal.toFixed(2), company.currency)}</strong>
                </div>

                <div className="d-flex flex-column gap-3">
                  {stageItems.length === 0 ? (
                    <div className="aqua-card-soft p-4 text-center aqua-muted">لا توجد فرص</div>
                  ) : stageItems.map((opportunity) => (
                    <div
                      className="aqua-card-soft p-3 aqua-sales-opportunity-card"
                      key={opportunity.id}
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div>
                          <Link className="fw-bold text-info text-decoration-none" href={`/dashboard/sales/opportunities/${opportunity.id}`}>
                            {opportunity.title}
                          </Link>
                          <div className="small aqua-muted mt-1">{opportunity.companyName || opportunity.contactName}</div>
                        </div>
                        {opportunity.stale ? <span className="badge text-bg-danger">خاملة</span> : null}
                      </div>

                      <div className="d-flex flex-wrap gap-2 mt-3">
                        <span className="badge text-bg-dark" dir="ltr">{money(opportunity.estimatedValue, opportunity.currency)}</span>
                        <span className="badge text-bg-secondary" dir="ltr">{opportunity.probability}%</span>
                        <span className={`badge ${followUpClass(opportunity.followUp)}`}>{followUpLabel(opportunity.followUp)}</span>
                      </div>

                      <div className="small aqua-muted mt-3">
                        <div>المسؤول: {opportunity.owner?.name || "غير محدد"}</div>
                        <div className="mt-1">الإغلاق: <span dir="ltr">{shortDate(opportunity.expectedCloseDate)}</span></div>
                        {opportunity.nextActivity ? <div className="mt-1">التالي: {opportunity.nextActivity.subject}</div> : null}
                      </div>

                      <div className="d-flex gap-2 mt-3">
                        <Link className="btn btn-sm btn-outline-info flex-fill" href={`/dashboard/sales/opportunities/${opportunity.id}`}>فتح</Link>
                        {canManage ? (
                          <select
                            aria-label="نقل المرحلة"
                            className="form-select form-select-sm"
                            disabled={busyId === opportunity.id}
                            value={opportunity.stage}
                            onChange={(event) => changeStage(opportunity, event.target.value as SalesOpportunityStage)}
                          >
                            {[...openStages, "LOST" as const].map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}
                          </select>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="aqua-card p-4 aqua-sales-closed">
        <h2 className="h5 fw-black mb-1">الفرص المغلقة</h2>
        <div className="small aqua-muted mb-4">الفوز مرتبط بعميل ومشروع، والخسارة تحفظ سبب الإغلاق.</div>

        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle mb-0">
            <thead><tr><th>الفرصة</th><th>النتيجة</th><th>المسؤول</th><th>القيمة</th><th>السبب / المشروع</th><th></th></tr></thead>
            <tbody>
              {filtered.filter((item) => item.stage === "WON" || item.stage === "LOST").length === 0 ? (
                <tr><td className="text-center aqua-muted py-5" colSpan={6}>لا توجد فرص مغلقة مطابقة</td></tr>
              ) : filtered.filter((item) => item.stage === "WON" || item.stage === "LOST").map((opportunity) => (
                <tr key={opportunity.id}>
                  <td><div className="fw-bold">{opportunity.title}</div><div className="small aqua-muted">{opportunity.contactName}</div></td>
                  <td><span className={`badge ${opportunity.stage === "WON" ? "text-bg-success" : "text-bg-danger"}`}>{stageLabels[opportunity.stage]}</span></td>
                  <td>{opportunity.owner?.name || "غير محدد"}</td>
                  <td dir="ltr">{money(opportunity.estimatedValue, opportunity.currency)}</td>
                  <td>{opportunity.project?.name || opportunity.lostReason || "—"}</td>
                  <td><Link className="btn btn-sm btn-outline-info" href={`/dashboard/sales/opportunities/${opportunity.id}`}>عرض</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
