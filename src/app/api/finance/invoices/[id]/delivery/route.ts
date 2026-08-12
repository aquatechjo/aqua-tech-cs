import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendAmendmentInvoiceDeliveryEmail } from "@/lib/email"
import {
  amendmentInvoiceDeliveryIssues,
  amendmentInvoiceDeliverySchema,
  safeInvoiceDeliveryFailure,
  invoiceDeliveryAttemptInProgress,
} from "@/lib/project-amendment-invoice-delivery"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

type Context = { params: Promise<{ id: string }> }

async function deliver(request: Request, context: Context) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const parsed = amendmentInvoiceDeliverySchema.safeParse(
    await readJsonBody(request),
  )
  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات مستلم الفاتورة غير صحيحة",
      400,
      "INVALID_AMENDMENT_INVOICE_DELIVERY_INPUT",
    )
  }
  const meta = await getRequestMeta()
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "Invoice"
      WHERE "id" = ${id} AND "companyId" = ${user.companyId}
      FOR UPDATE
    `
    const invoice = await tx.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        project: { select: { id: true, name: true, clientId: true } },
        contractAmendment: true,
      },
    })
    if (!invoice?.contractAmendment || !invoice.project) {
      throw new ApiError(
        "هذه ليست فاتورة ملحق عقد مرتبطة بمشروع",
        409,
        "AMENDMENT_INVOICE_REQUIRED",
      )
    }
    await tx.$queryRaw`
      SELECT "id" FROM "ProjectContractAmendment"
      WHERE "id" = ${invoice.contractAmendment.id}
        AND "companyId" = ${user.companyId}
      FOR UPDATE
    `
    const amendment = await tx.projectContractAmendment.findUnique({
      where: { id: invoice.contractAmendment.id },
    })
    if (!amendment) {
      throw new ApiError("ملحق العقد غير موجود", 404, "PROJECT_AMENDMENT_NOT_FOUND")
    }
    const issues = amendmentInvoiceDeliveryIssues({
      invoiceStatus: invoice.status,
      invoiceIssuedAt: amendment.invoiceIssuedAt,
      deliverySentAt: amendment.invoiceDeliverySentAt,
      clientId: invoice.clientId,
      projectClientId: invoice.project.clientId,
    })
    if (issues.length) {
      throw new ApiError(issues[0], 409, "AMENDMENT_INVOICE_DELIVERY_BLOCKED")
    }
    if (invoiceDeliveryAttemptInProgress({
      preparedAt: amendment.invoiceDeliveryPreparedAt,
      failedAt: amendment.invoiceDeliveryFailedAt,
    })) {
      throw new ApiError(
        "توجد محاولة إرسال قيد التنفيذ",
        409,
        "AMENDMENT_INVOICE_DELIVERY_IN_PROGRESS",
      )
    }
    const now = new Date()
    const updated = await tx.projectContractAmendment.update({
      where: { id: amendment.id },
      data: {
        invoiceDeliveryRecipientName: parsed.data.recipientName,
        invoiceDeliveryRecipientEmail: parsed.data.recipientEmail,
        invoiceDeliveryReference: parsed.data.deliveryReference,
        invoiceDeliveryPreparedAt: now,
        invoiceDeliveryFailedAt: null,
        invoiceDeliveryFailureReason: null,
        invoiceDeliveryProviderId: null,
        invoiceDeliveryAttemptCount: { increment: 1 },
      },
    })
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_AMENDMENT_INVOICE_DELIVERY_PREPARED,
      entityType: "ProjectContractAmendment",
      entityId: amendment.id,
      message: `تم تجهيز إرسال الفاتورة ${invoice.invoiceNumber}`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        recipientEmail: parsed.data.recipientEmail,
        deliveryReference: parsed.data.deliveryReference,
      },
      ...meta,
    })
    return { invoice, amendment: updated }
  }, { isolationLevel: "Serializable" })

  try {
    const providerId = await sendAmendmentInvoiceDeliveryEmail({
      to: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName,
      invoiceNumber: prepared.invoice.invoiceNumber,
      amendmentNumber: prepared.amendment.amendmentNumber,
      projectName: prepared.invoice.project!.name,
      totalAmount: prepared.invoice.totalAmount.toString(),
      currency: prepared.invoice.currency,
      issueDate: prepared.invoice.issueDate!.toISOString().slice(0, 10),
      dueDate: prepared.invoice.dueDate!.toISOString().slice(0, 10),
      companyEmail: user.company.email ?? "info.aquatech.jo@gmail.com",
    })
    await prisma.$transaction(async (tx) => {
      await tx.projectContractAmendment.update({
        where: { id: prepared.amendment.id },
        data: {
          invoiceDeliveryProviderId: providerId,
          invoiceDeliverySentAt: new Date(),
          invoiceDeliveryFailedAt: null,
          invoiceDeliveryFailureReason: null,
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_AMENDMENT_INVOICE_SENT,
        entityType: "ProjectContractAmendment",
        entityId: prepared.amendment.id,
        message: `تم إرسال الفاتورة ${prepared.invoice.invoiceNumber} للعميل`,
        metadata: {
          invoiceId: prepared.invoice.id,
          recipientEmail: parsed.data.recipientEmail,
          providerId,
        },
        ...meta,
      })
    })
    return ok({ sent: true, recipientEmail: parsed.data.recipientEmail })
  } catch (error) {
    const failureReason = safeInvoiceDeliveryFailure(error)
    await prisma.$transaction(async (tx) => {
      await tx.projectContractAmendment.update({
        where: { id: prepared.amendment.id },
        data: {
          invoiceDeliveryFailedAt: new Date(),
          invoiceDeliveryFailureReason: failureReason,
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_AMENDMENT_INVOICE_DELIVERY_FAILED,
        entityType: "ProjectContractAmendment",
        entityId: prepared.amendment.id,
        message: `فشل إرسال الفاتورة ${prepared.invoice.invoiceNumber}`,
        metadata: {
          invoiceId: prepared.invoice.id,
          recipientEmail: parsed.data.recipientEmail,
          failureReason,
        },
        ...meta,
      })
    })
    throw new ApiError(
      "تعذر إرسال الفاتورة. تم توثيق المحاولة ويمكن إعادة المحاولة.",
      502,
      "AMENDMENT_INVOICE_DELIVERY_FAILED",
    )
  }
}

export const POST = withApiHandler(
  "AMENDMENT_INVOICE_DELIVERY_ERROR",
  deliver,
  "تعذر إرسال فاتورة الملحق",
)
