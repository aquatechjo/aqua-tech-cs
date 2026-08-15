import Link from "next/link"
import { InvoiceStatus } from "@/generated/prisma/enums"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { businessDate, minorToMoney } from "@/lib/finance"
import { decimalMinor } from "@/lib/finance-server"
import { isReceivableBucket, RECEIVABLE_BUCKETS, receivableAgeBucket, receivableBucketLabels, receivableBucketWhere, type ReceivableBucket } from "@/lib/receivables-aging"
import { prisma } from "@/lib/prisma"

type DecimalValue = { toString(): string } | null

function amountLabel(rows: Array<{ currency: string; _sum: { totalAmount: DecimalValue; amountPaid: DecimalValue } }>) {
  const amounts = rows.map((row) => ({ currency: row.currency, outstanding: decimalMinor(row._sum.totalAmount) - decimalMinor(row._sum.amountPaid) })).filter((row) => row.outstanding > 0)
  return amounts.length ? amounts.map((row) => `${minorToMoney(row.outstanding)} ${row.currency}`).join(" · ") : "0.00"
}

export default async function ReceivablesAgingPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)
  const requested = (await searchParams).bucket
  const selected: ReceivableBucket | null = isReceivableBucket(requested) ? requested : null
  const asOf = businessDate(new Date(), user.company.timezone)
  const baseWhere = { companyId: user.companyId, status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] } }
  const summaries = await Promise.all(RECEIVABLE_BUCKETS.map(async (bucket) => {
    const rows = await prisma.invoice.groupBy({ by: ["currency"], where: { ...baseWhere, ...receivableBucketWhere(bucket, asOf) }, _sum: { totalAmount: true, amountPaid: true }, _count: { _all: true } })
    return { bucket, count: rows.reduce((sum, row) => sum + row._count._all, 0), amount: amountLabel(rows) }
  }))
  const invoices = await prisma.invoice.findMany({ where: { ...baseWhere, ...(selected ? receivableBucketWhere(selected, asOf) : {}) }, orderBy: [{ dueDate: "asc" }, { invoiceNumber: "asc" }], take: 100, include: { client: { select: { name: true } }, project: { select: { name: true } }, collectionOwner: { select: { name: true } }, contractAmendment: { select: { invoiceReminderScheduleEnabled: true, invoiceReminderNextAt: true, invoiceReminderCount: true } } } })

  return <div className="aqua-finance-page"><AquaPageHeader badge="Receivables Aging" title="أعمار الذمم والتحصيل" description="رصيد الفواتير المفتوحة موزع حسب تاريخ الاستحقاق وبشكل مستقل لكل عملة." brandValue="Collections"/><div className="aqua-finance-actions"><Link className="btn btn-outline-info" href="/dashboard/finance">ملخص المالية</Link><Link className="btn btn-outline-info" href="/dashboard/finance/invoices">الفواتير</Link></div><div className="row g-3 aqua-finance-metrics">{summaries.map((summary) => <div className="col-12 col-md-6 col-xl-4" key={summary.bucket}><Link className="text-decoration-none" href={`/dashboard/finance/receivables?bucket=${summary.bucket}`}><div className={`aqua-card p-4 h-100 aqua-finance-metric ${selected === summary.bucket ? "border border-info" : ""}`}><div className="small aqua-muted">{receivableBucketLabels[summary.bucket]}</div><div className="h5 fw-black mt-3 mb-0" dir="ltr">{summary.amount}</div><div className="small aqua-soft mt-3">{summary.count} فاتورة</div></div></Link></div>)}</div><div className="aqua-card p-4 aqua-finance-register"><div className="d-flex flex-wrap justify-content-between gap-3 mb-3"><div><h2 className="h5 fw-black mb-1">{selected ? receivableBucketLabels[selected] : "كل الذمم المفتوحة"}</h2><div className="small aqua-muted">حتى 100 فاتورة مرتبة حسب أقدم استحقاق — تاريخ التقرير <bdi dir="ltr">{asOf.toISOString().slice(0, 10)}</bdi></div></div>{selected ? <Link className="btn btn-sm btn-outline-secondary" href="/dashboard/finance/receivables">مسح الفلتر</Link> : null}</div>{invoices.length ? <div className="table-responsive"><table className="table table-dark table-hover align-middle mb-0"><thead><tr><th>الفاتورة</th><th>العميل / المشروع</th><th>الاستحقاق</th><th>الشريحة</th><th className="text-start">الرصيد</th><th>المتابعة</th><th>التذكير</th></tr></thead><tbody>{invoices.map((invoice) => { const bucket = receivableAgeBucket(invoice.dueDate, asOf); const outstanding = Math.max(0, decimalMinor(invoice.totalAmount)-decimalMinor(invoice.amountPaid)); return <tr key={invoice.id}><td><Link className="fw-bold text-info text-decoration-none" href={`/dashboard/finance/invoices/${invoice.id}`} dir="ltr">{invoice.invoiceNumber}</Link></td><td><div className="fw-bold">{invoice.client?.name ?? "بدون عميل"}</div><div className="small aqua-muted">{invoice.project?.name ?? "غير مرتبط"}</div></td><td dir="ltr">{invoice.dueDate?.toISOString().slice(0,10) ?? "—"}</td><td>{receivableBucketLabels[bucket]}</td><td className="text-start" dir="ltr">{minorToMoney(outstanding)} {invoice.currency}</td><td><div>{invoice.collectionOwner?.name ?? "غير مسندة"}</div><div className="small aqua-muted">{invoice.collectionStatus} · {invoice.collectionNextActionAt?.toISOString().slice(0,10) ?? "دون إجراء"}</div></td><td>{invoice.contractAmendment?.invoiceReminderScheduleEnabled ? <span className="badge text-bg-info">مجدول · {invoice.contractAmendment.invoiceReminderCount}/3</span> : <span className="badge text-bg-secondary">يدوي</span>}</td></tr> })}</tbody></table></div> : <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد ذمم ضمن هذا النطاق</div>}</div></div>
}
