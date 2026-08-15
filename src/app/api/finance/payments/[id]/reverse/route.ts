import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { refreshInvoicePaymentState } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import { paymentReceiptAttemptInProgress } from "@/lib/payment-receipt"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const reverseSchema = z.object({
  reason: z.string().trim().min(3, "سبب عكس الدفعة مطلوب").max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeManagement)
    const { id } = await params

    const parsed = reverseSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "سبب عكس الدفعة مطلوب",
        400,
        "VALIDATION_ERROR",
      )
    }

    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      const lockedPayments = await tx.$queryRaw<Array<{ invoiceId: string }>>`
        SELECT "invoiceId"
        FROM "Payment"
        WHERE "id" = ${id} AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const lockedPayment = lockedPayments[0]
      if (!lockedPayment) {
        throw new ApiError("الدفعة غير موجودة", 404, "PAYMENT_NOT_FOUND")
      }

      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Invoice"
        WHERE "id" = ${lockedPayment.invoiceId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const payment = await tx.payment.findFirst({
        where: { id, companyId: user.companyId },
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
      })

      if (!payment) {
        throw new ApiError("الدفعة غير موجودة", 404, "PAYMENT_NOT_FOUND")
      }

      if (payment.status === "REVERSED") {
        throw new ApiError("تم عكس هذه الدفعة سابقًا", 409, "PAYMENT_ALREADY_REVERSED")
      }

      if (paymentReceiptAttemptInProgress({ preparedAt: payment.receiptPreparedAt, failedAt: payment.receiptFailedAt, sentAt: payment.receiptSentAt })) {
        throw new ApiError("لا يمكن عكس الدفعة أثناء إرسال إيصالها", 409, "PAYMENT_RECEIPT_DELIVERY_IN_PROGRESS")
      }

      const reversed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "REVERSED",
          reversedById: user.id,
          reversedAt: new Date(),
          reversalReason: parsed.data.reason,
        },
      })

      const invoice = await refreshInvoicePaymentState(
        tx,
        user.companyId,
        payment.invoiceId,
      )

      if (["ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { collectionStatus: "NEW", collectionNextAction: "مراجعة أثر عكس الدفعة والتواصل مع العميل", collectionNextActionAt: new Date(), collectionUpdatedAt: new Date() } })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PAYMENT_REVERSED,
        entityType: "Payment",
        entityId: payment.id,
        message: `تم عكس دفعة على الفاتورة ${payment.invoice.invoiceNumber}`,
        metadata: {
          invoiceId: payment.invoiceId,
          invoiceNumber: payment.invoice.invoiceNumber,
          amount: payment.amount.toString(),
          reason: parsed.data.reason,
        },
        ...meta,
      })

      return { payment: reversed, invoice }
    })

    return ok({
      payment: {
        id: result.payment.id,
        status: result.payment.status,
        reversedAt: result.payment.reversedAt?.toISOString() ?? null,
        reversalReason: result.payment.reversalReason,
      },
      invoice: {
        id: result.invoice.id,
        status: result.invoice.status,
        amountPaid: result.invoice.amountPaid.toString(),
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      "FINANCE_PAYMENT_REVERSE_ERROR",
      "تعذر عكس الدفعة",
    )
  }
}
