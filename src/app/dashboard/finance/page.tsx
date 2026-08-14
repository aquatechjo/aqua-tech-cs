import Link from "next/link"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { businessDate, displayInvoiceStatus, minorToMoney } from "@/lib/finance"
import { decimalMinor } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

const statusLabels = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
} as const

function money(value: string, currency = "JOD") {
  return `${Number(value).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function badgeClass(status: keyof typeof statusLabels) {
  if (status === "PAID") return "text-bg-success"
  if (status === "OVERDUE" || status === "CANCELLED") return "text-bg-danger"
  if (status === "PARTIALLY_PAID") return "text-bg-warning"
  if (status === "ISSUED") return "text-bg-info"
  return "text-bg-secondary"
}

export default async function FinanceDashboardPage() {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)

  const now = new Date()
  const overdueBefore = businessDate(now, user.company.timezone)
  const [invoiceTotals, paymentTotals, expenses, paidExpenses, overdueCount, invoices, projects] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: {
          companyId: user.companyId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.aggregate({
        where: { companyId: user.companyId, status: "POSTED" },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          companyId: user.companyId,
          status: { in: ["APPROVED", "PAID"] },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { companyId: user.companyId, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          companyId: user.companyId,
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          dueDate: { lt: overdueBefore },
        },
      }),
      prisma.invoice.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          client: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.project.findMany({
        where: {
          companyId: user.companyId,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          code: true,
          budget: true,
          currency: true,
          invoices: {
            where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
            select: { totalAmount: true, amountPaid: true },
          },
          expenses: {
            where: { status: { in: ["APPROVED", "PAID"] } },
            select: { amount: true, status: true },
          },
        },
      }),
    ])

  const invoicedMinor = decimalMinor(invoiceTotals._sum.totalAmount)
  const collectedMinor = decimalMinor(paymentTotals._sum.amount)
  const expenseMinor = decimalMinor(expenses._sum.amount)
  const paidExpenseMinor = decimalMinor(paidExpenses._sum.amount)

  const cards = [
    { label: "إجمالي الفواتير", value: minorToMoney(invoicedMinor), hint: "Issued revenue" },
    { label: "المبالغ المحصلة", value: minorToMoney(collectedMinor), hint: "Cash collected" },
    {
      label: "الرصيد المستحق",
      value: minorToMoney(Math.max(0, invoicedMinor - collectedMinor)),
      hint: `${overdueCount} فواتير متأخرة`,
    },
    { label: "المصروفات المعتمدة", value: minorToMoney(expenseMinor), hint: "Approved costs" },
    {
      label: "الهامش النقدي",
      value: minorToMoney(collectedMinor - paidExpenseMinor),
      hint: "Collected minus paid costs",
    },
    {
      label: "الهامش المتوقع",
      value: minorToMoney(invoicedMinor - expenseMinor),
      hint: "Invoiced minus approved costs",
    },
  ]

  return (
    <div className="aqua-finance-page">
      <AquaPageHeader
        badge="Operational Finance"
        title="المالية التشغيلية"
        description="متابعة الفواتير والتحصيل والمصروفات وهامش المشاريع داخل Aqua tech CS. هذه لوحة تشغيلية وليست دفتر محاسبة قانونيًا."
        brandValue="Finance"
      />

      <div className="aqua-finance-actions">
        <Link className="btn btn-info fw-bold" href="/dashboard/finance/invoices">
          إدارة الفواتير
        </Link>
        <Link className="btn btn-outline-info fw-bold" href="/dashboard/finance/expenses">
          إدارة المصروفات
        </Link>
      </div>

      <div className="row g-3 aqua-finance-metrics">
        {cards.map((card) => (
          <div className="col-12 col-md-6 col-xl-4" key={card.label}>
            <div className="aqua-card p-4 h-100 aqua-finance-metric">
              <div className="small aqua-muted">{card.label}</div>
              <div className="h3 fw-black aqua-text-gradient mt-3 mb-0" dir="ltr">
                {money(card.value, user.company.currency)}
              </div>
              <div className="small aqua-soft mt-3">{card.hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4 aqua-finance-overview-grid">
        <div className="col-12 col-xl-7">
          <div className="aqua-card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-4">
              <div>
                <h2 className="h5 fw-black mb-1">أحدث الفواتير</h2>
                <div className="small aqua-muted">آخر المستندات المالية المسجلة</div>
              </div>
              <Link href="/dashboard/finance/invoices" className="btn btn-sm btn-outline-info">
                عرض الكل
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد فواتير بعد</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>العميل / المشروع</th>
                      <th>الحالة</th>
                      <th className="text-start">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const displayStatus = displayInvoiceStatus({
                        status: invoice.status,
                        dueDate: invoice.dueDate,
                        totalMinor: decimalMinor(invoice.totalAmount),
                        amountPaidMinor: decimalMinor(invoice.amountPaid),
                        now,
                        timeZone: user.company.timezone,
                      })

                      return (
                        <tr key={invoice.id}>
                          <td>
                            <Link
                              className="fw-bold text-info text-decoration-none"
                              href={`/dashboard/finance/invoices/${invoice.id}`}
                              dir="ltr"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td>
                            <div className="fw-bold">{invoice.client?.name ?? "بدون عميل"}</div>
                            <div className="small aqua-muted">{invoice.project?.name ?? "غير مرتبط بمشروع"}</div>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass(displayStatus)}`}>
                              {statusLabels[displayStatus]}
                            </span>
                          </td>
                          <td className="text-start" dir="ltr">
                            {money(invoice.totalAmount.toString(), invoice.currency)}
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

        <div className="col-12 col-xl-5">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-1">ربحية المشاريع</h2>
            <div className="small aqua-muted mb-4">الإيراد المفوتر ناقص المصروف المعتمد</div>

            <div className="d-flex flex-column gap-3">
              {projects.length === 0 ? (
                <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد مشاريع نشطة</div>
              ) : (
                projects.map((project) => {
                  const invoiced = project.invoices.reduce(
                    (sum, invoice) => sum + decimalMinor(invoice.totalAmount),
                    0,
                  )
                  const expensesTotal = project.expenses.reduce(
                    (sum, expense) => sum + decimalMinor(expense.amount),
                    0,
                  )
                  const paidExpensesTotal = project.expenses.reduce(
                    (sum, expense) =>
                      expense.status === "PAID"
                        ? sum + decimalMinor(expense.amount)
                        : sum,
                    0,
                  )
                  const margin = invoiced - expensesTotal
                  const cashMargin =
                    project.invoices.reduce(
                      (sum, invoice) => sum + decimalMinor(invoice.amountPaid),
                      0,
                    ) - paidExpensesTotal

                  return (
                    <div className="aqua-card-soft p-3" key={project.id}>
                      <div className="d-flex align-items-start justify-content-between gap-3">
                        <div>
                          <Link
                            href={`/dashboard/projects/${project.id}`}
                            className="fw-bold text-decoration-none text-info"
                          >
                            {project.name}
                          </Link>
                          <div className="small aqua-muted" dir="ltr">
                            {project.code ?? "No code"}
                          </div>
                        </div>
                        <div className="text-start">
                          <div
                            className={
                              margin < 0 ? "text-danger fw-bold" : "text-success fw-bold"
                            }
                            dir="ltr"
                          >
                            {money(minorToMoney(margin), project.currency)}
                          </div>
                          <div className="small aqua-muted" dir="ltr">
                            Cash {money(minorToMoney(cashMargin), project.currency)}
                          </div>
                        </div>
                      </div>
                      <div className="row g-2 mt-2 small">
                        <div className="col-6 aqua-muted">مفوتر: {money(minorToMoney(invoiced), project.currency)}</div>
                        <div className="col-6 aqua-muted">مصروف: {money(minorToMoney(expensesTotal), project.currency)}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
