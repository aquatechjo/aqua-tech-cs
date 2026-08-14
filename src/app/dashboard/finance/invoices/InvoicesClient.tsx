"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AquaDatePicker from "@/components/aqua/AquaDatePicker"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type InvoiceRow = {
  id: string
  invoiceNumber: string
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED"
  displayStatus:
    | "DRAFT"
    | "ISSUED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED"
  currency: string
  issueDate: string | null
  dueDate: string | null
  totalAmount: string
  amountPaid: string
  client: { id: string; name: string } | null
  project: { id: string; name: string; code: string | null } | null
}

type Option = { id: string; name: string }
type ProjectOption = Option & { clientId: string | null; code: string | null; currency: string }
type Line = { description: string; quantity: string; unitPrice: string }

const statusLabels = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
} as const

function statusClass(status: InvoiceRow["displayStatus"]) {
  if (status === "PAID") return "text-bg-success"
  if (status === "OVERDUE" || status === "CANCELLED") return "text-bg-danger"
  if (status === "PARTIALLY_PAID") return "text-bg-warning"
  if (status === "ISSUED") return "text-bg-info"
  return "text-bg-secondary"
}

function money(value: string | number, currency: string) {
  return `${Number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "—"
}

export default function InvoicesClient({
  invoices,
  clients,
  projects,
  canManage,
  defaultCurrency,
}: {
  invoices: InvoiceRow[]
  clients: Option[]
  projects: ProjectOption[]
  canManage: boolean
  defaultCurrency: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const [clientId, setClientId] = useState("")
  const [projectId, setProjectId] = useState("")
  const [currency, setCurrency] = useState(defaultCurrency)
  const [issueDate, setIssueDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [discountAmount, setDiscountAmount] = useState("0")
  const [taxAmount, setTaxAmount] = useState("0")
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")
  const [issueImmediately, setIssueImmediately] = useState(false)
  const [items, setItems] = useState<Line[]>([
    { description: "", quantity: "1", unitPrice: "0" },
  ])

  const filteredInvoices = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "ALL" || invoice.displayStatus === statusFilter
      const matchesQuery =
        !needle ||
        invoice.invoiceNumber.toLowerCase().includes(needle) ||
        invoice.client?.name.toLowerCase().includes(needle) ||
        invoice.project?.name.toLowerCase().includes(needle)
      return matchesStatus && matchesQuery
    })
  }, [invoices, q, statusFilter])

  const preview = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0,
    )
    const total = subtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0)
    return { subtotal, total }
  }, [discountAmount, items, taxAmount])

  function resetForm() {
    setClientId("")
    setProjectId("")
    setCurrency(defaultCurrency)
    setIssueDate("")
    setDueDate("")
    setDiscountAmount("0")
    setTaxAmount("0")
    setNotes("")
    setTerms("")
    setIssueImmediately(false)
    setItems([{ description: "", quantity: "1", unitPrice: "0" }])
    setError("")
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  async function createInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")

    try {
      const response = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId || null,
          projectId: projectId || null,
          currency,
          issueDate: issueDate || null,
          dueDate: dueDate || null,
          discountAmount,
          taxAmount,
          notes,
          terms,
          issueImmediately,
          items,
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر إنشاء الفاتورة")
        return
      }

      resetForm()
      setShowForm(false)
      router.push(`/dashboard/finance/invoices/${payload.data.invoice.id}`)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy(false)
    }
  }

  function selectProject(value: string) {
    setProjectId(value)
    const project = projects.find((item) => item.id === value)
    if (project?.clientId) setClientId(project.clientId)
  }

  return (
    <div className="aqua-invoices-page">
      <AquaPageHeader
        badge="Invoices"
        title="الفواتير والتحصيل"
        description="أنشئ المسودة، راجع البنود، ثم أصدر الفاتورة وسجّل الدفعات من صفحة المستند."
        brandValue="Billing"
      />

      <div className="aqua-finance-actions aqua-finance-actions--split">
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-info" href="/dashboard/finance">
            ملخص المالية
          </Link>
          <Link className="btn btn-outline-info" href="/dashboard/finance/expenses">
            المصروفات
          </Link>
        </div>
        {canManage ? (
          <button
            className="btn btn-info fw-bold"
            type="button"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? "إغلاق النموذج" : "فاتورة جديدة"}
          </button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <form className="aqua-card p-4 aqua-finance-editor" onSubmit={createInvoice}>
          <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
            <div>
              <h2 className="h5 fw-black mb-1">إنشاء فاتورة</h2>
              <div className="small aqua-muted">المبالغ النهائية يحتسبها الخادم بدقة</div>
            </div>
            <span className="aqua-badge">Draft</span>
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">العميل</label>
              <select className="form-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">بدون عميل</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">المشروع</label>
              <select className="form-select" value={projectId} onChange={(e) => selectProject(e.target.value)}>
                <option value="">بدون مشروع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.code ? ` — ${project.code}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-xl-2">
              <label className="form-label">العملة</label>
              <input className="form-control" value={currency} dir="ltr" readOnly />
            </div>
            <div className="col-6 col-xl-2">
              <label className="form-label">تاريخ الإصدار</label>
              <AquaDatePicker value={issueDate} onChange={setIssueDate} />
            </div>
            <div className="col-12 col-xl-2">
              <label className="form-label">تاريخ الاستحقاق</label>
              <AquaDatePicker value={dueDate} onChange={setDueDate} />
            </div>
          </div>

          <div className="mt-4">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
              <label className="form-label fw-bold mb-0">بنود الفاتورة</label>
              <button
                className="btn btn-sm btn-outline-info"
                type="button"
                onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unitPrice: "0" }])}
              >
                إضافة بند
              </button>
            </div>

            <div className="d-flex flex-column gap-2">
              {items.map((item, index) => (
                <div className="row g-2 align-items-end aqua-card-soft p-2" key={index}>
                  <div className="col-12 col-lg-6">
                    <label className="form-label small">الوصف</label>
                    <input className="form-control" required value={item.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                  </div>
                  <div className="col-4 col-lg-2">
                    <label className="form-label small">الكمية</label>
                    <input className="form-control" required min="0.01" step="0.01" type="number" dir="ltr" value={item.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                  </div>
                  <div className="col-5 col-lg-2">
                    <label className="form-label small">سعر الوحدة</label>
                    <input className="form-control" required min="0" step="0.01" type="number" dir="ltr" value={item.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} />
                  </div>
                  <div className="col-3 col-lg-2 d-grid">
                    <button
                      className="btn btn-outline-danger"
                      type="button"
                      disabled={items.length === 1}
                      onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="row g-3 mt-2">
            <div className="col-6 col-lg-3">
              <label className="form-label">الخصم</label>
              <input className="form-control" min="0" step="0.01" type="number" dir="ltr" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            </div>
            <div className="col-6 col-lg-3">
              <label className="form-label">الضريبة</label>
              <input className="form-control" min="0" step="0.01" type="number" dir="ltr" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">المجموع الفرعي</label>
              <div className="form-control bg-dark-subtle" dir="ltr">{money(preview.subtotal, currency)}</div>
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label">الإجمالي المتوقع</label>
              <div className="form-control bg-dark-subtle fw-bold" dir="ltr">{money(preview.total, currency)}</div>
            </div>
            <div className="col-12 col-lg-6">
              <label className="form-label">ملاحظات</label>
              <textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="col-12 col-lg-6">
              <label className="form-label">الشروط</label>
              <textarea className="form-control" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
          </div>

          <div className="form-check mt-3">
            <input className="form-check-input" id="issueImmediately" type="checkbox" checked={issueImmediately} onChange={(e) => setIssueImmediately(e.target.checked)} />
            <label className="form-check-label" htmlFor="issueImmediately">إصدار الفاتورة مباشرة بدل حفظها كمسودة</label>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-info fw-bold" disabled={busy} type="submit">
              {busy ? "جارٍ الحفظ..." : issueImmediately ? "إنشاء وإصدار" : "حفظ المسودة"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>تفريغ</button>
          </div>
        </form>
      ) : null}

      <div className="aqua-card p-4 aqua-finance-register">
        <div className="row g-2 mb-4">
          <div className="col-12 col-lg-8">
            <input className="form-control" placeholder="بحث برقم الفاتورة أو العميل أو المشروع" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="col-12 col-lg-4">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">كل الحالات</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد فواتير مطابقة</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>العميل / المشروع</th>
                  <th>الحالة</th>
                  <th>الإصدار / الاستحقاق</th>
                  <th className="text-start">الإجمالي</th>
                  <th className="text-start">المتبقي</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid))
                  return (
                    <tr key={invoice.id}>
                      <td className="fw-bold text-info" dir="ltr">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="fw-bold">{invoice.client?.name ?? "بدون عميل"}</div>
                        <div className="small aqua-muted">{invoice.project?.name ?? "غير مرتبط بمشروع"}</div>
                      </td>
                      <td><span className={`badge ${statusClass(invoice.displayStatus)}`}>{statusLabels[invoice.displayStatus]}</span></td>
                      <td>
                        <div>{dateOnly(invoice.issueDate)}</div>
                        <div className="small aqua-muted">{dateOnly(invoice.dueDate)}</div>
                      </td>
                      <td className="text-start" dir="ltr">{money(invoice.totalAmount, invoice.currency)}</td>
                      <td className="text-start fw-bold" dir="ltr">{money(outstanding, invoice.currency)}</td>
                      <td className="text-start">
                        <Link className="btn btn-sm btn-outline-info" href={`/dashboard/finance/invoices/${invoice.id}`}>عرض</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
