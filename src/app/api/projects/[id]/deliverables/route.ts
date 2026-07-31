import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { projectDeliverableCreateSchema } from "@/lib/project-deliverable"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function createProjectDeliverable(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectDeliverableCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات التسليم غير صحيحة",
      400,
      "INVALID_PROJECT_DELIVERABLE_INPUT",
      { details: parsed.error.flatten() },
    )
  }

  const meta = await getRequestMeta()
  const deliverable = await prisma.$transaction(async (tx) => {
    if (parsed.data.phaseId) {
      const phase = await tx.projectPhase.findFirst({
        where: {
          id: parsed.data.phaseId,
          projectId,
          companyId: user.companyId,
        },
        select: { id: true },
      })
      if (!phase) {
        throw new ApiError(
          "مرحلة التسليم غير موجودة داخل هذا المشروع",
          404,
          "PROJECT_DELIVERABLE_PHASE_NOT_FOUND",
        )
      }
    }

    const saved = await tx.projectDeliverable.create({
      data: {
        companyId: user.companyId,
        projectId,
        phaseId: parsed.data.phaseId ?? null,
        createdById: user.id,
        updatedById: user.id,
        title: parsed.data.title,
        description: nullableText(parsed.data.description),
        acceptanceCriteria: nullableText(
          parsed.data.acceptanceCriteria,
        ),
        source: "MANUAL",
        sortOrder: parsed.data.sortOrder ?? 0,
        dueDate: parsed.data.dueDate
          ? dateKeyToUtc(parsed.data.dueDate)
          : null,
      },
      include: {
        phase: { select: { id: true, name: true } },
      },
    })

    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_DELIVERABLE_CREATED,
      entityType: "ProjectDeliverable",
      entityId: saved.id,
      message: `تمت إضافة تسليم إلى مشروع ${project.name}: ${saved.title}`,
      metadata: {
        projectId,
        phaseId: saved.phaseId,
        source: saved.source,
      },
      ...meta,
    })

    return saved
  })

  return ok({ deliverable }, 201)
}

export const POST = withApiHandler(
  "PROJECT_DELIVERABLE_POST_ERROR",
  createProjectDeliverable,
  "تعذر إضافة تسليم المشروع",
)
