import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  FEEDBACK_REMINDER_MAX_COUNT,
  feedbackReminderScheduleSchema,
  nextFeedbackReminderAt,
} from "@/lib/project-feedback-reminder"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

async function updateSchedule(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = feedbackReminderScheduleSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("إعداد الجدولة غير صالح", 400, "INVALID_FEEDBACK_REMINDER_SCHEDULE", { details: parsed.error.flatten() })
  const now = new Date()
  const meta = await getRequestMeta()
  const feedback = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "projectId" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.projectFeedback.findFirst({ where: { projectId, companyId: user.companyId } })
    if (!current || !current.deliverySentAt) throw new ApiError("أرسل الدعوة الأساسية أولًا", 409, "FEEDBACK_INVITATION_REQUIRED")
    if (parsed.data.enabled) {
      if (current.receivedAt || current.publicSubmittedAt) throw new ApiError("تم استلام التقييم ولا يمكن تفعيل الجدولة", 409, "PROJECT_FEEDBACK_ALREADY_RECEIVED")
      if (!current.publicTokenHash || !current.publicExpiresAt || current.publicRevokedAt || current.publicExpiresAt <= now) throw new ApiError("رابط التقييم غير نشط", 409, "FEEDBACK_LINK_NOT_ACTIVE")
      if (current.reminderCount >= FEEDBACK_REMINDER_MAX_COUNT) throw new ApiError("تم بلوغ الحد الأقصى للتذكيرات", 409, "FEEDBACK_REMINDER_LIMIT_REACHED")
    }
    const lastContactAt = current.reminderSentAt ?? current.deliverySentAt
    const updated = await tx.projectFeedback.update({
      where: { id: current.id },
      data: {
        reminderScheduleEnabled: parsed.data.enabled,
        reminderNextAt: parsed.data.enabled ? nextFeedbackReminderAt(lastContactAt, now) : null,
        reminderScheduleUpdatedAt: now,
      },
    })
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: parsed.data.enabled ? ActivityAction.PROJECT_FEEDBACK_SCHEDULE_ENABLED : ActivityAction.PROJECT_FEEDBACK_SCHEDULE_DISABLED,
      entityType: "ProjectFeedback",
      entityId: current.id,
      message: `${parsed.data.enabled ? "تم تفعيل" : "تم إيقاف"} جدولة تذكيرات تقييم مشروع ${project.name}`,
      metadata: { projectId, nextAt: updated.reminderNextAt?.toISOString() ?? null },
      ...meta,
    })
    return updated
  }, { isolationLevel: "Serializable" })
  return ok({ enabled: feedback.reminderScheduleEnabled, nextAt: feedback.reminderNextAt?.toISOString() ?? null })
}

export const POST = withApiHandler("PROJECT_FEEDBACK_REMINDER_SCHEDULE_ERROR", updateSchedule, "تعذر تحديث جدولة التذكير")
