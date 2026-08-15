import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { businessDate, minorToMoney, parseScaledDecimal } from "@/lib/finance"
import { decimalMinor, refreshInvoicePaymentState } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const paymentSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "WALLET", "CHEQUE", "OTHER"]),
  paidAt: z.string().trim().optional().nullable(),
  reference: z.string().trim().max(250).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

function optionalDate(
  value: string | null | undefined,
  timeZone: string,
) {
  if (!value) return businessDate(new Date(), timeZone)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ApiError("تاريخ الدفعة غير صحيح", 400, "INVALID_PAYMENT_DATE")
  }
  return date
}

function nullableText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.financeManagement)
    const { id } = await params

    const parsed = paymentSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات الدفعة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    let amountMinor: number
    try {
      amountMinor = parseScaledDecimal(parsed.data.amount)
    } catch {
      throw new ApiError("قيمة الدفعة غير صحيحة", 400, "INVALID_PAYMENT_AMOUNT")
    }

    if (amountMinor <= 0) {
      throw new ApiError("قيمة الدفعة يجب أن تكون أكبر من صفر", 400, "INVALID_PAYMENT_AMOUNT")
    }

    const paidAt = optionalDate(parsed.data.paidAt, user.company.timezone)
    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Invoice"
        WHERE "id" = ${id} AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const invoice = await tx.invoice.findFirst({
        where: { id, companyId: user.companyId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          currency: true,
          totalAmount: true,
          amountPaid: true,
          issueDate: true,
        },
      })

      if (!invoice) {
        throw new ApiError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND")
      }

      if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
        throw new ApiError(
          "لا يمكن تسجيل دفعة على مسودة أو فاتورة ملغاة",
          409,
          "INVOICE_NOT_PAYABLE",
        )
      }

      if (invoice.issueDate && paidAt.getTime() < invoice.issueDate.getTime()) {
        throw new ApiError(
          "تاريخ الدفعة لا يمكن أن يسبق تاريخ إصدار الفاتورة",
          400,
          "PAYMENT_DATE_BEFORE_INVOICE_DATE",
        )
      }

      const outstandingMinor =
        decimalMinor(invoice.totalAmount) - decimalMinor(invoice.amountPaid)

      if (outstandingMinor <= 0) {
        throw new ApiError("الفاتورة مدفوعة بالكامل", 409, "INVOICE_ALREADY_PAID")
      }

      if (amountMinor > outstandingMinor) {
        throw new ApiError(
          `قيمة الدفعة تتجاوز الرصيد المتبقي ${minorToMoney(outstandingMinor)} ${invoice.currency}`,
          409,
          "PAYMENT_EXCEEDS_OUTSTANDING",
        )
      }

      const payment = await tx.payment.create({
        data: {
          companyId: user.companyId,
          invoiceId: invoice.id,
          recordedById: user.id,
          amount: minorToMoney(amountMinor),
          currency: invoice.currency,
          method: parsed.data.method,
          status: "POSTED",
          paidAt,
          reference: nullableText(parsed.data.reference),
          notes: nullableText(parsed.data.notes),
        },
      })

      const updatedInvoice = await refreshInvoicePaymentState(
        tx,
        user.companyId,
        invoice.id,
      )

      if (updatedInvoice.status === "PAID") {
        await tx.projectContractAmendment.updateMany({
          where: { companyId: user.companyId, invoiceId: invoice.id },
          data: {
            invoiceReminderScheduleEnabled: false,
            invoiceReminderNextAt: null,
            invoiceReminderScheduleUpdatedAt: new Date(),
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PAYMENT_RECORDED,
        entityType: "Payment",
        entityId: payment.id,
        message: `تم تسجيل دفعة على الفاتورة ${invoice.invoiceNumber}`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: payment.amount.toString(),
          currency: payment.currency,
          method: payment.method,
        },
        ...meta,
      })

      return { payment, invoice: updatedInvoice }
    })

    return ok(
      {
        payment: {
          ...result.payment,
          amount: result.payment.amount.toString(),
          paidAt: result.payment.paidAt.toISOString(),
        },
        invoice: {
          id: result.invoice.id,
          status: result.invoice.status,
          amountPaid: result.invoice.amountPaid.toString(),
          totalAmount: result.invoice.totalAmount.toString(),
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(
      error,
      "FINANCE_PAYMENT_POST_ERROR",
      "تعذر تسجيل الدفعة",
    )
  }
}
