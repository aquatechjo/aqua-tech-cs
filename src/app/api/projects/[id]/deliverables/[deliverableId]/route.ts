import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  projectDeliverableNeedsActivation,
  projectDeliverableTransitionIssues,
  projectDeliverableUpdateSchema,
} from "@/lib/project-deliverable"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { assertProjectExecutionActivated } from "@/lib/project-readiness-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function updateProjectDeliverable(
  request: Request,
  context: {
    params: Promise<{ id: string; deliverableId: string }>
  },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, deliverableId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectDeliverableUpdateSchema.safeParse(body)

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
    await tx.$queryRaw`
      SELECT "id"
      FROM "ProjectDeliverable"
      WHERE "id" = ${deliverableId}
        AND "projectId" = ${projectId}
        AND "companyId" = ${user.companyId}
      FOR UPDATE
    `

    const existing = await tx.projectDeliverable.findFirst({
      where: {
        id: deliverableId,
        projectId,
        companyId: user.companyId,
      },
    })

    if (!existing) {
      throw new ApiError(
        "تسليم المشروع غير موجود",
        404,
        "PROJECT_DELIVERABLE_NOT_FOUND",
      )
    }

    if (parsed.data.action === "UPDATE_DETAILS") {
      if (["ACCEPTED", "CANCELLED"].includes(existing.status)) {
        throw new ApiError(
          "لا يمكن تعديل تفاصيل تسليم مغلق",
          409,
          "PROJECT_DELIVERABLE_CLOSED",
        )
      }

      if (existing.source !== "MANUAL") {
        throw new ApiError(
          "تفاصيل التسليم المرتبط بنطاق معتمد ثابتة؛ استخدم طلب تغيير جديد لتعديلها",
          409,
          "GOVERNED_DELIVERABLE_SCOPE_IMMUTABLE",
        )
      }

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

      const saved = await tx.projectDeliverable.update({
        where: { id: existing.id },
        data: {
          updatedById: user.id,
          ...(parsed.data.title !== undefined
            ? { title: parsed.data.title }
            : {}),
          ...(parsed.data.description !== undefined
            ? {
                description: nullableText(
                  parsed.data.description,
                ),
              }
            : {}),
          ...(parsed.data.acceptanceCriteria !== undefined
            ? {
                acceptanceCriteria: nullableText(
                  parsed.data.acceptanceCriteria,
                ),
              }
            : {}),
          ...(parsed.data.phaseId !== undefined
            ? { phaseId: parsed.data.phaseId ?? null }
            : {}),
          ...(parsed.data.dueDate !== undefined
            ? {
                dueDate: parsed.data.dueDate
                  ? dateKeyToUtc(parsed.data.dueDate)
                  : null,
              }
            : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
        },
        include: {
          phase: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_DELIVERABLE_UPDATED,
        entityType: "ProjectDeliverable",
        entityId: saved.id,
        message: `تم تحديث تسليم مشروع ${project.name}: ${saved.title}`,
        metadata: {
          projectId,
          phaseId: saved.phaseId,
          status: saved.status,
        },
        ...meta,
      })

      return saved
    }

    if (
      existing.source !== "MANUAL" &&
      parsed.data.status === "CANCELLED"
    ) {
      throw new ApiError(
        "إلغاء تسليم مرتبط بنطاق معتمد يحتاج طلب تغيير موثقًا",
        409,
        "GOVERNED_DELIVERABLE_CANCELLATION_REQUIRES_CHANGE_REQUEST",
      )
    }

    const issues = projectDeliverableTransitionIssues({
      currentStatus: existing.status,
      nextStatus: parsed.data.status,
      reviewNotes: parsed.data.reviewNotes,
      acceptanceReference: parsed.data.acceptanceReference,
    })
    if (issues.length > 0) {
      throw new ApiError(
        issues[0],
        409,
        "PROJECT_DELIVERABLE_TRANSITION_BLOCKED",
        { details: issues },
      )
    }

    if (projectDeliverableNeedsActivation(parsed.data.status)) {
      await assertProjectExecutionActivated(tx, {
        companyId: user.companyId,
        projectId,
      })
    }

    const now = new Date()
    const decisionStatus = [
      "CHANGES_REQUESTED",
      "ACCEPTED",
      "CANCELLED",
    ].includes(parsed.data.status)
    const saved = await tx.projectDeliverable.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        updatedById: user.id,
        submittedAt:
          parsed.data.status === "READY_FOR_REVIEW"
            ? existing.submittedAt ?? now
            : existing.submittedAt,
        decidedAt: decisionStatus ? now : null,
        decidedById: decisionStatus ? user.id : null,
        reviewNotes: nullableText(parsed.data.reviewNotes),
        acceptanceReference:
          parsed.data.status === "ACCEPTED"
            ? nullableText(parsed.data.acceptanceReference)
            : null,
      },
      include: {
        phase: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    })

    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_DELIVERABLE_STATUS_CHANGED,
      entityType: "ProjectDeliverable",
      entityId: saved.id,
      message: `تم تغيير حالة تسليم ${saved.title} في مشروع ${project.name}`,
      metadata: {
        projectId,
        previousStatus: existing.status,
        status: saved.status,
        acceptanceReference: saved.acceptanceReference,
        reviewNotes: saved.reviewNotes,
      },
      ...meta,
    })

    return saved
  })

  return ok({ deliverable })
}

