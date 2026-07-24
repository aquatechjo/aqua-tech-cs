"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type {
  SalesActivityStatus,
  SalesActivityType,
  SalesOpportunityStage,
  SalesProposalStatus,
  ServiceRequestPriority,
  ServiceRequestSource,
} from "@/generated/prisma/enums"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import { displayProposalStatus } from "@/lib/sales"

type UserOption = { id: string; name: string; email: string }
type ClientOption = { id: string; name: string }

type Opportunity = {
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
  notes: string | null
  wonAt: string | null
  lostAt: string | null
  owner: UserOption | null
  client: { id: string; name: string; status: string } | null
  project: { id: string; name: string; code: string | null; status: string } | null
  serviceRequest: {
    id: string
    customerName: string
    status: string
    budgetRange: string | null
    timeline: string | null
    proposalUrl: string | null
  } | null
  activities: Array<{
    id: string
    type: SalesActivityType
    status: SalesActivityStatus
    subject: string
    details: string | null
    outcome: string | null
    scheduledAt: string | null
    completedAt: string | null
    createdBy: { id: string; name: string } | null
    createdAt: string
    updatedAt: string
  }>
  proposals: Array<{
    id: string
    proposalNumber: string
    version: number
    status: SalesProposalStatus
    title: string
    amount: string
    currency: string
    validUntil: string | null
    url: string | null
    notes: string | null
    sentAt: string | null
    acceptedAt: string | null
    rejectedAt: string | null
    createdBy: { id: string; name: string } | null
    createdAt: string
    updatedAt: string
  }>
  createdAt: string
  updatedAt: string
}

