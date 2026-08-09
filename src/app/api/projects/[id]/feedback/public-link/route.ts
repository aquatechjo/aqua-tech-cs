import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { FEEDBACK_PUBLIC_LINK_DAYS, publicFeedbackPath } from "@/lib/project-feedback"
import { createFeedbackPublicAccess } from "@/lib/project-feedback-public-server"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ISSUE"), validDays: z.number().int().min(1).max(30).default(FEEDBACK_PUBLIC_LINK_DAYS) }),
  z.object({ action: z.literal("REVOKE") }),
])

async function manage(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = inputSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError("بيانات رابط التقييم غير صحيحة", 400, "INVALID_FEEDBACK_LINK_INPUT")
  const meta = await getRequestMeta()
  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.project.findFirst({ where: { id: projectId, companyId: user.companyId }, include: { closure: true, feedback: true, members: { where: { role: { in: ["PROJECT_LEAD", "MANAGER"] }, employeeProfile: { status: "ACTIVE", user: { isActive: true } } }, orderBy: { createdAt: "asc" }, include: { employeeProfile: { select: { userId: true } } } } } })
    if (!current) throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
    if (!current.closure || !["COMPLETED", "ARCHIVED"].includes(current.closure.status)) throw new ApiError("اعتمد إغلاق المشروع أولًا", 409, "FEEDBACK_LINK_REQUIRES_CLOSURE")
    if (current.feedback?.publicSubmittedAt || current.feedback?.receivedAt) throw new ApiError("تم تسجيل تقييم هذا المشروع مسبقًا", 409, "PROJECT_FEEDBACK_ALREADY_RECEIVED")
    const ownerId = current.feedback?.ownerId || current.members[0]?.employeeProfile.userId
    if (parsed.data.action === "ISSUE" && !ownerId) throw new ApiError("عيّن قائدًا أو مديرًا نشطًا للمشروع قبل إصدار الرابط", 409, "FEEDBACK_OWNER_REQUIRED")
    if (parsed.data.action === "ISSUE") {
      const access = createFeedbackPublicAccess(now, parsed.data.validDays)
      const feedback = await tx.projectFeedback.upsert({ where: { projectId }, create: { companyId: user.companyId, projectId, ownerId, status: "PENDING", publicTokenHash: access.tokenHash, publicExpiresAt: access.expiresAt, publicIssuedAt: now }, update: { ownerId, publicTokenHash: access.tokenHash, publicExpiresAt: access.expiresAt, publicRevokedAt: null, publicIssuedAt: now } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_LINK_ISSUED, entityType: "ProjectFeedback", entityId: feedback.id, message: `تم إصدار رابط تقييم مشروع ${project.name}`, metadata: { projectId, expiresAt: access.expiresAt.toISOString(), rotated: Boolean(current.feedback?.publicTokenHash) }, ...meta })
      return { active: true, path: publicFeedbackPath(access.token), expiresAt: access.expiresAt.toISOString() }
    }
    if (current.feedback) await tx.projectFeedback.update({ where: { id: current.feedback.id }, data: { publicTokenHash: null, publicExpiresAt: null, publicRevokedAt: now } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_LINK_REVOKED, entityType: "ProjectFeedback", entityId: current.feedback?.id, message: `تم إلغاء رابط تقييم مشروع ${project.name}`, metadata: { projectId }, ...meta })
    return { active: false, path: null, expiresAt: null }
  }, { isolationLevel: "Serializable" })
  return ok(result)
}

export const POST = withApiHandler("PROJECT_FEEDBACK_LINK_ERROR", manage, "تعذر إدارة رابط تقييم العميل")
