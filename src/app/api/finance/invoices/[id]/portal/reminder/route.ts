import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendAmendmentInvoicePaymentReminderEmail } from "@/lib/email"
import { INVOICE_REMINDER_MAX_COUNT, invoiceReminderIssues, nextInvoiceReminderAt } from "@/lib/project-amendment-invoice-reminder"
import { invoicePortalPath } from "@/lib/project-amendment-invoice-portal"
import { createInvoicePortalAccess } from "@/lib/project-amendment-invoice-portal-server"
import { safeInvoicePortalDeliveryFailure } from "@/lib/project-amendment-invoice-portal-delivery"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim()
  const origin = configured ? new URL(configured).origin : new URL(request.url).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  return origin
}

async function remind(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  assertRole(user.role, ACCESS_ROLES.financeManagement)
  const { id } = await context.params
  const now = new Date()
  const access = createInvoicePortalAccess(now, 14)
  const meta = await getRequestMeta()

  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const invoice = await tx.invoice.findFirst({ where: { id, companyId: user.companyId }, include: { project: { select: { name: true } }, contractAmendment: true } })
    if (!invoice?.contractAmendment || !invoice.project) throw new ApiError("هذه ليست فاتورة ملحق عقد مرتبطة بمشروع", 409, "AMENDMENT_INVOICE_REQUIRED")
    await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${invoice.contractAmendment.id} AND "companyId" = ${user.companyId} FOR UPDATE`
    const amendment = await tx.projectContractAmendment.findUnique({ where: { id: invoice.contractAmendment.id } })
    if (!amendment) throw new ApiError("ملحق العقد غير موجود", 404, "PROJECT_AMENDMENT_NOT_FOUND")
    const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid))
    const issues = invoiceReminderIssues({ invoiceStatus: invoice.status, amountOutstanding: outstanding, portalTokenHash: amendment.invoicePortalTokenHash, portalExpiresAt: amendment.invoicePortalExpiresAt, portalRevokedAt: amendment.invoicePortalRevokedAt, deliverySentAt: amendment.invoicePortalDeliverySentAt, reminderSentAt: amendment.invoiceReminderSentAt, reminderCount: amendment.invoiceReminderCount, reminderPreparedAt: amendment.invoiceReminderPreparedAt, reminderFailedAt: amendment.invoiceReminderFailedAt, now })
    if (issues.length) throw new ApiError(issues[0], 409, "INVOICE_REMINDER_BLOCKED")
    if (!amendment.invoicePortalDeliveryRecipientName || !amendment.invoicePortalDeliveryRecipientEmail || !invoice.dueDate) throw new ApiError("بيانات مستلم بوابة الفاتورة غير مكتملة", 409, "INVOICE_REMINDER_RECIPIENT_REQUIRED")
    const updated = await tx.projectContractAmendment.update({ where: { id: amendment.id }, data: { invoiceReminderPreparedAt: now, invoiceReminderFailedAt: null, invoiceReminderFailureReason: null, invoiceReminderProviderId: null, invoiceReminderPendingTokenHash: access.tokenHash, invoiceReminderPendingExpiresAt: access.expiresAt, invoiceReminderAttemptCount: { increment: 1 } } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_REMINDER_PREPARED, entityType: "ProjectContractAmendment", entityId: amendment.id, message: `تم تجهيز تذكير دفع الفاتورة ${invoice.invoiceNumber}`, metadata: { invoiceId: invoice.id, recipientEmail: amendment.invoicePortalDeliveryRecipientEmail, expiresAt: access.expiresAt.toISOString() }, ...meta })
    return { invoice, amendment: updated, outstanding }
  }, { isolationLevel: "Serializable" })

  const portalUrl = new URL(invoicePortalPath(access.token), publicOrigin(request)).toString()
  const validUntilLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long", timeStyle: "short", timeZone: user.company.timezone }).format(access.expiresAt)
  try {
    const providerId = await sendAmendmentInvoicePaymentReminderEmail({ to: prepared.amendment.invoicePortalDeliveryRecipientEmail!, recipientName: prepared.amendment.invoicePortalDeliveryRecipientName!, invoiceNumber: prepared.invoice.invoiceNumber, projectName: prepared.invoice.project!.name, outstandingAmount: prepared.outstanding.toFixed(2), currency: prepared.invoice.currency, dueDate: prepared.invoice.dueDate!.toISOString().slice(0, 10), portalUrl, validUntilLabel })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${prepared.amendment.id} AND "companyId" = ${user.companyId} FOR UPDATE`
      const current = await tx.projectContractAmendment.findUnique({ where: { id: prepared.amendment.id } })
      if (!current || current.invoiceReminderPendingTokenHash !== access.tokenHash) throw new ApiError("تغيّرت محاولة التذكير قبل اعتمادها", 409, "INVOICE_REMINDER_PREPARATION_CHANGED")
      const nextCount = current.invoiceReminderCount + 1
      const keepSchedule = current.invoiceReminderScheduleEnabled && nextCount < INVOICE_REMINDER_MAX_COUNT
      await tx.projectContractAmendment.update({ where: { id: current.id }, data: { invoicePortalTokenHash: access.tokenHash, invoicePortalExpiresAt: access.expiresAt, invoicePortalIssuedAt: now, invoicePortalRevokedAt: null, invoicePortalFirstViewedAt: null, invoicePortalLastViewedAt: null, invoicePortalViewCount: 0, invoiceReminderProviderId: providerId, invoiceReminderPreparedAt: null, invoiceReminderSentAt: now, invoiceReminderFailedAt: null, invoiceReminderFailureReason: null, invoiceReminderCount: { increment: 1 }, invoiceReminderPendingTokenHash: null, invoiceReminderPendingExpiresAt: null, invoiceReminderScheduleEnabled: keepSchedule, invoiceReminderNextAt: keepSchedule ? nextInvoiceReminderAt(now, now) : null, invoiceReminderScheduleUpdatedAt: current.invoiceReminderScheduleEnabled ? now : current.invoiceReminderScheduleUpdatedAt } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_REMINDER_SENT, entityType: "ProjectContractAmendment", entityId: current.id, message: `تم إرسال تذكير دفع الفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, recipientEmail: current.invoicePortalDeliveryRecipientEmail, providerId, expiresAt: access.expiresAt.toISOString(), linkRotated: true }, ...meta })
    })
  } catch (error) {
    const failureReason = safeInvoicePortalDeliveryFailure(error)
    await prisma.$transaction(async (tx) => {
      const failed = await tx.projectContractAmendment.updateMany({ where: { id: prepared.amendment.id, companyId: user.companyId, invoiceReminderPendingTokenHash: access.tokenHash }, data: { invoiceReminderPreparedAt: null, invoiceReminderFailedAt: now, invoiceReminderFailureReason: failureReason, invoiceReminderPendingTokenHash: null, invoiceReminderPendingExpiresAt: null, invoiceReminderScheduleEnabled: false, invoiceReminderNextAt: null, invoiceReminderScheduleUpdatedAt: now } })
      if (failed.count) await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_REMINDER_FAILED, entityType: "ProjectContractAmendment", entityId: prepared.amendment.id, message: `فشل تذكير دفع الفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, failureReason }, ...meta })
    })
    throw new ApiError("تعذر إرسال تذكير الدفع. بقي الرابط السابق فعالًا إن وجد.", 502, "INVOICE_REMINDER_FAILED")
  }
  return ok({ sent: true, reminderNumber: prepared.amendment.invoiceReminderCount + 1, expiresAt: access.expiresAt.toISOString() })
}

export const POST = withApiHandler("INVOICE_REMINDER_ERROR", remind, "تعذر إرسال تذكير دفع الفاتورة")
