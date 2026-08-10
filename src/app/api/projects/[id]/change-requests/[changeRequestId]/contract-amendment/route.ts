import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  contractAmendmentActionIssues,
  projectContractAmendmentMutationSchema,
} from "@/lib/project-contract-amendment"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

type Context = {
  params: Promise<{ id: string; changeRequestId: string }>
}

async function mutateContractAmendment(request: Request, context: Context) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId, changeRequestId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = projectContractAmendmentMutationSchema.safeParse(
    await readJsonBody(request),
  )
  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات ملحق العقد غير صحيحة",
      400,
      "INVALID_PROJECT_CONTRACT_AMENDMENT_INPUT",
    )
  }
  const meta = await getRequestMeta()
  const amendment = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "ProjectChangeRequest"
      WHERE "id" = ${changeRequestId}
        AND "projectId" = ${projectId}
        AND "companyId" = ${user.companyId}
      FOR UPDATE
    `
    const changeRequest = await tx.projectChangeRequest.findFirst({
      where: { id: changeRequestId, projectId, companyId: user.companyId },
      include: {
        contractAmendment: true,
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            action: true,
            title: true,
            description: true,
            acceptanceCriteria: true,
            reason: true,
            dueDate: true,
            sortOrder: true,
            phase: { select: { id: true, name: true } },
            targetDeliverable: { select: { id: true, title: true } },
          },
        },
      },
    })
    if (!changeRequest) {
      throw new ApiError("طلب التغيير غير موجود", 404, "PROJECT_CHANGE_REQUEST_NOT_FOUND")
    }
    if (parsed.data.action === "CREATE") {
      if (changeRequest.contractAmendment) {
        throw new ApiError("تم إنشاء ملحق لهذا الطلب مسبقًا", 409, "PROJECT_AMENDMENT_EXISTS")
      }
      if (
        changeRequest.status !== "APPROVED" ||
        changeRequest.commercialImpact === "NONE" ||
        changeRequest.financialApprovalStatus !== "APPROVED" ||
        !changeRequest.financialAmount ||
        !changeRequest.financialCurrency
      ) {
        throw new ApiError(
          "يلزم اعتماد طلب التغيير وأثره المالي قبل إنشاء الملحق",
          409,
          "PROJECT_AMENDMENT_CHANGE_NOT_APPROVED",
        )
      }
      const created = await tx.projectContractAmendment.create({
        data: {
          companyId: user.companyId,
          projectId,
          changeRequestId,
          createdById: user.id,
          amendmentNumber: `AMD-${changeRequest.requestNumber}`,
          titleSnapshot: changeRequest.title,
          reasonSnapshot: changeRequest.businessReason,
          itemsSnapshot: changeRequest.items.map((item) => ({
            ...item,
            dueDate: item.dueDate?.toISOString() ?? null,
          })),
          scheduleImpactDaysSnapshot: changeRequest.scheduleImpactDays,
          financialAmountSnapshot: changeRequest.financialAmount,
          financialCurrencySnapshot: changeRequest.financialCurrency,
          commercialReferenceSnapshot: changeRequest.commercialReference,
          internalNotes: parsed.data.internalNotes ?? null,
        },
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_AMENDMENT_CREATED,
        entityType: "ProjectContractAmendment",
        entityId: created.id,
        message: `تم إنشاء ملحق العقد ${created.amendmentNumber} لمشروع ${project.name}`,
        metadata: { projectId, changeRequestId, amendmentNumber: created.amendmentNumber },
        ...meta,
      })
      return created
    }

    const current = changeRequest.contractAmendment
    if (!current) {
      throw new ApiError("ملحق العقد غير موجود", 404, "PROJECT_AMENDMENT_NOT_FOUND")
    }
    await tx.$queryRaw`
      SELECT "id" FROM "ProjectContractAmendment"
      WHERE "id" = ${current.id} AND "companyId" = ${user.companyId}
      FOR UPDATE
    `
    if (
      parsed.data.action === "INTERNALLY_APPROVE" &&
      !hasRole(user.role, ACCESS_ROLES.projectChangeApproval)
    ) {
      throw new ApiError("لا تملك صلاحية اعتماد الملحق", 403, "PROJECT_AMENDMENT_APPROVAL_FORBIDDEN")
    }
    const issues = contractAmendmentActionIssues({
      status: current.status,
      action: parsed.data.action,
      creatorUserId: current.createdById,
      actor: user,
    })
    if (issues.length) {
      throw new ApiError(issues[0], 409, "PROJECT_AMENDMENT_TRANSITION_BLOCKED")
    }
    const now = new Date()
    const transition = {
      READY_FOR_REVIEW: {
        status: "READY_FOR_REVIEW" as const,
        readyAt: now,
      },
      INTERNALLY_APPROVE: {
        status: "INTERNALLY_APPROVED" as const,
        approvedById: user.id,
        internallyApprovedAt: now,
        approvalReference:
          parsed.data.action === "INTERNALLY_APPROVE" ? parsed.data.reference : null,
      },
      MARK_SENT: {
        status: "SENT" as const,
        sentById: user.id,
        sentAt: now,
        deliveryReference:
          parsed.data.action === "MARK_SENT" ? parsed.data.reference : null,
      },
      ACCEPT: {
        status: "ACCEPTED" as const,
        decidedById: user.id,
        decidedAt: now,
        clientDecisionReference:
          parsed.data.action === "ACCEPT" ? parsed.data.reference : null,
        clientDecisionNotes:
          parsed.data.action === "ACCEPT" ? parsed.data.notes ?? null : null,
      },
      REJECT: {
        status: "REJECTED" as const,
        decidedById: user.id,
        decidedAt: now,
        clientDecisionReference:
          parsed.data.action === "REJECT" ? parsed.data.reference : null,
        clientDecisionNotes:
          parsed.data.action === "REJECT" ? parsed.data.notes ?? null : null,
      },
    }[parsed.data.action]
    const updated = await tx.projectContractAmendment.update({
      where: { id: current.id },
      data: transition,
    })
    const activity = {
      READY_FOR_REVIEW: ActivityAction.PROJECT_AMENDMENT_READY_FOR_REVIEW,
      INTERNALLY_APPROVE: ActivityAction.PROJECT_AMENDMENT_INTERNALLY_APPROVED,
      MARK_SENT: ActivityAction.PROJECT_AMENDMENT_SENT,
      ACCEPT: ActivityAction.PROJECT_AMENDMENT_ACCEPTED,
      REJECT: ActivityAction.PROJECT_AMENDMENT_REJECTED,
    }[parsed.data.action]
    await logActivity({
      db: tx,
      companyId: user.companyId,
      userId: user.id,
      action: activity,
      entityType: "ProjectContractAmendment",
      entityId: updated.id,
      message: `تم تحديث ملحق العقد ${updated.amendmentNumber} إلى ${updated.status}`,
      metadata: { projectId, changeRequestId, previousStatus: current.status, status: updated.status },
      ...meta,
    })
    return updated
  }, { isolationLevel: "Serializable" })

  return ok({ amendment })
}

export const POST = withApiHandler(
  "PROJECT_AMENDMENT_CREATE_ERROR",
  mutateContractAmendment,
  "تعذر إنشاء ملحق العقد",
)
export const PATCH = withApiHandler(
  "PROJECT_AMENDMENT_PATCH_ERROR",
  mutateContractAmendment,
  "تعذر تحديث ملحق العقد",
)
