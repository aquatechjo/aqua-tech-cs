import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendAmendmentInvoicePortalDeliveryEmail } from "@/lib/email"
import {
  invoicePortalDeliveryIssues,
  invoicePortalDeliverySchema,
  portalDeliveryAttemptInProgress,
  safeInvoicePortalDeliveryFailure,
} from "@/lib/project-amendment-invoice-portal-delivery"
import { invoicePortalPath } from "@/lib/project-amendment-invoice-portal"
import { createInvoicePortalAccess } from "@/lib/project-amendment-invoice-portal-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim()
  const origin = configured ? new URL(configured).origin : new URL(request.url).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) {
    throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  }
  return origin
}

async function deliver(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const parsed = invoicePortalDeliverySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    throw new ApiError("بيانات مستلم بوابة الفاتورة غير صحيحة", 400, "INVALID_INVOICE_PORTAL_DELIVERY_INPUT")
  }
  const meta = await getRequestMeta()
  const now = new Date()
  const access = createInvoicePortalAccess(now, parsed.data.validDays)

  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const invoice = await tx.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: { project: { select: { id: true, name: true, clientId: true } }, contractAmendment: true },
    })
    if (!invoice?.contractAmendment || !invoice.project) {
      throw new ApiError("هذه ليست فاتورة ملحق عقد مرتبطة بمشروع", 409, "AMENDMENT_INVOICE_REQUIRED")
    }
    await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${invoice.contractAmendment.id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const amendment = await tx.projectContractAmendment.findUnique({ where: { id: invoice.contractAmendment.id } })
    if (!amendment) throw new ApiError("ملحق العقد غير موجود", 404, "PROJECT_AMENDMENT_NOT_FOUND")
    const issues = invoicePortalDeliveryIssues({
      invoiceStatus: invoice.status,
      invoiceIssuedAt: amendment.invoiceIssuedAt,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      issueReference: amendment.invoiceIssueReference,
      clientId: invoice.clientId,
      projectClientId: invoice.project.clientId,
    })
    if (issues.length) throw new ApiError(issues[0], 409, "INVOICE_PORTAL_DELIVERY_BLOCKED")
    if (portalDeliveryAttemptInProgress({
      preparedAt: amendment.invoicePortalDeliveryPreparedAt,
      failedAt: amendment.invoicePortalDeliveryFailedAt,
      sentAt: amendment.invoicePortalDeliverySentAt,
      now,
    })) {
      throw new ApiError("توجد محاولة إرسال بوابة قيد التنفيذ", 409, "INVOICE_PORTAL_DELIVERY_IN_PROGRESS")
    }
    const updated = await tx.projectContractAmendment.update({
      where: { id: amendment.id },
      data: {
        invoicePortalDeliveryRecipientName: parsed.data.recipientName,
        invoicePortalDeliveryRecipientEmail: parsed.data.recipientEmail,
        invoicePortalDeliveryPreparedAt: now,
        invoicePortalDeliverySentAt: null,
        invoicePortalDeliveryFailedAt: null,
        invoicePortalDeliveryFailureReason: null,
        invoicePortalDeliveryProviderId: null,
        invoicePortalDeliveryAttemptCount: { increment: 1 },
      },
    })
    await logActivity({
      db: tx, companyId: user.companyId, userId: user.id,
      action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_DELIVERY_PREPARED,
      entityType: "ProjectContractAmendment", entityId: amendment.id,
      message: `تم تجهيز إرسال بوابة الفاتورة ${invoice.invoiceNumber}`,
      metadata: { invoiceId: invoice.id, recipientEmail: parsed.data.recipientEmail, expiresAt: access.expiresAt.toISOString() }, ...meta,
    })
    return { invoice, amendment: updated }
  }, { isolationLevel: "Serializable" })

  const portalUrl = new URL(invoicePortalPath(access.token), publicOrigin(request)).toString()
  const validUntilLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "long", timeStyle: "short", timeZone: user.company.timezone,
  }).format(access.expiresAt)

  try {
    const providerId = await sendAmendmentInvoicePortalDeliveryEmail({
      to: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName,
      invoiceNumber: prepared.invoice.invoiceNumber,
      projectName: prepared.invoice.project!.name,
      totalAmount: prepared.invoice.totalAmount.toString(),
      currency: prepared.invoice.currency,
      dueDate: prepared.invoice.dueDate!.toISOString().slice(0, 10),
      portalUrl,
      validUntilLabel,
    })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${prepared.amendment.id} FOR UPDATE`
      await tx.projectContractAmendment.update({
        where: { id: prepared.amendment.id },
        data: {
          invoicePortalTokenHash: access.tokenHash,
          invoicePortalExpiresAt: access.expiresAt,
          invoicePortalIssuedAt: new Date(),
          invoicePortalRevokedAt: null,
          invoicePortalFirstViewedAt: null,
          invoicePortalLastViewedAt: null,
          invoicePortalViewCount: 0,
          invoiceReminderScheduleEnabled: false,
          invoiceReminderNextAt: null,
          invoiceReminderScheduleUpdatedAt: new Date(),
          invoicePortalDeliveryProviderId: providerId,
          invoicePortalDeliverySentAt: new Date(),
        },
      })
      await logActivity({
        db: tx, companyId: user.companyId, userId: user.id,
        action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_SENT,
        entityType: "ProjectContractAmendment", entityId: prepared.amendment.id,
        message: `تم إرسال بوابة الفاتورة ${prepared.invoice.invoiceNumber} للعميل`,
        metadata: { invoiceId: prepared.invoice.id, recipientEmail: parsed.data.recipientEmail, providerId, expiresAt: access.expiresAt.toISOString() }, ...meta,
      })
    })
  } catch (error) {
    const failureReason = safeInvoicePortalDeliveryFailure(error)
    await prisma.$transaction(async (tx) => {
      await tx.projectContractAmendment.update({
        where: { id: prepared.amendment.id },
        data: { invoicePortalDeliveryFailedAt: new Date(), invoicePortalDeliveryFailureReason: failureReason },
      })
      await logActivity({
        db: tx, companyId: user.companyId, userId: user.id,
        action: ActivityAction.PROJECT_AMENDMENT_INVOICE_PORTAL_DELIVERY_FAILED,
        entityType: "ProjectContractAmendment", entityId: prepared.amendment.id,
        message: `فشل إرسال بوابة الفاتورة ${prepared.invoice.invoiceNumber}`,
        metadata: { invoiceId: prepared.invoice.id, recipientEmail: parsed.data.recipientEmail, failureReason }, ...meta,
      })
    })
    throw new ApiError("تعذر إرسال رابط الفاتورة. بقي الرابط السابق فعالًا إن وجد.", 502, "INVOICE_PORTAL_DELIVERY_FAILED")
  }

  return ok({ sent: true, recipientEmail: parsed.data.recipientEmail, expiresAt: access.expiresAt.toISOString() })
}

export const POST = withApiHandler("INVOICE_PORTAL_DELIVERY_ERROR", deliver, "تعذر إرسال بوابة فاتورة العميل")
