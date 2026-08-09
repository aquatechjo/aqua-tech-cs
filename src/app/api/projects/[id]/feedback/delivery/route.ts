import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendProjectFeedbackInvitationEmail } from "@/lib/email"
import { FEEDBACK_PUBLIC_LINK_DAYS, publicFeedbackPath } from "@/lib/project-feedback"
import { createFeedbackPublicAccess } from "@/lib/project-feedback-public-server"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const inputSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  recipientEmail: z.string().trim().toLowerCase().email().max(254),
})

function publicOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim()
  const origin = configured ? new URL(configured).origin : new URL(request.url).origin
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) {
    throw new ApiError("عنوان التطبيق العام غير آمن", 500, "INVALID_PUBLIC_APP_URL")
  }
  return origin
}

function safeFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_EMAIL_FAILURE"
  return message.slice(0, 500)
}

async function deliver(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = inputSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("بيانات مستلم دعوة التقييم غير صحيحة", 400, "INVALID_FEEDBACK_RECIPIENT")
  const meta = await getRequestMeta()
  const now = new Date()
  const access = createFeedbackPublicAccess(now, FEEDBACK_PUBLIC_LINK_DAYS)
  const expiresAtLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { dateStyle: "long", timeZone: user.company.timezone }).format(access.expiresAt)

  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.project.findFirst({
      where: { id: projectId, companyId: user.companyId },
      include: {
        closure: true,
        feedback: true,
        members: {
          where: { role: { in: ["PROJECT_LEAD", "MANAGER"] }, employeeProfile: { status: "ACTIVE", user: { isActive: true } } },
          orderBy: { createdAt: "asc" },
          include: { employeeProfile: { select: { userId: true } } },
        },
      },
    })
    if (!current) throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
    if (!current.closure || !["COMPLETED", "ARCHIVED"].includes(current.closure.status)) throw new ApiError("اعتمد إغلاق المشروع أولًا", 409, "FEEDBACK_DELIVERY_REQUIRES_CLOSURE")
    if (current.feedback?.publicSubmittedAt || current.feedback?.receivedAt) throw new ApiError("تم تسجيل تقييم هذا المشروع مسبقًا", 409, "PROJECT_FEEDBACK_ALREADY_RECEIVED")
    const ownerId = current.feedback?.ownerId || current.members[0]?.employeeProfile.userId
    if (!ownerId) throw new ApiError("عيّن قائدًا أو مديرًا نشطًا للمشروع قبل إرسال الدعوة", 409, "FEEDBACK_OWNER_REQUIRED")
    const feedback = await tx.projectFeedback.upsert({
      where: { projectId },
      create: {
        companyId: user.companyId, projectId, ownerId, status: "PENDING",
        publicTokenHash: access.tokenHash, publicExpiresAt: access.expiresAt, publicIssuedAt: now,
        deliveryRecipientName: parsed.data.recipientName, deliveryRecipientEmail: parsed.data.recipientEmail,
        deliveryPreparedAt: now, deliveryFailedAt: null, deliveryFailureReason: null, deliveryAttemptCount: 1,
        reminderScheduleEnabled: false, reminderNextAt: null, reminderScheduleUpdatedAt: now,
      },
      update: {
        ownerId, publicTokenHash: access.tokenHash, publicExpiresAt: access.expiresAt, publicRevokedAt: null, publicIssuedAt: now,
        deliveryRecipientName: parsed.data.recipientName, deliveryRecipientEmail: parsed.data.recipientEmail,
        deliveryPreparedAt: now, deliveryFailedAt: null, deliveryFailureReason: null, deliveryAttemptCount: { increment: 1 },
        reminderScheduleEnabled: false, reminderNextAt: null, reminderScheduleUpdatedAt: now,
      },
    })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_DELIVERY_PREPARED, entityType: "ProjectFeedback", entityId: feedback.id, message: `تم تجهيز دعوة تقييم مشروع ${project.name}`, metadata: { projectId, recipientEmail: parsed.data.recipientEmail, expiresAt: access.expiresAt.toISOString() }, ...meta })
    return feedback
  }, { isolationLevel: "Serializable" })

  const feedbackUrl = new URL(publicFeedbackPath(access.token), publicOrigin(request)).toString()
  try {
    const providerId = await sendProjectFeedbackInvitationEmail({
      to: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName,
      projectName: project.name,
      feedbackUrl,
      validUntilLabel: expiresAtLabel,
    })
    await prisma.$transaction(async (tx) => {
      await tx.projectFeedback.update({ where: { id: prepared.id }, data: { deliveryProviderId: providerId, deliverySentAt: new Date(), deliveryFailedAt: null, deliveryFailureReason: null } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_SENT, entityType: "ProjectFeedback", entityId: prepared.id, message: `تم إرسال دعوة تقييم مشروع ${project.name}`, metadata: { projectId, recipientEmail: parsed.data.recipientEmail, providerId }, ...meta })
    })
  } catch (error) {
    const failureReason = safeFailureReason(error)
    await prisma.$transaction(async (tx) => {
      await tx.projectFeedback.update({ where: { id: prepared.id }, data: { publicTokenHash: null, publicExpiresAt: null, publicRevokedAt: new Date(), deliveryFailedAt: new Date(), deliveryFailureReason: failureReason } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_DELIVERY_FAILED, entityType: "ProjectFeedback", entityId: prepared.id, message: `فشل إرسال دعوة تقييم مشروع ${project.name}`, metadata: { projectId, recipientEmail: parsed.data.recipientEmail, failureReason }, ...meta })
    })
    throw new ApiError("تعذر إرسال دعوة التقييم. لم يبقَ الرابط الفاشل فعالًا.", 502, "FEEDBACK_DELIVERY_FAILED")
  }
  return ok({ sent: true, recipientEmail: parsed.data.recipientEmail, expiresAt: access.expiresAt.toISOString() })
}

export const POST = withApiHandler("PROJECT_FEEDBACK_DELIVERY_ERROR", deliver, "تعذر إرسال دعوة تقييم العميل")
