import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendProjectFeedbackReminderEmail } from "@/lib/email"
import { FEEDBACK_PUBLIC_LINK_DAYS, publicFeedbackPath } from "@/lib/project-feedback"
import { createFeedbackPublicAccess } from "@/lib/project-feedback-public-server"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

const COOLDOWN_MS = 72 * 60 * 60 * 1000
const MAX_REMINDERS = 3
const PREPARATION_TIMEOUT_MS = 15 * 60 * 1000

function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim()
  const origin = configured ? new URL(configured).origin : new URL(request.url).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  return origin
}

async function remind(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const meta = await getRequestMeta()
  const now = new Date()
  const access = createFeedbackPublicAccess(now, FEEDBACK_PUBLIC_LINK_DAYS)
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "projectId" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const feedback = await tx.projectFeedback.findFirst({ where: { projectId, companyId: user.companyId } })
    if (!feedback || !feedback.deliveryRecipientName || !feedback.deliveryRecipientEmail || !feedback.deliverySentAt) throw new ApiError("أرسل الدعوة الأساسية أولًا", 409, "FEEDBACK_INVITATION_REQUIRED")
    if (feedback.receivedAt || feedback.publicSubmittedAt) throw new ApiError("تم استلام التقييم ولا حاجة للتذكير", 409, "PROJECT_FEEDBACK_ALREADY_RECEIVED")
    if (!feedback.publicTokenHash || !feedback.publicExpiresAt || feedback.publicRevokedAt || feedback.publicExpiresAt <= now) throw new ApiError("رابط التقييم غير نشط. أرسل دعوة جديدة أولًا.", 409, "FEEDBACK_LINK_NOT_ACTIVE")
    if (feedback.reminderCount >= MAX_REMINDERS) throw new ApiError("تم بلوغ الحد الأقصى للتذكيرات", 409, "FEEDBACK_REMINDER_LIMIT_REACHED")
    const lastContactAt = feedback.reminderSentAt ?? feedback.deliverySentAt
    if (now.getTime() - lastContactAt.getTime() < COOLDOWN_MS) throw new ApiError("يجب الانتظار 72 ساعة بين رسائل التقييم", 429, "FEEDBACK_REMINDER_COOLDOWN")
    if (feedback.reminderPreparedAt && now.getTime() - feedback.reminderPreparedAt.getTime() < PREPARATION_TIMEOUT_MS) throw new ApiError("توجد محاولة تذكير قيد الإرسال", 409, "FEEDBACK_REMINDER_IN_PROGRESS")
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

  const feedbackUrl = new URL(publicFeedbackPath(access.token), publicOrigin(request)).toString()
  const validUntilLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long", timeZone: user.company.timezone }).format(access.expiresAt)
  try {
    const providerId = await sendProjectFeedbackReminderEmail({ to: prepared.deliveryRecipientEmail!, recipientName: prepared.deliveryRecipientName!, projectName: project.name, feedbackUrl, validUntilLabel })
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "id" = ${prepared.id} FOR UPDATE`
      const current = await tx.projectFeedback.findUnique({ where: { id: prepared.id } })
      if (!current || current.reminderPendingTokenHash !== access.tokenHash) throw new ApiError("تغيّرت محاولة التذكير قبل اعتمادها", 409, "FEEDBACK_REMINDER_PREPARATION_CHANGED")
      await tx.projectFeedback.update({ where: { id: prepared.id }, data: { publicTokenHash: access.tokenHash, publicExpiresAt: access.expiresAt, publicRevokedAt: null, publicIssuedAt: now, reminderProviderId: providerId, reminderPreparedAt: null, reminderSentAt: now, reminderFailedAt: null, reminderFailureReason: null, reminderCount: { increment: 1 }, reminderPendingTokenHash: null, reminderPendingExpiresAt: null } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_REMINDER_SENT, entityType: "ProjectFeedback", entityId: prepared.id, message: `تم إرسال تذكير تقييم مشروع ${project.name}`, metadata: { projectId, reminderNumber: prepared.reminderCount + 1, providerId, expiresAt: access.expiresAt.toISOString(), linkRotated: true }, ...meta })
    }, { isolationLevel: "Serializable" })
  } catch (error) {
    const reason = (error instanceof Error ? error.message : "UNKNOWN_EMAIL_FAILURE").slice(0, 500)
    await prisma.$transaction(async (tx) => {
      await tx.projectFeedback.updateMany({ where: { id: prepared.id, reminderPendingTokenHash: access.tokenHash }, data: { reminderPreparedAt: null, reminderPendingTokenHash: null, reminderPendingExpiresAt: null, reminderFailedAt: now, reminderFailureReason: reason } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_REMINDER_FAILED, entityType: "ProjectFeedback", entityId: prepared.id, message: `فشل إرسال تذكير تقييم مشروع ${project.name}`, metadata: { projectId, activeLinkPreserved: true, failureReason: reason }, ...meta })
    })
    throw new ApiError("تعذر إرسال التذكير. بقي الرابط السابق فعالًا.", 502, "FEEDBACK_REMINDER_FAILED")
  }
  return ok({ sent: true, reminderNumber: prepared.reminderCount + 1, expiresAt: access.expiresAt.toISOString() })
}

export const POST = withApiHandler("PROJECT_FEEDBACK_REMINDER_ERROR", remind, "تعذر إرسال تذكير التقييم")
