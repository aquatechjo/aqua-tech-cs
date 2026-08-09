import "server-only"

import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { sendProjectFeedbackReminderEmail } from "@/lib/email"
import { FEEDBACK_PUBLIC_LINK_DAYS, publicFeedbackPath } from "@/lib/project-feedback"
import {
  FEEDBACK_REMINDER_COOLDOWN_MS,
  FEEDBACK_REMINDER_MAX_COUNT,
  FEEDBACK_REMINDER_PREPARATION_TIMEOUT_MS,
} from "@/lib/project-feedback-reminder"
import { createFeedbackPublicAccess } from "@/lib/project-feedback-public-server"
import { prisma } from "@/lib/prisma"

type ReminderSource = "MANUAL" | "SCHEDULED"

function configuredPublicOrigin() {
  const configured = process.env.APP_URL?.trim()
  if (!configured) throw new ApiError("APP_URL مطلوب لتشغيل تذكيرات التقييم", 500, "PUBLIC_APP_URL_REQUIRED")
  const origin = new URL(configured).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  return origin
}

export async function sendGovernedFeedbackReminder({
  projectId,
  companyId,
  projectName,
  timezone,
  userId = null,
  source,
  requestMeta = {},
}: {
  projectId: string
  companyId: string
  projectName: string
  timezone: string
  userId?: string | null
  source: ReminderSource
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null }
}) {
  const now = new Date()
  const access = createFeedbackPublicAccess(now, FEEDBACK_PUBLIC_LINK_DAYS)
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "projectId" = ${projectId} AND "companyId" = ${companyId} FOR UPDATE`
    const feedback = await tx.projectFeedback.findFirst({ where: { projectId, companyId } })
    if (!feedback || !feedback.deliveryRecipientName || !feedback.deliveryRecipientEmail || !feedback.deliverySentAt) throw new ApiError("أرسل الدعوة الأساسية أولًا", 409, "FEEDBACK_INVITATION_REQUIRED")
    if (feedback.receivedAt || feedback.publicSubmittedAt) throw new ApiError("تم استلام التقييم ولا حاجة للتذكير", 409, "PROJECT_FEEDBACK_ALREADY_RECEIVED")
    if (!feedback.publicTokenHash || !feedback.publicExpiresAt || feedback.publicRevokedAt || feedback.publicExpiresAt <= now) throw new ApiError("رابط التقييم غير نشط. أرسل دعوة جديدة أولًا.", 409, "FEEDBACK_LINK_NOT_ACTIVE")
    if (feedback.reminderCount >= FEEDBACK_REMINDER_MAX_COUNT) throw new ApiError("تم بلوغ الحد الأقصى للتذكيرات", 409, "FEEDBACK_REMINDER_LIMIT_REACHED")
    const lastContactAt = feedback.reminderSentAt ?? feedback.deliverySentAt
    if (now.getTime() - lastContactAt.getTime() < FEEDBACK_REMINDER_COOLDOWN_MS) throw new ApiError("يجب الانتظار 72 ساعة بين رسائل التقييم", 429, "FEEDBACK_REMINDER_COOLDOWN")
    if (feedback.reminderPreparedAt && now.getTime() - feedback.reminderPreparedAt.getTime() < FEEDBACK_REMINDER_PREPARATION_TIMEOUT_MS) throw new ApiError("توجد محاولة تذكير قيد الإرسال", 409, "FEEDBACK_REMINDER_IN_PROGRESS")
    if (source === "SCHEDULED" && (!feedback.reminderScheduleEnabled || !feedback.reminderNextAt || feedback.reminderNextAt > now)) throw new ApiError("التذكير المجدول غير مستحق", 409, "FEEDBACK_REMINDER_NOT_DUE")
    return tx.projectFeedback.update({
      where: { id: feedback.id },
      data: {
        reminderPreparedAt: now,
        reminderPendingTokenHash: access.tokenHash,
        reminderPendingExpiresAt: access.expiresAt,
        reminderFailedAt: null,
        reminderFailureReason: null,
        reminderAttemptCount: { increment: 1 },
      },
    })
  }, { isolationLevel: "Serializable" })

  const feedbackUrl = new URL(publicFeedbackPath(access.token), configuredPublicOrigin()).toString()
  const validUntilLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long", timeZone: timezone }).format(access.expiresAt)
  try {
    const providerId = await sendProjectFeedbackReminderEmail({ to: prepared.deliveryRecipientEmail!, recipientName: prepared.deliveryRecipientName!, projectName, feedbackUrl, validUntilLabel })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "id" = ${prepared.id} FOR UPDATE`
      const current = await tx.projectFeedback.findUnique({ where: { id: prepared.id } })
      if (!current || current.reminderPendingTokenHash !== access.tokenHash) throw new ApiError("تغيّرت محاولة التذكير قبل اعتمادها", 409, "FEEDBACK_REMINDER_PREPARATION_CHANGED")
      const nextCount = current.reminderCount + 1
      const keepSchedule = current.reminderScheduleEnabled && nextCount < FEEDBACK_REMINDER_MAX_COUNT
      await tx.projectFeedback.update({
        where: { id: prepared.id },
        data: {
          publicTokenHash: access.tokenHash,
          publicExpiresAt: access.expiresAt,
          publicRevokedAt: null,
          publicIssuedAt: now,
          reminderProviderId: providerId,
          reminderPreparedAt: null,
          reminderSentAt: now,
          reminderFailedAt: null,
          reminderFailureReason: null,
          reminderCount: { increment: 1 },
          reminderPendingTokenHash: null,
          reminderPendingExpiresAt: null,
          reminderScheduleEnabled: keepSchedule,
          reminderNextAt: keepSchedule ? new Date(now.getTime() + FEEDBACK_REMINDER_COOLDOWN_MS) : null,
        },
      })
      await logActivity({
        db: tx,
        companyId,
        userId,
        action: source === "SCHEDULED" ? ActivityAction.PROJECT_FEEDBACK_SCHEDULED_REMINDER_SENT : ActivityAction.PROJECT_FEEDBACK_REMINDER_SENT,
        entityType: "ProjectFeedback",
        entityId: prepared.id,
        message: `${source === "SCHEDULED" ? "تم إرسال التذكير المجدول" : "تم إرسال تذكير"} تقييم مشروع ${projectName}`,
        metadata: { projectId, reminderNumber: nextCount, providerId, expiresAt: access.expiresAt.toISOString(), linkRotated: true, source, scheduleContinues: keepSchedule },
        ...requestMeta,
      })
    }, { isolationLevel: "Serializable" })
  } catch (error) {
    const reason = (error instanceof Error ? error.message : "UNKNOWN_EMAIL_FAILURE").slice(0, 500)
    await prisma.$transaction(async (tx) => {
      await tx.projectFeedback.updateMany({
        where: { id: prepared.id, reminderPendingTokenHash: access.tokenHash },
        data: {
          reminderPreparedAt: null,
          reminderPendingTokenHash: null,
          reminderPendingExpiresAt: null,
          reminderFailedAt: now,
          reminderFailureReason: reason,
          ...(source === "SCHEDULED" ? { reminderScheduleEnabled: false, reminderNextAt: null, reminderScheduleUpdatedAt: now } : {}),
        },
      })
      await logActivity({
        db: tx,
        companyId,
        userId,
        action: source === "SCHEDULED" ? ActivityAction.PROJECT_FEEDBACK_SCHEDULED_REMINDER_FAILED : ActivityAction.PROJECT_FEEDBACK_REMINDER_FAILED,
        entityType: "ProjectFeedback",
        entityId: prepared.id,
        message: `${source === "SCHEDULED" ? "فشل التذكير المجدول" : "فشل إرسال تذكير"} تقييم مشروع ${projectName}`,
        metadata: { projectId, activeLinkPreserved: true, failureReason: reason, source, scheduleStopped: source === "SCHEDULED" },
        ...requestMeta,
      })
    })
    throw new ApiError("تعذر إرسال التذكير. بقي الرابط السابق فعالًا.", 502, "FEEDBACK_REMINDER_FAILED")
  }
  return { sent: true, reminderNumber: prepared.reminderCount + 1, expiresAt: access.expiresAt.toISOString() }
}
