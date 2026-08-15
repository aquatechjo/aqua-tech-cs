import type { Metadata } from "next"
import { notFound } from "next/navigation"
import AquaSystemDocument from "@/components/aqua/AquaSystemDocument"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { paymentReceiptReference } from "@/lib/payment-receipt"
import { prisma } from "@/lib/prisma"
import PaymentReceiptActions from "./PaymentReceiptActions"

export const metadata: Metadata = { title: "Payment Receipt", robots: { index: false, follow: false } }
const methodLabels: Record<string, string> = { CASH: "نقدي", BANK_TRANSFER: "حوالة بنكية", CARD: "بطاقة", WALLET: "محفظة إلكترونية", CHEQUE: "شيك", OTHER: "أخرى" }
function money(value: { toString(): string }, currency: string) { return `${Number(value.toString()).toLocaleString("en-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` }

export default async function PaymentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeRead)
  const { id } = await params
  const payment = await prisma.payment.findFirst({ where: { id, companyId: user.companyId, status: "POSTED" }, include: { invoice: { include: { client: { select: { name: true, email: true, phone: true } }, project: { select: { name: true, code: true } } } }, recordedBy: { select: { name: true } } } })
  if (!payment) notFound()
  return <main className="py-3 aqua-invoice-document" data-payment-receipt><PaymentReceiptActions invoiceId={payment.invoiceId}/><AquaSystemDocument title="إيصال دفعة" documentLabel="Payment Receipt" reference={paymentReceiptReference(payment.id)} issuedAt={payment.paidAt.toISOString().slice(0, 10)} density="compact" footerNote={`إيصال دفعة صادر عن ${user.company.name}`}><div className="row g-3 mb-4"><div className="col-6"><div className="small text-secondary">العميل</div><strong>{payment.invoice.client?.name ?? "—"}</strong><div className="small" dir="ltr">{payment.invoice.client?.email ?? payment.invoice.client?.phone ?? "—"}</div></div><div className="col-6 text-start"><div className="small text-secondary">المشروع</div><strong>{payment.invoice.project?.name ?? "—"}</strong><div className="small" dir="ltr">{payment.invoice.project?.code ?? "—"}</div></div></div><div className="aqua-card-soft p-4"><div className="row g-3"><div className="col-6"><span className="small text-secondary d-block">رقم الفاتورة</span><strong dir="ltr">{payment.invoice.invoiceNumber}</strong></div><div className="col-6"><span className="small text-secondary d-block">المبلغ المستلم</span><strong className="text-success" dir="ltr">{money(payment.amount, payment.currency)}</strong></div><div className="col-6"><span className="small text-secondary d-block">طريقة الدفع</span><strong>{methodLabels[payment.method] ?? payment.method}</strong></div><div className="col-6"><span className="small text-secondary d-block">مرجع الدفعة</span><strong dir="ltr">{payment.reference ?? "—"}</strong></div><div className="col-6"><span className="small text-secondary d-block">تاريخ الدفع</span><strong dir="ltr">{payment.paidAt.toISOString().slice(0, 10)}</strong></div><div className="col-6"><span className="small text-secondary d-block">سُجلت بواسطة</span><strong>{payment.recordedBy?.name ?? "مستخدم محذوف"}</strong></div></div></div>{payment.notes ? <section className="mt-4"><h2 className="h6">ملاحظات الدفعة</h2><p style={{ whiteSpace: "pre-wrap" }}>{payment.notes}</p></section> : null}</AquaSystemDocument></main>
}
