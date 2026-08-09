import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { assertFeedbackTransition, feedbackStatus, projectFeedbackMutationSchema } from "@/lib/project-feedback"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const nullable = (value: string | null | undefined) => value?.trim() || null

async function mutate(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = projectFeedbackMutationSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "بيانات التقييم غير صحيحة", 400, "INVALID_PROJECT_FEEDBACK_INPUT")
  const input = parsed.data
  const meta = await getRequestMeta()

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.project.findFirst({ where: { id: projectId, companyId: user.companyId }, include: { closure: true, feedback: true } })
    if (!current) throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
    if (!current.closure || !["COMPLETED", "ARCHIVED"].includes(current.closure.status)) throw new ApiError("لا يسجل تقييم العميل قبل اعتماد إغلاق المشروع", 409, "PROJECT_FEEDBACK_REQUIRES_CLOSURE")
    assertFeedbackTransition(current.feedback?.status ?? null, input.action)

    if (input.action === "RECORD") {
      if (input.ownerId) {
        const owner = await tx.projectMember.findFirst({ where: { projectId, employeeProfile: { userId: input.ownerId, companyId: user.companyId, status: "ACTIVE" } } })
        if (!owner) throw new ApiError("مالك المتابعة ليس عضوًا نشطًا في المشروع", 400, "INVALID_FEEDBACK_OWNER")
      }
      const status = feedbackStatus(input)
      const feedback = await tx.projectFeedback.upsert({ where: { projectId }, create: { companyId: user.companyId, projectId, recordedById: user.id, ownerId: input.ownerId || null, status, npsScore: input.npsScore, satisfactionScore: input.satisfactionScore, feedbackSummary: input.feedbackSummary, improvementNotes: nullable(input.improvementNotes), testimonial: nullable(input.testimonial), testimonialApproved: input.testimonialApproved, followUpRequired: input.followUpRequired, followUpAction: nullable(input.followUpAction), followUpDueAt: input.followUpDueAt ? new Date(input.followUpDueAt) : null, receivedAt: new Date() }, update: { recordedById: user.id, ownerId: input.ownerId || null, status, npsScore: input.npsScore, satisfactionScore: input.satisfactionScore, feedbackSummary: input.feedbackSummary, improvementNotes: nullable(input.improvementNotes), testimonial: nullable(input.testimonial), testimonialApproved: input.testimonialApproved, followUpRequired: input.followUpRequired, followUpAction: nullable(input.followUpAction), followUpDueAt: input.followUpDueAt ? new Date(input.followUpDueAt) : null, resolutionNote: null, resolvedById: null, resolvedAt: null, waivedAt: null, receivedAt: new Date() } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_FEEDBACK_RECORDED, entityType: "ProjectFeedback", entityId: feedback.id, message: `تم توثيق تقييم عميل مشروع ${project.name}`, metadata: { projectId, status, npsScore: input.npsScore }, ...meta })
      return feedback
    }

    const feedback = await tx.projectFeedback.update({ where: { projectId }, data: input.action === "RESOLVE" ? { status: "RESOLVED", resolutionNote: input.resolutionNote, resolvedById: user.id, resolvedAt: new Date() } : { status: "WAIVED", resolutionNote: input.resolutionNote, resolvedById: user.id, waivedAt: new Date() } })
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: input.action === "RESOLVE" ? ActivityAction.PROJECT_FEEDBACK_RESOLVED : ActivityAction.PROJECT_FEEDBACK_WAIVED, entityType: "ProjectFeedback", entityId: feedback.id, message: `تم إغلاق متابعة تقييم مشروع ${project.name}`, metadata: { projectId, status: feedback.status }, ...meta })
    return feedback
  }, { isolationLevel: "Serializable" })
  return ok({ feedback: result })
}

export const PATCH = withApiHandler("PROJECT_FEEDBACK_PATCH_ERROR", mutate, "تعذر تحديث تقييم العميل")
