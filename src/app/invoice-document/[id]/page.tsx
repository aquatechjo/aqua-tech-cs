import type { Metadata } from "next"
import { notFound } from "next/navigation"
import AquaSystemDocument from "@/components/aqua/AquaSystemDocument"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { amendmentInvoiceDocumentIssues } from "@/lib/project-amendment-invoice-document"
import { prisma } from "@/lib/prisma"
import InvoiceDocumentActions from "./InvoiceDocumentActions"

export const metadata: Metadata = {
  title: "Amendment Invoice Document",
  robots: { index: false, follow: false },
}

function money(value: { toString(): string }, currency: string) {
  return `${Number(value.toString()).toLocaleString("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function dateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "—"
}

export default async function AmendmentInvoiceDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)
  const { id } = await params
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      project: { select: { name: true, code: true } },
      contractAmendment: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!invoice?.contractAmendment || !invoice.client || !invoice.project) {
    notFound()
  }

  const issues = amendmentInvoiceDocumentIssues({
    status: invoice.status,
    invoiceIssuedAt: invoice.contractAmendment.invoiceIssuedAt,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    issueReference: invoice.contractAmendment.invoiceIssueReference,
    taxDecision: invoice.contractAmendment.invoiceTaxDecision,
  })
  if (issues.length) notFound()

  const outstanding = Math.max(
    0,
    Number(invoice.totalAmount.toString()) - Number(invoice.amountPaid.toString()),
  )

  return (
    <main className="py-3 aqua-invoice-document" data-amendment-invoice-document>
      <InvoiceDocumentActions invoiceId={invoice.id} />
      <AquaSystemDocument
        title="فاتورة ملحق عقد"
        documentLabel="Amendment Invoice"
        reference={invoice.invoiceNumber}
        issuedAt={dateOnly(invoice.issueDate)}
        density="compact"
        footerNote="مستند مالي صادر من Aqua.Tech — لا يُعد إيصال دفع"
      >
        <div className="row g-3 mb-4">
          <div className="col-6">
            <div className="small text-secondary">العميل</div>
            <strong>{invoice.client.name}</strong>
            <div className="small" dir="ltr">{invoice.client.email ?? invoice.client.phone ?? "—"}</div>
          </div>
          <div className="col-6 text-start">
            <div className="small text-secondary">المشروع</div>
            <strong>{invoice.project.name}</strong>
            <div className="small" dir="ltr">{invoice.project.code ?? "—"}</div>
          </div>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-3"><span className="small text-secondary d-block">الملحق</span><strong dir="ltr">{invoice.contractAmendment.amendmentNumber}</strong></div>
          <div className="col-3"><span className="small text-secondary d-block">مرجع الإصدار</span><strong>{invoice.contractAmendment.invoiceIssueReference}</strong></div>
          <div className="col-3"><span className="small text-secondary d-block">تاريخ الإصدار</span><strong dir="ltr">{dateOnly(invoice.issueDate)}</strong></div>
          <div className="col-3"><span className="small text-secondary d-block">تاريخ الاستحقاق</span><strong dir="ltr">{dateOnly(invoice.dueDate)}</strong></div>
        </div>

        <table className="table align-middle border">
          <thead><tr><th>#</th><th>البيان</th><th className="text-start">الكمية</th><th className="text-start">سعر الوحدة</th><th className="text-start">الإجمالي</th></tr></thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td><td>{item.description}</td>
                <td className="text-start" dir="ltr">{item.quantity.toString()}</td>
                <td className="text-start" dir="ltr">{money(item.unitPrice, invoice.currency)}</td>
                <td className="text-start" dir="ltr">{money(item.lineTotal, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row justify-content-end mt-4">
          <div className="col-12 col-md-6">
            <div className="d-flex justify-content-between"><span>المجموع الفرعي</span><strong dir="ltr">{money(invoice.subtotal, invoice.currency)}</strong></div>
            <div className="d-flex justify-content-between"><span>الخصم</span><strong dir="ltr">{money(invoice.discountAmount, invoice.currency)}</strong></div>
            <div className="d-flex justify-content-between"><span>الضريبة</span><strong dir="ltr">{money(invoice.taxAmount, invoice.currency)}</strong></div>
            <hr />
            <div className="d-flex justify-content-between h5"><span>الإجمالي</span><strong dir="ltr">{money(invoice.totalAmount, invoice.currency)}</strong></div>
            <div className="d-flex justify-content-between"><span>المدفوع</span><strong dir="ltr">{money(invoice.amountPaid, invoice.currency)}</strong></div>
            <div className="d-flex justify-content-between"><span>المتبقي</span><strong dir="ltr">{outstanding.toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.currency}</strong></div>
          </div>
        </div>

        {invoice.notes ? <section className="mt-4"><h2 className="h6">ملاحظات</h2><p style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</p></section> : null}
        {invoice.terms ? <section className="mt-3"><h2 className="h6">الشروط</h2><p style={{ whiteSpace: "pre-wrap" }}>{invoice.terms}</p></section> : null}
      </AquaSystemDocument>
    </main>
  )
}
