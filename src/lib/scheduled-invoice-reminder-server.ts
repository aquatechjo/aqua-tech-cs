import "server-only"

import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError } from "@/lib/api-response"
import { sendAmendmentInvoicePaymentReminderEmail } from "@/lib/email"
import { INVOICE_REMINDER_MAX_COUNT, nextInvoiceReminderAt } from "@/lib/project-amendment-invoice-reminder"
import { invoicePortalPath } from "@/lib/project-amendment-invoice-portal"
import { createInvoicePortalAccess } from "@/lib/project-amendment-invoice-portal-server"
import { safeInvoicePortalDeliveryFailure } from "@/lib/project-amendment-invoice-portal-delivery"
import { prisma } from "@/lib/prisma"

function configuredPublicOrigin() {
  const configured = process.env.APP_URL?.trim()
  if (!configured) throw new ApiError("APP_URL مطلوب لتشغيل تذكيرات الفواتير", 500, "PUBLIC_APP_URL_REQUIRED")
  const origin = new URL(configured).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  return origin
}

export async function sendScheduledInvoiceReminder({ amendmentId, companyId, timezone }: { amendmentId: string; companyId: string; timezone: string }) {
  const now = new Date()
  const access = createInvoicePortalAccess(now, 14)
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${amendmentId} AND "companyId" = ${companyId} FOR UPDATE`
    const amendment = await tx.projectContractAmendment.findFirst({ where: { id: amendmentId, companyId }, include: { invoice: { include: { project: { select: { name: true } } } } } })
    const invoice = amendment?.invoice
    if (!amendment || !invoice || !invoice.project) throw new ApiError("فاتورة التذكير غير موجودة", 404, "INVOICE_REMINDER_NOT_FOUND")
    const outstanding = Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid))
    const valid = amendment.invoiceReminderScheduleEnabled && amendment.invoiceReminderNextAt && amendment.invoiceReminderNextAt <= now && ["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) && outstanding > 0 && invoice.dueDate && amendment.invoiceReminderCount < INVOICE_REMINDER_MAX_COUNT && amendment.invoicePortalDeliveryRecipientName && amendment.invoicePortalDeliveryRecipientEmail && amendment.invoicePortalTokenHash && amendment.invoicePortalExpiresAt && amendment.invoicePortalExpiresAt > now && !amendment.invoicePortalRevokedAt
    if (!valid) {
      await tx.projectContractAmendment.update({ where: { id: amendment.id }, data: { invoiceReminderScheduleEnabled: false, invoiceReminderNextAt: null, invoiceReminderScheduleUpdatedAt: now } })
      return null
    }
    const updated = await tx.projectContractAmendment.update({ where: { id: amendment.id }, data: { invoiceReminderPreparedAt: now, invoiceReminderFailedAt: null, invoiceReminderFailureReason: null, invoiceReminderProviderId: null, invoiceReminderPendingTokenHash: access.tokenHash, invoiceReminderPendingExpiresAt: access.expiresAt, invoiceReminderAttemptCount: { increment: 1 } } })
    return { amendment: updated, invoice, outstanding }
  }, { isolationLevel: "Serializable" })

  if (!prepared) throw new ApiError("التذكير المجدول لم يعد مستحقًا", 409, "INVOICE_REMINDER_NOT_DUE")

  const portalUrl = new URL(invoicePortalPath(access.token), configuredPublicOrigin()).toString()
  const validUntilLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long", timeStyle: "short", timeZone: timezone }).format(access.expiresAt)
  try {
    const providerId = await sendAmendmentInvoicePaymentReminderEmail({ to: prepared.amendment.invoicePortalDeliveryRecipientEmail!, recipientName: prepared.amendment.invoicePortalDeliveryRecipientName!, invoiceNumber: prepared.invoice.invoiceNumber, projectName: prepared.invoice.project!.name, outstandingAmount: prepared.outstanding.toFixed(2), currency: prepared.invoice.currency, dueDate: prepared.invoice.dueDate!.toISOString().slice(0, 10), portalUrl, validUntilLabel })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectContractAmendment" WHERE "id" = ${amendmentId} AND "companyId" = ${companyId} FOR UPDATE`
      const current = await tx.projectContractAmendment.findFirst({ where: { id: amendmentId, companyId } })
      if (!current || current.invoiceReminderPendingTokenHash !== access.tokenHash) throw new ApiError("تغيّرت محاولة التذكير", 409, "INVOICE_REMINDER_PREPARATION_CHANGED")
      const nextCount = current.invoiceReminderCount + 1
      const keepSchedule = current.invoiceReminderScheduleEnabled && nextCount < INVOICE_REMINDER_MAX_COUNT
      await tx.projectContractAmendment.update({ where: { id: current.id }, data: { invoicePortalTokenHash: access.tokenHash, invoicePortalExpiresAt: access.expiresAt, invoicePortalIssuedAt: now, invoicePortalRevokedAt: null, invoicePortalFirstViewedAt: null, invoicePortalLastViewedAt: null, invoicePortalViewCount: 0, invoiceReminderProviderId: providerId, invoiceReminderPreparedAt: null, invoiceReminderSentAt: now, invoiceReminderFailedAt: null, invoiceReminderFailureReason: null, invoiceReminderCount: { increment: 1 }, invoiceReminderPendingTokenHash: null, invoiceReminderPendingExpiresAt: null, invoiceReminderScheduleEnabled: keepSchedule, invoiceReminderNextAt: keepSchedule ? nextInvoiceReminderAt(now, now) : null, invoiceReminderScheduleUpdatedAt: now } })
      await logActivity({ db: tx, companyId, userId: null, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_SCHEDULED_REMINDER_SENT, entityType: "ProjectContractAmendment", entityId: current.id, message: `تم إرسال تذكير دفع مجدول للفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, reminderNumber: nextCount, providerId, scheduleContinues: keepSchedule, linkRotated: true } })
    }, { isolationLevel: "Serializable" })
  } catch (error) {
    const failureReason = safeInvoicePortalDeliveryFailure(error)
    await prisma.$transaction(async (tx) => {
      const failed = await tx.projectContractAmendment.updateMany({ where: { id: amendmentId, companyId, invoiceReminderPendingTokenHash: access.tokenHash }, data: { invoiceReminderPreparedAt: null, invoiceReminderFailedAt: now, invoiceReminderFailureReason: failureReason, invoiceReminderPendingTokenHash: null, invoiceReminderPendingExpiresAt: null, invoiceReminderScheduleEnabled: false, invoiceReminderNextAt: null, invoiceReminderScheduleUpdatedAt: now } })
      if (failed.count) await logActivity({ db: tx, companyId, userId: null, action: ActivityAction.PROJECT_AMENDMENT_INVOICE_SCHEDULED_REMINDER_FAILED, entityType: "ProjectContractAmendment", entityId: amendmentId, message: `فشل تذكير الدفع المجدول للفاتورة ${prepared.invoice.invoiceNumber}`, metadata: { invoiceId: prepared.invoice.id, failureReason, scheduleStopped: true, activeLinkPreserved: true } })
    })
    throw new ApiError("فشل التذكير المجدول وتوقفت الجدولة", 502, "SCHEDULED_INVOICE_REMINDER_FAILED")
  }
  return { sent: true }
}