const stages: SalesOpportunityStage[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "ON_HOLD",
  "LOST",
]
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
const activityTypes: SalesActivityType[] = [
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "FOLLOW_UP",
  "NOTE",
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

function activityTypeLabel(value: SalesActivityType) {
  return {
    CALL: "مكالمة",
    WHATSAPP: "واتساب",
    EMAIL: "إيميل",
    MEETING: "اجتماع",
    FOLLOW_UP: "متابعة",
    NOTE: "ملاحظة",
  }[value]
}

function activityStatusLabel(value: SalesActivityStatus) {
  return { PLANNED: "مخططة", COMPLETED: "مكتملة", CANCELLED: "ملغاة" }[value]
}

function proposalStatusLabel(value: ReturnType<typeof displayProposalStatus>) {
  return {
    DRAFT: "مسودة",
    SENT: "مرسل",
    ACCEPTED: "مقبول",
    REJECTED: "مرفوض",
    CANCELLED: "ملغى",
    EXPIRED: "منتهي",
  }[value]
}

function proposalBadge(value: ReturnType<typeof displayProposalStatus>) {
  if (value === "ACCEPTED") return "text-bg-success"
  if (value === "SENT") return "text-bg-info"
  if (value === "DRAFT") return "text-bg-secondary"
  return "text-bg-danger"
}

function dateTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function money(value: string, currency: string) {
  return `${Number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

function dateTimeInput(value: string | null) {
  return value ? value.slice(0, 16) : ""
}

export default function OpportunityDetailClient({
  opportunity,
  users,
  clients,
  company,
  canManage,
}: {
  opportunity: Opportunity
  users: UserOption[]
  clients: ClientOption[]
  company: { currency: string; timezone: string }
  canManage: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const [title, setTitle] = useState(opportunity.title)
  const [contactName, setContactName] = useState(opportunity.contactName)
  const [companyName, setCompanyName] = useState(opportunity.companyName ?? "")
  const [email, setEmail] = useState(opportunity.email ?? "")
  const [phone, setPhone] = useState(opportunity.phone ?? "")
  const [serviceType, setServiceType] = useState(opportunity.serviceType)
  const [stage, setStage] = useState<SalesOpportunityStage>(opportunity.stage)
  const [priority, setPriority] = useState<ServiceRequestPriority>(opportunity.priority)
  const [source, setSource] = useState<ServiceRequestSource>(opportunity.source)
  const [estimatedValue, setEstimatedValue] = useState(opportunity.estimatedValue)
  const [probability, setProbability] = useState(String(opportunity.probability))
  const [expectedCloseDate, setExpectedCloseDate] = useState(dateInput(opportunity.expectedCloseDate))
  const [nextFollowUpAt, setNextFollowUpAt] = useState(dateTimeInput(opportunity.nextFollowUpAt))
  const [ownerId, setOwnerId] = useState(opportunity.owner?.id ?? "")
  const [clientId, setClientId] = useState(opportunity.client?.id ?? "")
  const [lostReason, setLostReason] = useState(opportunity.lostReason ?? "")
  const [notes, setNotes] = useState(opportunity.notes ?? "")

  const [activityType, setActivityType] = useState<SalesActivityType>("FOLLOW_UP")
  const [activitySubject, setActivitySubject] = useState("")
  const [activityScheduledAt, setActivityScheduledAt] = useState("")
  const [activityDetails, setActivityDetails] = useState("")

  const [proposalTitle, setProposalTitle] = useState(`عرض ${opportunity.serviceType}`)
  const [proposalAmount, setProposalAmount] = useState(opportunity.estimatedValue)
  const [proposalValidUntil, setProposalValidUntil] = useState("")
  const [proposalUrl, setProposalUrl] = useState(opportunity.serviceRequest?.proposalUrl ?? "")
  const [proposalNotes, setProposalNotes] = useState("")
  const [sendImmediately, setSendImmediately] = useState(false)

  function resetMessages() {
    setError("")
    setSuccess("")
  }

  async function saveOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    setBusy("opportunity")

    try {
      const response = await fetch(`/api/sales/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contactName,
          companyName,
          email,
          phone,
          serviceType,
          priority,
          source,
          expectedCloseDate: expectedCloseDate || null,
          nextFollowUpAt: nextFollowUpAt || null,
          ownerId: ownerId || null,
          ...(stage !== "WON"
            ? {
                ...(stage !== opportunity.stage ? { stage } : {}),
                estimatedValue,
                currency: company.currency,
                probability: Number(probability),
                clientId: clientId || null,
                ...(stage === "LOST" ? { lostReason } : {}),
              }
            : {}),
          notes,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ الفرصة")
        return
      }

      setSuccess("تم حفظ بيانات الفرصة")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  async function convertOpportunity() {
    resetMessages()
    setBusy("convert")

    try {
      const response = await fetch(`/api/sales/opportunities/${opportunity.id}/convert`, {
        method: "POST",
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تحويل الفرصة")
        return
      }

      setStage("WON")
      setProbability("100")
      setSuccess("تم تسجيل الفوز وإنشاء أو ربط العميل والمشروع")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    setBusy("activity-create")

    try {
      const response = await fetch(`/api/sales/opportunities/${opportunity.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityType,
          subject: activitySubject,
          scheduledAt: activityType === "NOTE" ? null : activityScheduledAt || null,
          details: activityDetails,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر إضافة المتابعة")
        return
      }

      setActivitySubject("")
      setActivityScheduledAt("")
      setActivityDetails("")
      setSuccess("تمت إضافة المتابعة")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  async function updateActivity(
    activityId: string,
    status: SalesActivityStatus,
  ) {
    resetMessages()
    setBusy(`activity-${activityId}`)
    const outcome =
      status === "COMPLETED"
        ? window.prompt("ما نتيجة المتابعة؟")
        : null

    try {
      const response = await fetch(
        `/api/sales/opportunities/${opportunity.id}/activities/${activityId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, outcome }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تحديث المتابعة")
        return
      }

      setSuccess("تم تحديث المتابعة")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  async function createProposal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetMessages()
    setBusy("proposal-create")

    try {
      const response = await fetch(`/api/sales/opportunities/${opportunity.id}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposalTitle,
          amount: proposalAmount,
          currency: company.currency,
          validUntil: proposalValidUntil || null,
          url: proposalUrl,
          notes: proposalNotes,
          sendImmediately,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر إنشاء العرض")
        return
      }

      setProposalNotes("")
      setSendImmediately(false)
      setSuccess("تم إنشاء العرض التجاري")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  async function updateProposal(
    proposalId: string,
    status: SalesProposalStatus,
  ) {
    resetMessages()
    setBusy(`proposal-${proposalId}`)

    try {
      const response = await fetch(
        `/api/sales/opportunities/${opportunity.id}/proposals/${proposalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تحديث العرض")
        return
      }

      if (status === "SENT") setStage("PROPOSAL")
      if (status === "ACCEPTED") {
        setStage("NEGOTIATION")
        setProbability((value) => String(Math.max(Number(value), 90)))
      }
      setSuccess("تم تحديث حالة العرض")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="d-flex flex-column gap-4">
      <AquaPageHeader
        badge={`Opportunity • ${stageLabels[stage]}`}
        title={opportunity.title}
        description="ملف الفرصة التجاري: البيانات، المتابعات، العروض، والانتقال المنضبط إلى العميل والمشروع."
        brandValue="CRM"
      />

      <div className="d-flex flex-wrap gap-2">
        <Link className="btn btn-outline-info" href="/dashboard/sales">العودة لخط المبيعات</Link>
        {opportunity.project ? <Link className="btn btn-outline-info" href={`/dashboard/projects/${opportunity.project.id}`}>فتح المشروع</Link> : null}
        {canManage && stage !== "WON" && stage !== "LOST" ? (
          <button className="btn btn-success fw-bold" disabled={busy === "convert"} type="button" onClick={convertOpportunity}>
            {busy === "convert" ? "جارٍ التحويل..." : "تسجيل فوز وتحويل لمشروع"}
          </button>
        ) : null}
      </div>

      {error ? <div className="alert alert-danger border-0 rounded-4 mb-0">{error}</div> : null}
      {success ? <div className="alert alert-success border-0 rounded-4 mb-0">{success}</div> : null}

      <div className="row g-3">
        {[
          ["القيمة المتوقعة", money(estimatedValue, company.currency)],
          ["احتمال الفوز", `${probability}%`],
          ["المتابعة القادمة", dateTime(opportunity.nextFollowUpAt)],
          ["آخر تواصل", dateTime(opportunity.lastContactAt)],
        ].map(([label, value]) => (
          <div className="col-12 col-md-6 col-xl-3" key={label}>
            <div className="aqua-card p-4 h-100">
              <div className="small aqua-muted">{label}</div>
              <div className="h5 fw-black mt-3 mb-0" dir="ltr">{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <form className="aqua-card p-4 h-100" onSubmit={saveOpportunity}>
            <div className="d-flex align-items-center justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 fw-black mb-1">بيانات الفرصة</h2>
                <div className="small aqua-muted">تحديث الملكية والقيمة والمرحلة وخطة الإغلاق.</div>
              </div>
              <span className={`badge ${stage === "WON" ? "text-bg-success" : stage === "LOST" ? "text-bg-danger" : "text-bg-info"}`}>{stageLabels[stage]}</span>
            </div>

            <div className="row g-3">
              <div className="col-12 col-lg-8"><label className="form-label">العنوان</label><input className="form-control" disabled={!canManage} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
              <div className="col-12 col-lg-4"><label className="form-label">الخدمة</label><input className="form-control" disabled={!canManage} value={serviceType} onChange={(event) => setServiceType(event.target.value)} /></div>
              <div className="col-12 col-md-6"><label className="form-label">جهة الاتصال</label><input className="form-control" disabled={!canManage} value={contactName} onChange={(event) => setContactName(event.target.value)} /></div>
              <div className="col-12 col-md-6"><label className="form-label">الشركة</label><input className="form-control" disabled={!canManage} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div>
              <div className="col-12 col-md-6"><label className="form-label">الإيميل</label><input className="form-control text-start" dir="ltr" disabled={!canManage} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
              <div className="col-12 col-md-6"><label className="form-label">الهاتف</label><input className="form-control text-start" dir="ltr" disabled={!canManage} value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
              <div className="col-12 col-md-4"><label className="form-label">المرحلة</label><select className="form-select" disabled={!canManage || stage === "WON"} value={stage} onChange={(event) => setStage(event.target.value as SalesOpportunityStage)}>{stage === "WON" ? <option value="WON">فوز</option> : stages.map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}</select></div>
              <div className="col-12 col-md-4"><label className="form-label">الأولوية</label><select className="form-select" disabled={!canManage} value={priority} onChange={(event) => setPriority(event.target.value as ServiceRequestPriority)}>{priorities.map((item) => <option key={item} value={item}>{priorityLabel(item)}</option>)}</select></div>
              <div className="col-12 col-md-4"><label className="form-label">المصدر</label><select className="form-select" disabled={!canManage} value={source} onChange={(event) => setSource(event.target.value as ServiceRequestSource)}>{sources.map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>)}</select></div>
              <div className="col-12 col-md-4"><label className="form-label">القيمة</label><div className="input-group" dir="ltr"><input className="form-control" disabled={!canManage || stage === "WON"} min="0" step="0.01" type="number" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} /><span className="input-group-text">{company.currency}</span></div></div>
              <div className="col-12 col-md-4"><label className="form-label">الاحتمال %</label><input className="form-control" disabled={!canManage || stage === "WON" || stage === "LOST"} min="0" max="100" type="number" value={probability} onChange={(event) => setProbability(event.target.value)} /></div>
              <div className="col-12 col-md-4"><label className="form-label">الإغلاق المتوقع</label><input className="form-control text-start" dir="ltr" disabled={!canManage} type="date" value={expectedCloseDate} onChange={(event) => setExpectedCloseDate(event.target.value)} /></div>
              <div className="col-12 col-md-6"><label className="form-label">المسؤول</label><select className="form-select" disabled={!canManage} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">غير محدد</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="col-12 col-md-6"><label className="form-label">العميل المرتبط</label><select className="form-select" disabled={!canManage || Boolean(opportunity.project)} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">غير مرتبط</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="col-12 col-md-6"><label className="form-label">المتابعة القادمة</label><input className="form-control text-start" dir="ltr" disabled={!canManage} type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} /></div>
              {stage === "LOST" ? <div className="col-12 col-md-6"><label className="form-label">سبب الخسارة</label><input className="form-control" disabled={!canManage} required value={lostReason} onChange={(event) => setLostReason(event.target.value)} /></div> : null}
              <div className="col-12"><label className="form-label">ملاحظات</label><textarea className="form-control" disabled={!canManage} rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            </div>

            {canManage ? <button className="btn btn-info fw-bold mt-4" disabled={busy === "opportunity"} type="submit">{busy === "opportunity" ? "جارٍ الحفظ..." : "حفظ بيانات الفرصة"}</button> : null}
          </form>
        </div>

        <div className="col-12 col-xl-4">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-4">الروابط والسياق</h2>
            <div className="d-flex flex-column gap-3">
              <div className="aqua-card-soft p-3"><div className="small aqua-muted">العميل</div><div className="fw-bold mt-2">{opportunity.client?.name || "لم يُنشأ بعد"}</div></div>
              <div className="aqua-card-soft p-3"><div className="small aqua-muted">المشروع</div><div className="fw-bold mt-2">{opportunity.project?.name || "لم يُنشأ بعد"}</div>{opportunity.project?.code ? <div className="small aqua-muted mt-1" dir="ltr">{opportunity.project.code}</div> : null}</div>
              <div className="aqua-card-soft p-3"><div className="small aqua-muted">طلب الخدمة</div><div className="fw-bold mt-2">{opportunity.serviceRequest?.customerName || "فرصة يدوية"}</div>{opportunity.serviceRequest ? <div className="small aqua-muted mt-1">{opportunity.serviceRequest.status} • {opportunity.serviceRequest.budgetRange || "بدون ميزانية"}</div> : null}</div>
              <div className="aqua-card-soft p-3"><div className="small aqua-muted">تاريخ الإنشاء</div><div className="fw-bold mt-2" dir="ltr">{dateTime(opportunity.createdAt)}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-1">المتابعات والتواصل</h2>
            <div className="small aqua-muted mb-4">كل مكالمة أو اجتماع أو متابعة قادمة مرتبطة بالفرصة.</div>

            {canManage && stage !== "WON" && stage !== "LOST" ? (
              <form className="aqua-card-soft p-3 mb-4" onSubmit={createActivity}>
                <div className="row g-3">
                  <div className="col-12 col-md-4"><label className="form-label">النوع</label><select className="form-select" value={activityType} onChange={(event) => setActivityType(event.target.value as SalesActivityType)}>{activityTypes.map((item) => <option key={item} value={item}>{activityTypeLabel(item)}</option>)}</select></div>
                  <div className="col-12 col-md-8"><label className="form-label">العنوان</label><input className="form-control" required value={activitySubject} onChange={(event) => setActivitySubject(event.target.value)} /></div>
                  {activityType !== "NOTE" ? <div className="col-12"><label className="form-label">الموعد</label><input className="form-control text-start" dir="ltr" required type="datetime-local" value={activityScheduledAt} onChange={(event) => setActivityScheduledAt(event.target.value)} /></div> : null}
                  <div className="col-12"><label className="form-label">التفاصيل</label><textarea className="form-control" rows={2} value={activityDetails} onChange={(event) => setActivityDetails(event.target.value)} /></div>
                </div>
                <button className="btn btn-info btn-sm fw-bold mt-3" disabled={busy === "activity-create"} type="submit">إضافة المتابعة</button>
              </form>
            ) : null}

            <div className="d-flex flex-column gap-3">
              {opportunity.activities.length === 0 ? <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد متابعات بعد</div> : opportunity.activities.map((activity) => (
                <div className="aqua-card-soft p-3" key={activity.id}>
                  <div className="d-flex align-items-start justify-content-between gap-3"><div><div className="fw-bold">{activity.subject}</div><div className="small aqua-muted mt-1">{activityTypeLabel(activity.type)} • {activity.createdBy?.name || "مستخدم سابق"}</div></div><span className={`badge ${activity.status === "COMPLETED" ? "text-bg-success" : activity.status === "CANCELLED" ? "text-bg-danger" : "text-bg-info"}`}>{activityStatusLabel(activity.status)}</span></div>
                  <div className="small aqua-muted mt-3" dir="ltr">{dateTime(activity.scheduledAt ?? activity.completedAt ?? activity.createdAt)}</div>
                  {activity.details ? <div className="mt-2">{activity.details}</div> : null}
                  {activity.outcome ? <div className="alert alert-info border-0 rounded-3 py-2 px-3 mt-3 mb-0">النتيجة: {activity.outcome}</div> : null}
                  {canManage && activity.status !== "COMPLETED" ? <div className="d-flex gap-2 mt-3">{activity.status === "PLANNED" ? <><button className="btn btn-sm btn-success" disabled={busy === `activity-${activity.id}`} type="button" onClick={() => updateActivity(activity.id, "COMPLETED")}>إكمال</button><button className="btn btn-sm btn-outline-danger" disabled={busy === `activity-${activity.id}`} type="button" onClick={() => updateActivity(activity.id, "CANCELLED")}>إلغاء</button></> : <button className="btn btn-sm btn-outline-info" disabled={busy === `activity-${activity.id}`} type="button" onClick={() => updateActivity(activity.id, "PLANNED")}>إعادة جدولة</button>}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-1">العروض التجارية</h2>
            <div className="small aqua-muted mb-4">كل تعديل تجاري بعد الإرسال يحتاج نسخة جديدة للحفاظ على الأثر.</div>

            {canManage && stage !== "WON" && stage !== "LOST" ? (
              <form className="aqua-card-soft p-3 mb-4" onSubmit={createProposal}>
                <div className="row g-3">
                  <div className="col-12 col-md-7"><label className="form-label">عنوان العرض</label><input className="form-control" required value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} /></div>
                  <div className="col-12 col-md-5"><label className="form-label">القيمة</label><div className="input-group" dir="ltr"><input className="form-control" min="0.01" step="0.01" type="number" value={proposalAmount} onChange={(event) => setProposalAmount(event.target.value)} /><span className="input-group-text">{company.currency}</span></div></div>
                  <div className="col-12 col-md-5"><label className="form-label">صالح حتى</label><input className="form-control text-start" dir="ltr" type="date" value={proposalValidUntil} onChange={(event) => setProposalValidUntil(event.target.value)} /></div>
                  <div className="col-12 col-md-7"><label className="form-label">رابط العرض</label><input className="form-control text-start" dir="ltr" type="url" value={proposalUrl} onChange={(event) => setProposalUrl(event.target.value)} /></div>
                  <div className="col-12"><label className="form-label">ملاحظات</label><textarea className="form-control" rows={2} value={proposalNotes} onChange={(event) => setProposalNotes(event.target.value)} /></div>
                </div>
                <div className="form-check mt-3"><input className="form-check-input" id="sendImmediately" type="checkbox" checked={sendImmediately} onChange={(event) => setSendImmediately(event.target.checked)} /><label className="form-check-label" htmlFor="sendImmediately">تسجيل العرض كمرسل مباشرة</label></div>
                <button className="btn btn-info btn-sm fw-bold mt-3" disabled={busy === "proposal-create"} type="submit">إنشاء العرض</button>
              </form>
            ) : null}

            <div className="d-flex flex-column gap-3">
              {opportunity.proposals.length === 0 ? <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد عروض بعد</div> : opportunity.proposals.map((proposal) => {
                const displayStatus = displayProposalStatus({ status: proposal.status, validUntil: proposal.validUntil, timeZone: company.timezone })
                return (
                  <div className="aqua-card-soft p-3" key={proposal.id}>
                    <div className="d-flex align-items-start justify-content-between gap-3"><div><div className="fw-bold">{proposal.title}</div><div className="small text-info mt-1" dir="ltr">{proposal.proposalNumber} • v{proposal.version}</div></div><span className={`badge ${proposalBadge(displayStatus)}`}>{proposalStatusLabel(displayStatus)}</span></div>
                    <div className="h5 fw-black mt-3 mb-0" dir="ltr">{money(proposal.amount, proposal.currency)}</div>
                    <div className="small aqua-muted mt-2">صالح حتى: <span dir="ltr">{proposal.validUntil ? proposal.validUntil.slice(0, 10) : "—"}</span></div>
                    {proposal.url ? <a className="btn btn-sm btn-outline-info mt-3" href={proposal.url} target="_blank" rel="noreferrer">فتح العرض</a> : null}
                    {canManage ? <div className="d-flex flex-wrap gap-2 mt-3">{proposal.status === "DRAFT" ? <><button className="btn btn-sm btn-info" disabled={busy === `proposal-${proposal.id}`} type="button" onClick={() => updateProposal(proposal.id, "SENT")}>إرسال</button><button className="btn btn-sm btn-outline-danger" disabled={busy === `proposal-${proposal.id}`} type="button" onClick={() => updateProposal(proposal.id, "CANCELLED")}>إلغاء</button></> : null}{proposal.status === "SENT" ? <><button className="btn btn-sm btn-success" disabled={busy === `proposal-${proposal.id}`} type="button" onClick={() => updateProposal(proposal.id, "ACCEPTED")}>قبول</button><button className="btn btn-sm btn-outline-danger" disabled={busy === `proposal-${proposal.id}`} type="button" onClick={() => updateProposal(proposal.id, "REJECTED")}>رفض</button></> : null}</div> : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
