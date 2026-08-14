import type { Metadata } from "next"
import AquaSystemDocument from "@/components/aqua/AquaSystemDocument"
import { findPublicAmendmentInvoice } from "@/lib/project-amendment-invoice-portal-server"
import PublicInvoiceActions from "./PublicInvoiceActions"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "فاتورة Aqua.Tech", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" }

function money(value: { toString(): string }, currency: string) { return `${Number(value.toString()).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` }
function day(value: Date | null) { return value?.toISOString().slice(0, 10) ?? "—" }

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const amendment = await findPublicAmendmentInvoice(token)
  if (!amendment?.invoice) return <main className="aqua-proposal-public" dir="rtl"><section className="aqua-proposal-public__invalid"><div className="aqua-proposal-public__invalid-card"><span className="aqua-proposal-public__status-mark">404</span><h1>رابط الفاتورة غير متاح</h1><p>قد يكون الرابط منتهيًا أو ملغيًا أو تم استبداله برابط أحدث.</p></div></section></main>
  const invoice = amendment.invoice
  const outstanding = Math.max(0, Number(invoice.totalAmount.toString()) - Number(invoice.amountPaid.toString()))
  return <main className="py-3 aqua-client-invoice" dir="rtl" data-public-amendment-invoice>
    <div className="d-flex justify-content-center p-3"><PublicInvoiceActions /></div>
    <AquaSystemDocument title="فاتورة ملحق عقد" documentLabel="Amendment Invoice" reference={invoice.invoiceNumber} issuedAt={day(invoice.issueDate)} density="compact" footerNote={`صادرة عن ${amendment.company.name} — لا تُعد إيصال دفع`}>
      <div className="row g-3 mb-4"><div className="col-6"><div className="small text-secondary">العميل</div><strong>{invoice.client?.name ?? "—"}</strong></div><div className="col-6 text-start"><div className="small text-secondary">المشروع</div><strong>{amendment.project.name}</strong><div className="small" dir="ltr">{amendment.project.code ?? "—"}</div></div></div>
      <div className="row g-3 mb-4"><div className="col-3"><span className="small text-secondary d-block">الملحق</span><strong dir="ltr">{amendment.amendmentNumber}</strong></div><div className="col-3"><span className="small text-secondary d-block">مرجع الإصدار</span><strong>{amendment.invoiceIssueReference}</strong></div><div className="col-3"><span className="small text-secondary d-block">تاريخ الإصدار</span><strong dir="ltr">{day(invoice.issueDate)}</strong></div><div className="col-3"><span className="small text-secondary d-block">الاستحقاق</span><strong dir="ltr">{day(invoice.dueDate)}</strong></div></div>
      <table className="table align-middle border"><thead><tr><th>#</th><th>البيان</th><th className="text-start">الكمية</th><th className="text-start">سعر الوحدة</th><th className="text-start">الإجمالي</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.description}</td><td className="text-start" dir="ltr">{item.quantity.toString()}</td><td className="text-start" dir="ltr">{money(item.unitPrice, invoice.currency)}</td><td className="text-start" dir="ltr">{money(item.lineTotal, invoice.currency)}</td></tr>)}</tbody></table>
      <div className="row justify-content-end mt-4"><div className="col-12 col-md-6"><div className="d-flex justify-content-between"><span>المجموع الفرعي</span><strong dir="ltr">{money(invoice.subtotal, invoice.currency)}</strong></div><div className="d-flex justify-content-between"><span>الضريبة</span><strong dir="ltr">{money(invoice.taxAmount, invoice.currency)}</strong></div><hr/><div className="d-flex justify-content-between h5"><span>الإجمالي</span><strong dir="ltr">{money(invoice.totalAmount, invoice.currency)}</strong></div><div className="d-flex justify-content-between"><span>المدفوع</span><strong dir="ltr">{money(invoice.amountPaid, invoice.currency)}</strong></div><div className="d-flex justify-content-between"><span>المتبقي</span><strong dir="ltr">{outstanding.toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.currency}</strong></div></div></div>
      {invoice.notes ? <section className="mt-4"><h2 className="h6">ملاحظات</h2><p style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</p></section> : null}
      {invoice.terms ? <section className="mt-3"><h2 className="h6">الشروط</h2><p style={{ whiteSpace: "pre-wrap" }}>{invoice.terms}</p></section> : null}
      <p className="small text-secondary mt-4">للاستفسار: <span dir="ltr">{amendment.company.email ?? "info.aquatech.jo@gmail.com"}</span></p>
    </AquaSystemDocument>
  </main>
}