async function deleteProjectDeliverable(
  request: Request,
  context: {
    params: Promise<{ id: string; deliverableId: string }>
  },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, deliverableId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const meta = await getRequestMeta()

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "ProjectDeliverable"
      WHERE "id" = ${deliverableId}
        AND "projectId" = ${projectId}
        AND "companyId" = ${user.companyId}
      FOR UPDATE
    `

    const existing = await tx.projectDeliverable.findFirst({
      where: {
        id: deliverableId,
        projectId,
        companyId: user.companyId,
      },
    })
    if (!existing) {
      throw new ApiError(
        "تسليم المشروع غير موجود",
        404,
        "PROJECT_DELIVERABLE_NOT_FOUND",
      )
    }
    if (existing.source !== "MANUAL") {
      throw new ApiError(
        "التسليم المرتبط بنطاق معتمد لا يُحذف؛ استخدم طلب تغيير موثقًا لإلغائه",
        409,
        "GOVERNED_DELIVERABLE_DELETE_BLOCKED",
      )
    }

    const changeReferenceCount =
      await tx.projectChangeRequestItem.count({
        where: {
          companyId: user.companyId,
          projectId,
          OR: [
            { targetDeliverableId: existing.id },
            { resultDeliverableId: existing.id },
          ],
        },
      })
    if (changeReferenceCount > 0) {
      throw new ApiError(
        "لا يمكن حذف تسليم مرتبط بطلب تغيير؛ ألغِ طلب التغيير أو استخدم طلبًا جديدًا",
        409,
        "PROJECT_DELIVERABLE_CHANGE_REFERENCE_BLOCKED",
      )
    }

    if (existing.status !== "PLANNED") {
      throw new ApiError(
        "يمكن حذف التسليم اليدوي قبل بدء العمل عليه فقط",
        409,
        "PROJECT_DELIVERABLE_DELETE_BLOCKED",
      )
    }

    await tx.projectDeliverable.delete({
      where: { id: existing.id },
    })
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.PROJECT_DELIVERABLE_REMOVED,
      entityType: "ProjectDeliverable",
      entityId: existing.id,
      message: `تم حذف تسليم مخطط من مشروع ${project.name}: ${existing.title}`,
      metadata: { projectId },
      ...meta,
    })
  })

  return ok({ deleted: true })
}

export const PATCH = withApiHandler(
  "PROJECT_DELIVERABLE_PATCH_ERROR",
  updateProjectDeliverable,
  "تعذر تحديث تسليم المشروع",
)

export const DELETE = withApiHandler(
  "PROJECT_DELIVERABLE_DELETE_ERROR",
  deleteProjectDeliverable,
  "تعذر حذف تسليم المشروع",
)
