"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import AquaDatePicker from "@/components/aqua/AquaDatePicker"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type Expense = {
  id: string
  expenseNumber: string
  projectId: string | null
  project: { id: string; name: string; code: string | null } | null
  createdById: string | null
  createdBy: { id: string; name: string } | null
  approvedBy: { id: string; name: string } | null
  vendorName: string | null
  category: string
  description: string
  amount: string
  currency: string
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED"
  incurredAt: string
  submittedAt: string | null
  approvedAt: string | null
  paidAt: string | null
  reference: string | null
  receiptUrl: string | null
  notes: string | null
}

type ProjectOption = { id: string; name: string; code: string | null; currency: string }

const statusLabels = {
  DRAFT: "مسودة",
  SUBMITTED: "بانتظار الاعتماد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
} as const

function statusClass(status: Expense["status"]) {
  if (status === "PAID") return "text-bg-success"
  if (status === "APPROVED") return "text-bg-info"
  if (status === "SUBMITTED") return "text-bg-warning"
  if (status === "REJECTED" || status === "CANCELLED") return "text-bg-danger"
  return "text-bg-secondary"
}

function money(value: string | number, currency: string) {
  return `${Number(value).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "—"
}

export default function ExpensesClient({
  expenses,
  projects,
  currentUserId,
  canApprove,
  defaultCurrency,
  defaultDate,
}: {
  expenses: Expense[]
  projects: ProjectOption[]
  currentUserId: string
  canApprove: boolean
  defaultCurrency: string
  defaultDate: string
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const [projectId, setProjectId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState(defaultCurrency)
  const [incurredAt, setIncurredAt] = useState(defaultDate)
  const [reference, setReference] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [submitImmediately, setSubmitImmediately] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return expenses.filter((expense) => {
      const matchesStatus = statusFilter === "ALL" || expense.status === statusFilter
      const matchesQuery =
        !needle ||
        expense.expenseNumber.toLowerCase().includes(needle) ||
        expense.description.toLowerCase().includes(needle) ||
        expense.category.toLowerCase().includes(needle) ||
        expense.vendorName?.toLowerCase().includes(needle) ||
        expense.project?.name.toLowerCase().includes(needle)
      return matchesStatus && matchesQuery
    })
  }, [expenses, q, statusFilter])

  function resetForm() {
    setProjectId("")
    setVendorName("")
    setCategory("")
    setDescription("")
    setAmount("")
    setCurrency(defaultCurrency)
    setIncurredAt(defaultDate)
    setReference("")
    setReceiptUrl("")
    setNotes("")
    setSubmitImmediately(false)
  }

  function selectProject(value: string) {
    setProjectId(value)
  }

  async function createExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("create")
    setError("")
    setSuccess("")
    try {
      const response = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || null,
          vendorName,
          category,
          description,
          amount,
          currency,
          incurredAt,
          reference,
          receiptUrl: receiptUrl || null,
          notes,
          submitImmediately,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر إنشاء المصروف")
        return
      }
      resetForm()
      setShowForm(false)
      setSuccess("تم إنشاء المصروف")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  async function action(expense: Expense, name: "SUBMIT" | "APPROVE" | "REJECT" | "MARK_PAID" | "CANCEL" | "REOPEN") {
    let reason: string | undefined
    if (name === "REJECT" || name === "CANCEL") {
      reason = window.prompt(name === "REJECT" ? "اكتب سبب الرفض" : "اكتب سبب الإلغاء") || undefined
      if (!reason) return
    }
    if (!window.confirm(`تأكيد الإجراء: ${name}`)) return

    setBusy(`${name}-${expense.id}`)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/finance/expenses/${expense.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: name,
          reason,
          paidAt: name === "MARK_PAID" ? new Date().toISOString() : undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        setError(payload.message || "تعذر تحديث المصروف")
        return
      }
      setSuccess("تم تحديث حالة المصروف")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="aqua-expenses-page">
      <AquaPageHeader
        badge="Expenses"
        title="المصروفات التشغيلية"
        description="سجل تكلفة المشروع، أرسلها للاعتماد، ثم اعتمدها وسجل دفعها دون حذف الأثر المالي."
        brandValue="Costs"
      />

      <div className="aqua-finance-actions aqua-finance-actions--split">
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-info" href="/dashboard/finance">ملخص المالية</Link>
          <Link className="btn btn-outline-info" href="/dashboard/finance/invoices">الفواتير</Link>
        </div>
        <button className="btn btn-info fw-bold" type="button" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "إغلاق النموذج" : "مصروف جديد"}
        </button>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      {showForm ? (
        <form className="aqua-card p-4 aqua-finance-editor" onSubmit={createExpense}>
          <h2 className="h5 fw-black mb-4">تسجيل مصروف</h2>
          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label">المشروع</label>
              <select className="form-select" value={projectId} onChange={(e) => selectProject(e.target.value)}>
                <option value="">مصروف عام</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}{project.code ? ` — ${project.code}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3"><label className="form-label">المورد</label><input className="form-control" value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></div>
            <div className="col-12 col-md-6 col-xl-3"><label className="form-label">التصنيف</label><input className="form-control" required placeholder="استضافة، إعلانات، أدوات..." value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className="col-12 col-md-6 col-xl-3"><label className="form-label">التاريخ</label><AquaDatePicker value={incurredAt} onChange={setIncurredAt} /></div>
            <div className="col-12 col-lg-6"><label className="form-label">الوصف</label><input className="form-control" required value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="col-6 col-lg-2"><label className="form-label">المبلغ</label><input className="form-control" required type="number" min="0.01" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="col-6 col-lg-2"><label className="form-label">العملة</label><input className="form-control" required dir="ltr" value={currency} readOnly /></div>
            <div className="col-12 col-lg-2"><label className="form-label">المرجع</label><input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="col-12 col-lg-6"><label className="form-label">رابط الإيصال</label><input className="form-control" type="url" dir="ltr" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} /></div>
            <div className="col-12 col-lg-6"><label className="form-label">ملاحظات</label><input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <div className="form-check mt-3">
            <input className="form-check-input" id="submitExpense" type="checkbox" checked={submitImmediately} onChange={(e) => setSubmitImmediately(e.target.checked)} />
            <label className="form-check-label" htmlFor="submitExpense">إرساله للاعتماد مباشرة</label>
          </div>
          <button className="btn btn-info fw-bold mt-4" disabled={Boolean(busy)} type="submit">{busy === "create" ? "جارٍ الحفظ..." : submitImmediately ? "إنشاء وإرسال" : "حفظ المسودة"}</button>
        </form>
      ) : null}

      <div className="aqua-card p-4 aqua-finance-register">
        <div className="row g-2 mb-4">
          <div className="col-12 col-lg-8"><input className="form-control" placeholder="بحث بالرقم أو المشروع أو المورد أو الوصف" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="col-12 col-lg-4"><select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>

        {filtered.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد مصروفات مطابقة</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead><tr><th>المصروف</th><th>المشروع / التصنيف</th><th>الوصف</th><th>الحالة</th><th className="text-start">المبلغ</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {filtered.map((expense) => {
                  const canOwn = expense.createdById === currentUserId || canApprove
                  return (
                    <tr key={expense.id}>
                      <td><div className="fw-bold text-info" dir="ltr">{expense.expenseNumber}</div><div className="small aqua-muted">{dateOnly(expense.incurredAt)}</div></td>
                      <td><div className="fw-bold">{expense.project?.name ?? "مصروف عام"}</div><div className="small aqua-muted">{expense.category}</div></td>
                      <td><div>{expense.description}</div><div className="small aqua-muted">{expense.vendorName ?? expense.createdBy?.name ?? "—"}</div>{expense.receiptUrl ? <a className="small text-info" href={expense.receiptUrl} target="_blank" rel="noreferrer">عرض الإيصال</a> : null}</td>
                      <td><span className={`badge ${statusClass(expense.status)}`}>{statusLabels[expense.status]}</span>{expense.approvedBy ? <div className="small aqua-muted mt-1">بواسطة {expense.approvedBy.name}</div> : null}</td>
                      <td className="text-start fw-bold" dir="ltr">{money(expense.amount, expense.currency)}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {expense.status === "DRAFT" && canOwn ? <button className="btn btn-sm btn-outline-info" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "SUBMIT")}>إرسال</button> : null}
                          {expense.status === "SUBMITTED" && canApprove ? <><button className="btn btn-sm btn-success" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "APPROVE")}>اعتماد</button><button className="btn btn-sm btn-outline-danger" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "REJECT")}>رفض</button></> : null}
                          {expense.status === "APPROVED" && canApprove ? <button className="btn btn-sm btn-success" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "MARK_PAID")}>تسجيل الدفع</button> : null}
                          {expense.status === "REJECTED" && canOwn ? <button className="btn btn-sm btn-outline-info" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "REOPEN")}>إعادة للمسودة</button> : null}
                          {(canApprove
                            ? ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(expense.status)
                            : ["DRAFT", "REJECTED"].includes(expense.status)) && canOwn ? <button className="btn btn-sm btn-outline-secondary" disabled={Boolean(busy)} type="button" onClick={() => action(expense, "CANCEL")}>إلغاء</button> : null}
                        </div>
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
