"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AquaDatePicker from "@/components/aqua/AquaDatePicker"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import { AquaAlert, AquaConfirmDialog } from "@/components/aqua"

type Invoice = {
  id: string
  invoiceNumber: string
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED"
  displayStatus: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED"
  currency: string
  issueDate: string | null
  dueDate: string | null
  subtotal: string
  discountAmount: string
  taxAmount: string
  totalAmount: string
  amountPaid: string
  notes: string | null
  terms: string | null
  client: { id: string; name: string; email: string | null; phone: string | null } | null
  project: { id: string; name: string; code: string | null } | null
  createdBy: { id: string; name: string; email: string } | null
  contractAmendment: {
    id: string
    amendmentNumber: string
    financialAmount: string
    invoiceIssuedAt: string | null
    invoiceIssueReference: string | null
    invoiceTaxDecision: "TAX_APPLIED" | "TAX_EXEMPT" | null
    invoiceDeliveryRecipientName: string | null
    invoiceDeliveryRecipientEmail: string | null
    invoiceDeliveryReference: string | null
    invoiceDeliverySentAt: string | null
    invoiceDeliveryFailedAt: string | null
    invoiceDeliveryAttemptCount: number
    invoicePortalExpiresAt: string | null
    invoicePortalIssuedAt: string | null
    invoicePortalRevokedAt: string | null
    invoicePortalFirstViewedAt: string | null
    invoicePortalLastViewedAt: string | null
    invoicePortalViewCount: number
    invoicePortalDeliveryRecipientName: string | null
    invoicePortalDeliveryRecipientEmail: string | null
    invoicePortalDeliverySentAt: string | null
    invoicePortalDeliveryFailedAt: string | null
    invoicePortalDeliveryAttemptCount: number
    invoiceReminderSentAt: string | null
    invoiceReminderFailedAt: string | null
    invoiceReminderAttemptCount: number
    invoiceReminderCount: number
    invoiceReminderScheduleEnabled: boolean
    invoiceReminderNextAt: string | null
  } | null
  items: Array<{
    id: string
    description: string
    quantity: string
    unitPrice: string
    lineTotal: string
    sortOrder: number
  }>
  payments: Array<{
    id: string
    amount: string
    currency: string
    method: "CASH" | "BANK_TRANSFER" | "CARD" | "WALLET" | "CHEQUE" | "OTHER"
    status: "POSTED" | "REVERSED"
    reference: string | null
    notes: string | null
    paidAt: string
    reversedAt: string | null
    reversalReason: string | null
    recordedBy: { id: string; name: string } | null
    reversedBy: { id: string; name: string } | null
  }>
}

type Line = { description: string; quantity: string; unitPrice: string }

const statusLabels = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
} as const

const methodLabels = {
  CASH: "نقدي",
  BANK_TRANSFER: "حوالة بنكية",
  CARD: "بطاقة",
  WALLET: "محفظة إلكترونية",
  CHEQUE: "شيك",
  OTHER: "أخرى",
} as const

