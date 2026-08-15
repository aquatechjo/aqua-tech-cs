import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendPaymentReceiptEmail } from "@/lib/email"
import { paymentReceiptDeliveryIssues, paymentReceiptReference, safePaymentReceiptFailure } from "@/lib/payment-receipt"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

const methodLabels: Record<string, string> = { CASH: "نقدي", BANK_TRANSFER: "حوالة بنكية", CARD: "بطاقة", WALLET: "محفظة إلكترونية", CHEQUE: "شيك", OTHER: "أخرى" }

async function deliver(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const now = new Date()
  const meta = await getRequestMeta()
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const payment = await tx.payment.findFirst({ where: { id, companyId: user.companyId }, include: { invoice: { include: { client: { select: { name: true, email: true } }, project: { select: { name: true } } } } } })
    if (!payment) throw new ApiError("الدفعة غير موجودة", 404, "PAYMENT_NOT_FOUND")
    const issues = paymentReceiptDeliveryIssues({ status: payment.status, clientName: payment.invoice.client?.name ?? null, clientEmail: payment.invoice.client?.email ?? null, preparedAt: payment.receiptPreparedAt, failedAt: payment.receiptFailedAt, sentAt: payment.receiptSentAt, now })
    if (issues.length) throw new ApiError(issues[0], 409, "PAYMENT_RECEIPT_DELIVERY_BLOCKED")
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { receiptRecipientName: payment.invoice.client!.name, receiptRecipientEmail: payment.invoice.client!.email!, receiptPreparedAt: now, receiptFailedAt: null, receiptFailureReason: null, receiptProviderId: null, receiptDeliveryAttemptCount: { increment: 1 } } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PAYMENT_RECEIPT_DELIVERY_PREPARED, entityType: "Payment", entityId: payment.id, message: `تم تجهيز إرسال إيصال دفعة الفاتورة ${payment.invoice.invoiceNumber}`, metadata: { invoiceId: payment.invoice.id, recipientEmail: payment.invoice.client!.email, receiptReference: paymentReceiptReference(payment.id) }, ...meta })
    return { payment: updated, invoice: payment.invoice }
  }, { isolationLevel: "Serializable" })

  try {
    const providerId = await sendPaymentReceiptEmail({ to: prepared.payment.receiptRecipientEmail!, recipientName: prepared.payment.receiptRecipientName!, receiptReference: paymentReceiptReference(prepared.payment.id), invoiceNumber: prepared.invoice.invoiceNumber, projectName: prepared.invoice.project?.name ?? "—", amount: prepared.payment.amount.toString(), currency: prepared.payment.currency, paymentMethod: methodLabels[prepared.payment.method] ?? prepared.payment.method, paidAt: prepared.payment.paidAt.toISOString().slice(0, 10), paymentReference: prepared.payment.reference, companyEmail: user.company.email ?? "info.aquatech.jo@gmail.com" })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${prepared.payment.id} AND "companyId" = ${user.companyId} FOR UPDATE`
      const current = await tx.payment.findFirst({ where: { id: prepared.payment.id, companyId: user.companyId } })
      if (!current || current.status !== "POSTED" || current.receiptPreparedAt?.getTime() !== now.getTime()) throw new ApiError("تغيّرت الدفعة قبل اعتماد الإيصال", 409, "PAYMENT_RECEIPT_PREPARATION_CHANGED")
      await tx.payment.update({ where: { id: prepared.payment.id }, data: { receiptProviderId: providerId, receiptSentAt: new Date(), receiptFailedAt: null, receiptFailureReason: null } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PAYMENT_RECEIPT_SENT, entityType: "Payment", entityId: prepared.payment.id, message: `تم إرسال إيصال دفعة الفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, recipientEmail: prepared.payment.receiptRecipientEmail, providerId, receiptReference: paymentReceiptReference(prepared.payment.id) }, ...meta })
    })
  } catch (error) {
    const failureReason = safePaymentReceiptFailure(error)
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: prepared.payment.id }, data: { receiptFailedAt: new Date(), receiptFailureReason: failureReason } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PAYMENT_RECEIPT_DELIVERY_FAILED, entityType: "Payment", entityId: prepared.payment.id, message: `فشل إرسال إيصال دفعة الفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, failureReason }, ...meta })
    })
    throw new ApiError("تعذر إرسال إيصال الدفعة", 502, "PAYMENT_RECEIPT_DELIVERY_FAILED")
  }
  return ok({ sent: true, recipientEmail: prepared.payment.receiptRecipientEmail, receiptReference: paymentReceiptReference(prepared.payment.id) })
}

export const POST = withApiHandler("PAYMENT_RECEIPT_DELIVERY_ERROR", deliver, "تعذر إرسال إيصال الدفعة")