function money(value: string | number, currency: string) {
  return `${Number(value).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "—"
}

export default function InvoiceDetailClient({
  invoice,
  canManage,
  defaultDate,
}: {
  invoice: Invoice
  canManage: boolean
  defaultDate: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) ?? "")
  const [notes, setNotes] = useState(invoice.notes ?? "")
  const [terms, setTerms] = useState(invoice.terms ?? "")
  const [discountAmount, setDiscountAmount] = useState(invoice.discountAmount)
  const [taxAmount, setTaxAmount] = useState(invoice.taxAmount)
  const [issueReference, setIssueReference] = useState("")
  const [taxDecision, setTaxDecision] = useState<"TAX_APPLIED" | "TAX_EXEMPT">(
    Number(invoice.taxAmount) > 0 ? "TAX_APPLIED" : "TAX_EXEMPT",
  )
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false)
  const [deliveryRecipientName, setDeliveryRecipientName] = useState(
    invoice.contractAmendment?.invoiceDeliveryRecipientName ?? invoice.client?.name ?? "",
  )
  const [deliveryRecipientEmail, setDeliveryRecipientEmail] = useState(
    invoice.contractAmendment?.invoiceDeliveryRecipientEmail ?? invoice.client?.email ?? "",
  )
  const [deliveryReference, setDeliveryReference] = useState(
    invoice.contractAmendment?.invoiceDeliveryReference ?? "",
  )
  const [deliveryConfirmOpen, setDeliveryConfirmOpen] = useState(false)
  const [portalDays, setPortalDays] = useState("14")
  const [portalPath, setPortalPath] = useState("")
  const [portalRecipientName, setPortalRecipientName] = useState(
    invoice.contractAmendment?.invoicePortalDeliveryRecipientName ?? invoice.client?.name ?? "",
  )
  const [portalRecipientEmail, setPortalRecipientEmail] = useState(
    invoice.contractAmendment?.invoicePortalDeliveryRecipientEmail ?? invoice.client?.email ?? "",
  )
  const [portalDeliveryConfirmOpen, setPortalDeliveryConfirmOpen] = useState(false)
  const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false)
  const [items, setItems] = useState<Line[]>(
    invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  )

  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<keyof typeof methodLabels>("BANK_TRANSFER")
  const [paymentDate, setPaymentDate] = useState(defaultDate)
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")

  const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid))
  const portalUrl = portalPath && typeof window !== "undefined"
    ? `${window.location.origin}${portalPath}`
    : portalPath
  const preview = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0,
    )
    return {
      subtotal,
      total: subtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0),
    }
  }, [discountAmount, items, taxAmount])

  function updateLine(index: number, patch: Partial<Line>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  async function mutate(body: Record<string, unknown>, key: string) {
    setBusy(key)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر تحديث الفاتورة")
        return false
      }
      setSuccess("تم تحديث الفاتورة بنجاح")
      router.refresh()
      return true
    } catch {
      setError("تعذر الاتصال بالخادم")
      return false
    } finally {
      setBusy("")
    }
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await mutate(
      invoice.contractAmendment
        ? { action: "UPDATE", dueDate: dueDate || null, notes, terms, taxAmount }
        : { action: "UPDATE", dueDate: dueDate || null, notes, terms, discountAmount, taxAmount, items },
      "save",
    )
  }

  async function issueInvoice() {
    const saved = await mutate(
      {
        action: "ISSUE",
        dueDate: dueDate || null,
        ...(invoice.contractAmendment
          ? { issueReference, taxDecision }
          : {}),
      },
      "issue",
    )
    if (saved) setIssueConfirmOpen(false)
  }

  async function cancelInvoice() {
    const reason = window.prompt("اكتب سبب إلغاء الفاتورة")
    if (!reason) return
    await mutate({ action: "CANCEL", reason }, "cancel")
  }

  async function deliverInvoice() {
    setBusy("delivery")
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: deliveryRecipientName,
          recipientEmail: deliveryRecipientEmail,
          deliveryReference,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر إرسال الفاتورة")
        return
      }
      setSuccess("تم إرسال الفاتورة وتوثيق عملية التسليم")
      setDeliveryConfirmOpen(false)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function managePortal(action: "ISSUE" | "REVOKE") {
    setBusy(`portal-${action.toLowerCase()}`)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/portal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "ISSUE" ? { action, validDays: Number(portalDays) } : { action }) })
      const payload = await response.json()
      if (!response.ok || !payload.ok) { setError(payload.message || "تعذر إدارة رابط الفاتورة"); return }
      setPortalPath(payload.data.path ?? "")
      setSuccess(action === "ISSUE" ? "تم إصدار رابط جديد. انسخه الآن؛ لا يُخزن الرمز بصورته الأصلية." : "تم إلغاء رابط الفاتورة")
      router.refresh()
    } catch { setError("تعذر الاتصال بالخادم") } finally { setBusy("") }
  }

  async function deliverPortal() {
    setBusy("portal-delivery")
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/portal/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: portalRecipientName,
          recipientEmail: portalRecipientEmail,
          validDays: Number(portalDays),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر إرسال رابط الفاتورة")
        return
      }
      setSuccess("تم إرسال رابط جديد وتفعيله بعد قبول مزود البريد")
      setPortalPath("")
      setPortalDeliveryConfirmOpen(false)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function sendPaymentReminder() {
    setBusy("invoice-reminder")
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/portal/reminder`, { method: "POST" })
      const payload = await response.json()
      if (!response.ok || !payload.ok) { setError(payload.message || "تعذر إرسال تذكير الدفع"); return }
      setSuccess(`تم إرسال تذكير الدفع رقم ${payload.data.reminderNumber} وتدوير الرابط بأمان`)
      setPortalPath("")
      setReminderConfirmOpen(false)
      router.refresh()
    } catch { setError("تعذر الاتصال بالخادم") } finally { setBusy("") }
  }

  async function updateReminderSchedule(enabled: boolean) {
    setBusy("invoice-reminder-schedule")
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/portal/reminder-schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) })
      const payload = await response.json()
      if (!response.ok || !payload.ok) { setError(payload.message || "تعذر تحديث جدولة التذكيرات"); return }
      setSuccess(enabled ? "تم تفعيل جدولة تذكيرات الدفع" : "تم إيقاف جدولة تذكيرات الدفع")
      router.refresh()
    } catch { setError("تعذر الاتصال بالخادم") } finally { setBusy("") }
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("payment")
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          method: paymentMethod,
          paidAt: paymentDate || null,
          reference: paymentReference,
          notes: paymentNotes,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر تسجيل الدفعة")
        return
      }
      setPaymentAmount("")
      setPaymentReference("")
      setPaymentNotes("")
      setSuccess("تم تسجيل الدفعة")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function reversePayment(paymentId: string) {
    const reason = window.prompt("اكتب سبب عكس الدفعة. لن يتم حذف السجل.")
    if (!reason) return
    setBusy(`reverse-${paymentId}`)
    setError("")
    try {
      const response = await fetch(`/api/finance/payments/${paymentId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر عكس الدفعة")
        return
      }
      setSuccess("تم عكس الدفعة مع الاحتفاظ بالسجل")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="aqua-invoice-detail-page">
      <AquaPageHeader
        badge={invoice.invoiceNumber}
        title="تفاصيل الفاتورة"
        description="راجع البنود وسجل التحصيلات مع أثر تدقيقي كامل لكل عملية."
        brandValue="Invoice"
      />

      <div className="aqua-finance-actions aqua-finance-actions--split d-print-none">
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-info" href="/dashboard/finance/invoices">رجوع للفواتير</Link>
          <Link className="btn btn-outline-info" href="/dashboard/finance">ملخص المالية</Link>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-light" type="button" onClick={() => window.print()}>طباعة</button>
          {invoice.contractAmendment && ["ISSUED", "PARTIALLY_PAID", "PAID"].includes(invoice.status) ? (
            <Link className="btn btn-outline-info" href={`/invoice-document/${invoice.id}`} target="_blank">
              مستند فاتورة الملحق
            </Link>
          ) : null}
          {canManage && invoice.status === "DRAFT" ? (
            <button className="btn btn-info fw-bold" disabled={Boolean(busy)} type="button" onClick={() => setIssueConfirmOpen(true)}>
              {busy === "issue" ? "جارٍ الإصدار..." : "إصدار الفاتورة"}
            </button>
          ) : null}
          {canManage && !["CANCELLED", "PAID"].includes(invoice.status) && Number(invoice.amountPaid) === 0 ? (
            <button className="btn btn-outline-danger" disabled={Boolean(busy)} type="button" onClick={cancelInvoice}>إلغاء</button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger d-print-none">{error}</div> : null}
      {success ? <div className="alert alert-success d-print-none">{success}</div> : null}

      <div className="aqua-card p-4">
        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="small aqua-muted">فاتورة</div>
            <h2 className="h3 fw-black mt-2" dir="ltr">{invoice.invoiceNumber}</h2>
            <div className="mt-3">
              <span className="badge text-bg-info">{statusLabels[invoice.displayStatus]}</span>
            </div>
          </div>
          <div className="col-12 col-lg-4 text-lg-start">
            <div className="small aqua-muted">العميل</div>
            <div className="fw-bold mt-1">{invoice.client?.name ?? "غير محدد"}</div>
            <div className="small aqua-muted mt-1" dir="ltr">{invoice.client?.email ?? invoice.client?.phone ?? "—"}</div>
            <div className="small aqua-muted mt-3">المشروع</div>
            <div className="fw-bold">{invoice.project?.name ?? "غير مرتبط بمشروع"}</div>
          </div>
        </div>
      </div>

      {invoice.contractAmendment ? (
        <AquaAlert
          variant={invoice.status === "DRAFT" ? "warning" : "success"}
          title={`فاتورة مرتبطة بالملحق ${invoice.contractAmendment.amendmentNumber}`}
        >
          القيمة الأساسية المعتمدة {money(invoice.contractAmendment.financialAmount, invoice.currency)} ثابتة دون خصم أو تعديل بنود.
          {invoice.contractAmendment.invoiceIssueReference
            ? ` مرجع الإصدار: ${invoice.contractAmendment.invoiceIssueReference}.`
            : " يجب توثيق قرار الضريبة ومرجع الإصدار قبل إصدارها."}
        </AquaAlert>
      ) : null}

      {invoice.contractAmendment && invoice.status === "ISSUED" && canManage ? (
        <div className="aqua-card p-4 d-print-none">
          <h2 className="h5 fw-black mb-2">إرسال الفاتورة للعميل</h2>
          {invoice.contractAmendment.invoiceDeliverySentAt ? (
            <AquaAlert variant="success" title="تم إرسال الفاتورة">
              أُرسلت إلى {invoice.contractAmendment.invoiceDeliveryRecipientEmail} بمرجع {invoice.contractAmendment.invoiceDeliveryReference}.
            </AquaAlert>
          ) : (
            <>
              {invoice.contractAmendment.invoiceDeliveryFailedAt ? (
                <AquaAlert variant="warning" title="تعذرت المحاولة السابقة">
                  تم توثيق الفشل. راجع العنوان وإعدادات البريد ثم أعد المحاولة.
                </AquaAlert>
              ) : null}
              <div className="row g-3 mt-1">
                <div className="col-12 col-md-4">
                  <label className="form-label">اسم المستلم</label>
                  <input className="form-control" maxLength={120} value={deliveryRecipientName} onChange={(event) => setDeliveryRecipientName(event.target.value)} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">بريد المستلم</label>
                  <input className="form-control" type="email" maxLength={254} dir="ltr" value={deliveryRecipientEmail} onChange={(event) => setDeliveryRecipientEmail(event.target.value)} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">مرجع التسليم</label>
                  <input className="form-control" maxLength={200} value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} />
                </div>
              </div>
              <button
                className="btn btn-info fw-bold mt-3"
                type="button"
                disabled={!deliveryRecipientName.trim() || !deliveryRecipientEmail.trim() || !deliveryReference.trim() || Boolean(busy)}
                onClick={() => setDeliveryConfirmOpen(true)}
              >
                إرسال الفاتورة
              </button>
            </>
          )}
        </div>
      ) : null}

      {invoice.contractAmendment && ["ISSUED", "PARTIALLY_PAID", "PAID"].includes(invoice.status) && canManage ? (
        <div className="aqua-card p-4 d-print-none">
          <h2 className="h5 fw-black mb-2">بوابة فاتورة العميل</h2>
          <p className="aqua-muted">أنشئ رابطًا عشوائيًا محدود الصلاحية. إصدار رابط جديد يلغي الرابط السابق فورًا.</p>
          {invoice.contractAmendment.invoicePortalIssuedAt && !invoice.contractAmendment.invoicePortalRevokedAt ? (
            <AquaAlert variant="info" title="يوجد رابط مُصدر">
              ينتهي في {dateOnly(invoice.contractAmendment.invoicePortalExpiresAt)} — عدد المشاهدات {invoice.contractAmendment.invoicePortalViewCount}.
              {invoice.contractAmendment.invoicePortalFirstViewedAt ? ` أول مشاهدة: ${dateOnly(invoice.contractAmendment.invoicePortalFirstViewedAt)}.` : " لم يُفتح بعد."}
            </AquaAlert>
          ) : null}
          {portalPath ? (
            <div className="aqua-card-soft p-3 mt-3">
              <label className="form-label">الرابط الجديد — انسخه الآن</label>
              <div className="input-group" dir="ltr">
                <input className="form-control" readOnly value={portalUrl} />
                <button className="btn btn-outline-info" type="button" onClick={() => navigator.clipboard.writeText(portalUrl)}>نسخ</button>
              </div>
            </div>
          ) : null}
          <div className="d-flex flex-wrap align-items-end gap-2 mt-3">
            <div><label className="form-label">مدة الصلاحية بالأيام</label><input className="form-control" type="number" min="1" max="30" value={portalDays} onChange={(event) => setPortalDays(event.target.value)} /></div>
            <button className="btn btn-info fw-bold" type="button" disabled={Boolean(busy) || Number(portalDays) < 1 || Number(portalDays) > 30} onClick={() => managePortal("ISSUE")}>{busy === "portal-issue" ? "جارٍ الإصدار..." : "إصدار / تدوير الرابط"}</button>
            {invoice.contractAmendment.invoicePortalIssuedAt && !invoice.contractAmendment.invoicePortalRevokedAt ? <button className="btn btn-outline-danger" type="button" disabled={Boolean(busy)} onClick={() => managePortal("REVOKE")}>{busy === "portal-revoke" ? "جارٍ الإلغاء..." : "إلغاء الرابط"}</button> : null}
          </div>
          <div className="aqua-card-soft p-3 mt-3">
            <h3 className="h6 fw-black mb-2">إرسال الرابط الآمن</h3>
            <p className="small aqua-muted">يُفعّل الرابط الجديد فقط بعد قبول البريد، ويبقى الرابط السابق فعالًا إذا فشلت المحاولة.</p>
            {invoice.contractAmendment.invoicePortalDeliveryFailedAt ? <AquaAlert variant="warning" title="فشلت المحاولة السابقة">تم توثيق الفشل ويمكن إعادة المحاولة دون تعطيل الرابط السابق.</AquaAlert> : null}
            {invoice.contractAmendment.invoicePortalDeliverySentAt ? <AquaAlert variant="success" title="آخر إرسال ناجح">أُرسل الرابط إلى {invoice.contractAmendment.invoicePortalDeliveryRecipientEmail} — المحاولات: {invoice.contractAmendment.invoicePortalDeliveryAttemptCount}.</AquaAlert> : null}
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-5"><label className="form-label">اسم المستلم</label><input className="form-control" maxLength={120} value={portalRecipientName} onChange={(event) => setPortalRecipientName(event.target.value)} /></div>
              <div className="col-12 col-md-5"><label className="form-label">بريد المستلم</label><input className="form-control" type="email" maxLength={254} dir="ltr" value={portalRecipientEmail} onChange={(event) => setPortalRecipientEmail(event.target.value)} /></div>
              <div className="col-12 col-md-2"><button className="btn btn-info fw-bold w-100" type="button" disabled={Boolean(busy) || !portalRecipientName.trim() || !portalRecipientEmail.trim() || Number(portalDays) < 1 || Number(portalDays) > 30} onClick={() => setPortalDeliveryConfirmOpen(true)}>إرسال الرابط</button></div>
            </div>
            {invoice.contractAmendment.invoicePortalDeliverySentAt && outstanding > 0 ? (
              <div className="border-top mt-3 pt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <div className="fw-bold">تذكير الدفع</div>
                  <div className="small aqua-muted">72 ساعة بين الرسائل، وبحد أقصى 3 تذكيرات. التذكيرات الناجحة: {invoice.contractAmendment.invoiceReminderCount}/3.</div>
                  {invoice.contractAmendment.invoiceReminderScheduleEnabled && invoice.contractAmendment.invoiceReminderNextAt ? <div className="small text-info">الجدولة مفعّلة — الموعد التالي: <bdi dir="ltr">{new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invoice.contractAmendment.invoiceReminderNextAt))}</bdi></div> : null}
                  {invoice.contractAmendment.invoiceReminderFailedAt ? <div className="small text-warning">فشلت المحاولة السابقة وبقي الرابط السابق فعالًا.</div> : null}
                </div>
                <div className="d-flex gap-2"><button className="btn btn-outline-info fw-bold" type="button" disabled={Boolean(busy) || invoice.contractAmendment.invoiceReminderCount >= 3} onClick={() => setReminderConfirmOpen(true)}>إرسال تذكير</button><button className="btn btn-outline-secondary fw-bold" type="button" disabled={Boolean(busy) || invoice.contractAmendment.invoiceReminderCount >= 3} onClick={() => void updateReminderSchedule(!invoice.contractAmendment!.invoiceReminderScheduleEnabled)}>{invoice.contractAmendment.invoiceReminderScheduleEnabled ? "إيقاف الجدولة" : "تفعيل الجدولة"}</button></div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {invoice.status === "DRAFT" && canManage ? (
        <form className="aqua-card p-4" onSubmit={saveDraft}>
          <h2 className="h5 fw-black mb-3">تحرير المسودة</h2>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-4">
              <label className="form-label">تاريخ الاستحقاق</label>
              <AquaDatePicker value={dueDate} onChange={setDueDate} />
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label">الخصم</label>
              <input className="form-control" type="number" min="0" step="0.01" dir="ltr" value={discountAmount} disabled={Boolean(invoice.contractAmendment)} onChange={(e) => setDiscountAmount(e.target.value)} />
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label">الضريبة</label>
              <input className="form-control" type="number" min="0" step="0.01" dir="ltr" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </div>
          </div>

          {invoice.contractAmendment ? (
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label">قرار الضريبة</label>
                <select
                  className="form-select"
                  value={taxDecision}
                  onChange={(event) =>
                    setTaxDecision(event.target.value as "TAX_APPLIED" | "TAX_EXEMPT")
                  }
                >
                  <option value="TAX_EXEMPT">معفاة / لا ضريبة</option>
                  <option value="TAX_APPLIED">تم تطبيق الضريبة</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">مرجع الإصدار</label>
                <input
                  className="form-control"
                  maxLength={200}
                  value={issueReference}
                  onChange={(event) => setIssueReference(event.target.value)}
                  placeholder="قرار أو مرجع المراجعة المالية"
                />
              </div>
            </div>
          ) : null}

          <div className="d-flex flex-column gap-2">
            {items.map((item, index) => (
              <div className="row g-2 align-items-end aqua-card-soft p-2" key={index}>
                <div className="col-12 col-lg-6">
                  <label className="form-label small">الوصف</label>
                  <input className="form-control" required disabled={Boolean(invoice.contractAmendment)} value={item.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </div>
                <div className="col-4 col-lg-2">
                  <label className="form-label small">الكمية</label>
                  <input className="form-control" type="number" min="0.01" step="0.01" required disabled={Boolean(invoice.contractAmendment)} dir="ltr" value={item.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                </div>
                <div className="col-5 col-lg-2">
                  <label className="form-label small">سعر الوحدة</label>
                  <input className="form-control" type="number" min="0" step="0.01" required disabled={Boolean(invoice.contractAmendment)} dir="ltr" value={item.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
                </div>
                <div className="col-3 col-lg-2 d-grid">
                  <button className="btn btn-outline-danger" type="button" disabled={items.length === 1 || Boolean(invoice.contractAmendment)} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>حذف</button>
                </div>
              </div>
            ))}
          </div>
          {!invoice.contractAmendment ? (
            <button className="btn btn-sm btn-outline-info mt-2" type="button" onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unitPrice: "0" }])}>إضافة بند</button>
          ) : null}

          <div className="row g-3 mt-2">
            <div className="col-12 col-lg-6"><label className="form-label">ملاحظات</label><textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="col-12 col-lg-6"><label className="form-label">الشروط</label><textarea className="form-control" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          </div>
          <div className="d-flex justify-content-between align-items-center gap-3 mt-4">
            <div className="fw-bold" dir="ltr">الإجمالي المتوقع: {money(preview.total, invoice.currency)}</div>
            <button className="btn btn-info fw-bold" disabled={Boolean(busy)} type="submit">{busy === "save" ? "جارٍ الحفظ..." : "حفظ المسودة"}</button>
          </div>
        </form>
      ) : (
        <div className="aqua-card p-4">
          <div className="table-responsive">
            <table className="table table-dark align-middle mb-0">
              <thead><tr><th>#</th><th>البيان</th><th className="text-start">الكمية</th><th className="text-start">سعر الوحدة</th><th className="text-start">الإجمالي</th></tr></thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id}><td>{index + 1}</td><td className="fw-bold">{item.description}</td><td className="text-start" dir="ltr">{item.quantity}</td><td className="text-start" dir="ltr">{money(item.unitPrice, invoice.currency)}</td><td className="text-start" dir="ltr">{money(item.lineTotal, invoice.currency)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-4">ملخص المبالغ</h2>
            <div className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-between"><span className="aqua-muted">المجموع الفرعي</span><strong dir="ltr">{money(invoice.subtotal, invoice.currency)}</strong></div>
              <div className="d-flex justify-content-between"><span className="aqua-muted">الخصم</span><strong dir="ltr">{money(invoice.discountAmount, invoice.currency)}</strong></div>
              <div className="d-flex justify-content-between"><span className="aqua-muted">الضريبة</span><strong dir="ltr">{money(invoice.taxAmount, invoice.currency)}</strong></div>
              <hr />
              <div className="d-flex justify-content-between h5"><span>الإجمالي</span><strong dir="ltr">{money(invoice.totalAmount, invoice.currency)}</strong></div>
              <div className="d-flex justify-content-between text-success"><span>المدفوع</span><strong dir="ltr">{money(invoice.amountPaid, invoice.currency)}</strong></div>
              <div className="d-flex justify-content-between text-warning"><span>المتبقي</span><strong dir="ltr">{money(outstanding, invoice.currency)}</strong></div>
            </div>
            <div className="small aqua-muted mt-4">الإصدار: {dateOnly(invoice.issueDate)} — الاستحقاق: {dateOnly(invoice.dueDate)}</div>
          </div>
        </div>

        <div className="col-12 col-lg-7 d-print-none">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-3">التحصيلات</h2>
            {canManage && ["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) && outstanding > 0 ? (
              <form className="aqua-card-soft p-3 mb-4" onSubmit={recordPayment}>
                <div className="row g-2">
                  <div className="col-6 col-lg-3"><label className="form-label small">المبلغ</label><input className="form-control" required type="number" min="0.01" max={outstanding} step="0.01" dir="ltr" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
                  <div className="col-6 col-lg-3"><label className="form-label small">الطريقة</label><select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as keyof typeof methodLabels)}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="col-6 col-lg-3"><label className="form-label small">التاريخ</label><AquaDatePicker value={paymentDate} onChange={setPaymentDate} /></div>
                  <div className="col-6 col-lg-3"><label className="form-label small">المرجع</label><input className="form-control" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} /></div>
                  <div className="col-12"><label className="form-label small">ملاحظات</label><input className="form-control" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></div>
                </div>
                <button className="btn btn-success fw-bold mt-3" disabled={Boolean(busy)} type="submit">{busy === "payment" ? "جارٍ التسجيل..." : "تسجيل الدفعة"}</button>
              </form>
            ) : null}

            {invoice.payments.length === 0 ? (
              <div className="aqua-card-soft p-4 text-center aqua-muted">لا توجد دفعات مسجلة</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {invoice.payments.map((payment) => (
                  <div className="aqua-card-soft p-3" key={payment.id}>
                    <div className="d-flex align-items-start justify-content-between gap-3">
                      <div>
                        <div className={payment.status === "REVERSED" ? "text-decoration-line-through fw-bold" : "fw-bold"} dir="ltr">{money(payment.amount, payment.currency)}</div>
                        <div className="small aqua-muted mt-1">{methodLabels[payment.method]} — {dateOnly(payment.paidAt)} — {payment.recordedBy?.name ?? "مستخدم محذوف"}</div>
                        {payment.reference ? <div className="small aqua-muted" dir="ltr">Ref: {payment.reference}</div> : null}
                        {payment.status === "REVERSED" ? <div className="small text-danger mt-2">معكوسة: {payment.reversalReason}</div> : null}
                      </div>
                      {canManage && payment.status === "POSTED" ? (
                        <button className="btn btn-sm btn-outline-danger" disabled={Boolean(busy)} type="button" onClick={() => reversePayment(payment.id)}>{busy === `reverse-${payment.id}` ? "..." : "عكس"}</button>
                      ) : <span className={`badge ${payment.status === "POSTED" ? "text-bg-success" : "text-bg-danger"}`}>{payment.status === "POSTED" ? "مرحّلة" : "معكوسة"}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {(invoice.notes || invoice.terms) ? (
        <div className="row g-4">
          {invoice.notes ? <div className="col-12 col-lg-6"><div className="aqua-card p-4 h-100"><h2 className="h6 fw-black">ملاحظات</h2><p className="aqua-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</p></div></div> : null}
          {invoice.terms ? <div className="col-12 col-lg-6"><div className="aqua-card p-4 h-100"><h2 className="h6 fw-black">الشروط</h2><p className="aqua-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>{invoice.terms}</p></div></div> : null}
        </div>
      ) : null}

      <AquaConfirmDialog
        open={issueConfirmOpen}
        onClose={() => setIssueConfirmOpen(false)}
        onConfirm={issueInvoice}
        title="إصدار الفاتورة"
        description={
          invoice.contractAmendment
            ? "سيتم تثبيت قرار الضريبة ومرجع الإصدار وقفل فاتورة الملحق."
            : "سيتم قفل بنود الفاتورة ومبالغها بعد الإصدار."
        }
        confirmLabel="إصدار الفاتورة"
        loading={busy === "issue"}
      />
      <AquaConfirmDialog
        open={reminderConfirmOpen}
        onClose={() => setReminderConfirmOpen(false)}
        onConfirm={sendPaymentReminder}
        title="إرسال تذكير دفع"
        description={`سيُرسل تذكير إلى ${invoice.contractAmendment?.invoicePortalDeliveryRecipientEmail ?? "العميل"}. سيتفعّل رابط جديد بعد نجاح البريد فقط، وسيبقى الرابط السابق فعالًا عند الفشل.`}
        confirmLabel="إرسال التذكير"
        loading={busy === "invoice-reminder"}
      />
      <AquaConfirmDialog
        open={portalDeliveryConfirmOpen}
        onClose={() => setPortalDeliveryConfirmOpen(false)}
        onConfirm={deliverPortal}
        title="إرسال بوابة الفاتورة"
        description={`سيُرسل رابط جديد للفاتورة ${invoice.invoiceNumber} إلى ${portalRecipientEmail}. سيصبح الرابط فعالًا ويلغي السابق بعد نجاح الإرسال فقط.`}
        confirmLabel="إرسال الرابط الآمن"
        loading={busy === "portal-delivery"}
      />
      <AquaConfirmDialog
        open={deliveryConfirmOpen}
        onClose={() => setDeliveryConfirmOpen(false)}
        onConfirm={deliverInvoice}
        title="إرسال الفاتورة للعميل"
        description={`ستُرسل الفاتورة ${invoice.invoiceNumber} إلى ${deliveryRecipientEmail}. لا تحتوي الرسالة رابطًا إلى النظام الداخلي.`}
        confirmLabel="إرسال وتوثيق"
        loading={busy === "delivery"}
      />
    </div>
  )
}
