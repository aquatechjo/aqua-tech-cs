import { ActivityAction } from "@/generated/prisma/enums"
import {
  assertCanApproveProjectChange,
} from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  projectChangeActionIssues,
  projectChangeMutationSchema,
  projectChangeResultSourceRef,
  projectChangeTargetIssues,
} from "@/lib/project-change-request"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import {
  normalizeProjectChangeItems,
  nullableProjectChangeText,
} from "@/lib/project-change-request-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

function sameInstant(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime()
}

async function updateProjectChangeRequest(
  request: Request,
  context: {
    params: Promise<{ id: string; changeRequestId: string }>
  },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, changeRequestId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectChangeMutationSchema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات طلب التغيير غير صحيحة",
      400,
      "INVALID_PROJECT_CHANGE_REQUEST_INPUT",
      { details: parsed.error.flatten() },
    )
  }

  const meta = await getRequestMeta()
  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Project"
        WHERE "id" = ${projectId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      await tx.$queryRaw`
        SELECT "id"
        FROM "ProjectChangeRequest"
        WHERE "id" = ${changeRequestId}
          AND "projectId" = ${projectId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const existing = await tx.projectChangeRequest.findFirst({
        where: {
          id: changeRequestId,
          projectId,
          companyId: user.companyId,
        },
        include: {
          project: { select: { id: true, status: true } },
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      })
      if (!existing) {
        throw new ApiError(
          "طلب تغيير المشروع غير موجود",
          404,
          "PROJECT_CHANGE_REQUEST_NOT_FOUND",
        )
      }

      if (parsed.data.action === "UPDATE_DRAFT") {
        if (!["DRAFT", "CHANGES_REQUESTED"].includes(existing.status)) {
          throw new ApiError(
            "يمكن تعديل طلب التغيير أثناء المسودة أو بعد طلب تعديلات فقط",
            409,
            "PROJECT_CHANGE_REQUEST_LOCKED",
          )
        }
        if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(existing.project.status)) {
          throw new ApiError(
            "لا يمكن تعديل طلب تغيير لمشروع مغلق",
            409,
            "PROJECT_CHANGE_PROJECT_CLOSED",
          )
        }

        const items = await normalizeProjectChangeItems(tx, {
          companyId: user.companyId,
          projectId,
          items: parsed.data.items,
        })

        await tx.projectChangeRequestItem.deleteMany({
          where: { changeRequestId: existing.id },
        })
        await tx.projectChangeRequestItem.createMany({
          data: items.map((item) => ({
            ...item,
            changeRequestId: existing.id,
          })),
        })

        const updated = await tx.projectChangeRequest.update({
          where: { id: existing.id },
          data: {
            title: parsed.data.title,
            businessReason: parsed.data.businessReason,
            scheduleImpactDays: parsed.data.scheduleImpactDays,
            commercialImpact: parsed.data.commercialImpact,
            commercialReference:
              parsed.data.commercialImpact === "APPROVED"
                ? nullableProjectChangeText(
                    parsed.data.commercialReference,
                  )
                : null,
            financialAmount:
              parsed.data.commercialImpact === "NONE"
                ? null
                : parsed.data.financialAmount,
            financialCurrency:
              parsed.data.commercialImpact === "NONE"
                ? null
                : parsed.data.financialCurrency,
            financialApprovalStatus:
              parsed.data.commercialImpact === "NONE"
                ? "NOT_REQUIRED"
                : "PENDING",
            financialApprovalReference: null,
            financialApprovalNotes: null,
            financialApprovedById: null,
            financialApprovedAt: null,
            clientApprovalRequired: parsed.data.clientApprovalRequired,
            clientApprovalReference: parsed.data.clientApprovalRequired
              ? nullableProjectChangeText(
                  parsed.data.clientApprovalReference,
                )
              : null,
            status: "DRAFT",
            reviewedById: null,
            reviewNotes: null,
            changesRequestedAt: null,
            approvedAt: null,
            rejectedAt: null,
          },
          include: {
            createdBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
            appliedBy: { select: { id: true, name: true } },
            items: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              include: {
                phase: { select: { id: true, name: true } },
                targetDeliverable: { select: { id: true, title: true } },
                resultDeliverable: { select: { id: true, title: true } },
              },
            },
          },
        })

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_CHANGE_REQUEST_UPDATED,
          entityType: "ProjectChangeRequest",
          entityId: existing.id,
          message: `تم تحديث طلب التغيير ${existing.requestNumber} لمشروع ${project.name}`,
          metadata: {
            projectId,
            requestNumber: existing.requestNumber,
            itemCount: items.length,
          },
          ...meta,
        })

        return updated
      }

      if (
        ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(
          existing.project.status,
        ) &&
        ["SUBMIT", "REQUEST_CHANGES", "APPROVE"].includes(
          parsed.data.action,
        )
      ) {
        throw new ApiError(
          "لا يمكن دفع طلب تغيير جديد إلى الاعتماد بعد إغلاق المشروع",
          409,
          "PROJECT_CHANGE_PROJECT_CLOSED",
        )
      }

      const clientApprovalReference = existing.clientApprovalRequired
        ? parsed.data.action === "APPROVE"
          ? nullableProjectChangeText(
              parsed.data.clientApprovalReference ??
                existing.clientApprovalReference,
            )
          : existing.clientApprovalReference
        : null
      const issues = projectChangeActionIssues({
        status: existing.status,
        action: parsed.data.action,
        itemCount: existing.items.length,
        clientApprovalRequired: existing.clientApprovalRequired,
        clientApprovalReference,
        commercialImpact: existing.commercialImpact,
        commercialReference: existing.commercialReference,
        financialApprovalStatus: existing.financialApprovalStatus,
      })
      if (issues.length > 0) {
        throw new ApiError(
          issues[0],
          409,
          "PROJECT_CHANGE_TRANSITION_BLOCKED",
          { details: issues },
        )
      }

      if (
        ["REQUEST_CHANGES", "APPROVE", "REJECT"].includes(
          parsed.data.action,
        )
      ) {
        assertCanApproveProjectChange(user, existing.createdById)
      }

      const now = new Date()

      if (parsed.data.action === "APPLY") {
        if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(existing.project.status)) {
          throw new ApiError(
            "لا يمكن تطبيق تغيير على مشروع مغلق",
            409,
            "PROJECT_CHANGE_PROJECT_CLOSED",
          )
        }

        for (const item of existing.items) {
          if (item.action === "ADD_DELIVERABLE") {
            const result = await tx.projectDeliverable.create({
              data: {
                companyId: user.companyId,
                projectId,
                phaseId: item.phaseId,
                createdById: user.id,
                updatedById: user.id,
                title: item.title ?? "تسليم جديد",
                description: item.description,
                acceptanceCriteria: item.acceptanceCriteria,
                status: "PLANNED",
                source: "CHANGE_REQUEST",
                sourceRef: projectChangeResultSourceRef(
                  existing.id,
                  item.id,
                ),
                sortOrder: item.sortOrder,
                dueDate: item.dueDate,
              },
            })
            await tx.projectChangeRequestItem.update({
              where: { id: item.id },
              data: { resultDeliverableId: result.id },
            })
            await logActivity({
              db: tx,
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.PROJECT_DELIVERABLE_CREATED,
              entityType: "ProjectDeliverable",
              entityId: result.id,
              message: `تمت إضافة تسليم عبر طلب التغيير ${existing.requestNumber}: ${result.title}`,
              metadata: {
                projectId,
                changeRequestId: existing.id,
                changeRequestItemId: item.id,
              },
              ...meta,
            })
            continue
          }

          if (!item.targetDeliverableId) {
            throw new ApiError(
              "يفتقد بند التغيير التسليم المستهدف",
              409,
              "PROJECT_CHANGE_TARGET_MISSING",
            )
          }

          await tx.$queryRaw`
            SELECT "id"
            FROM "ProjectDeliverable"
            WHERE "id" = ${item.targetDeliverableId}
              AND "projectId" = ${projectId}
              AND "companyId" = ${user.companyId}
            FOR UPDATE
          `
          const target = await tx.projectDeliverable.findFirst({
            where: {
              id: item.targetDeliverableId,
              projectId,
              companyId: user.companyId,
            },
          })
          const targetIssues = projectChangeTargetIssues({
            action: item.action,
            targetStatus: target?.status,
          })
          if (targetIssues.length > 0 || !target) {
            throw new ApiError(
              targetIssues[0] ?? "التسليم المستهدف غير موجود",
              409,
              "PROJECT_CHANGE_TARGET_BLOCKED",
            )
          }
          if (!sameInstant(target.updatedAt, item.targetUpdatedAt)) {
            throw new ApiError(
              `تغير التسليم ${target.title} بعد إعداد الطلب؛ أعد الطلب للمسودة وحدّثه قبل التطبيق`,
              409,
              "PROJECT_CHANGE_TARGET_STALE",
            )
          }

          if (item.action === "CANCEL_DELIVERABLE") {
            const result = await tx.projectDeliverable.update({
              where: { id: target.id },
              data: {
                status: "CANCELLED",
                updatedById: user.id,
                decidedById: user.id,
                decidedAt: now,
                reviewNotes: item.reason,
                acceptanceReference: null,
              },
            })
            await tx.projectChangeRequestItem.update({
              where: { id: item.id },
              data: { resultDeliverableId: result.id },
            })
            await logActivity({
              db: tx,
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.PROJECT_DELIVERABLE_STATUS_CHANGED,
              entityType: "ProjectDeliverable",
              entityId: result.id,
              message: `تم إلغاء تسليم عبر طلب التغيير ${existing.requestNumber}: ${result.title}`,
              metadata: {
                projectId,
                changeRequestId: existing.id,
                previousStatus: target.status,
                status: result.status,
                reason: item.reason,
              },
              ...meta,
            })
            continue
          }

          const result = await tx.projectDeliverable.update({
            where: { id: target.id },
            data: {
              title: item.title ?? target.title,
              description: item.description,
              acceptanceCriteria: item.acceptanceCriteria,
              phaseId: item.phaseId,
              dueDate: item.dueDate,
              sortOrder: item.sortOrder,
              status:
                target.status === "PLANNED"
                  ? "PLANNED"
                  : "IN_PROGRESS",
              submittedAt: null,
              decidedAt: null,
              decidedById: null,
              reviewNotes: null,
              acceptanceReference: null,
              updatedById: user.id,
            },
          })
          await tx.projectChangeRequestItem.update({
            where: { id: item.id },
            data: { resultDeliverableId: result.id },
          })
          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.PROJECT_DELIVERABLE_UPDATED,
            entityType: "ProjectDeliverable",
            entityId: result.id,
            message: `تم تعديل تسليم عبر طلب التغيير ${existing.requestNumber}: ${result.title}`,
            metadata: {
              projectId,
              changeRequestId: existing.id,
              previousTitle: target.title,
              title: result.title,
              previousStatus: target.status,
              status: result.status,
            },
            ...meta,
          })
        }
      }

      const transition = {
        SUBMIT: {
          status: "IN_REVIEW" as const,
          submittedAt: existing.submittedAt ?? now,
          reviewedById: null,
          reviewNotes: null,
        },
        REQUEST_CHANGES: {
          status: "CHANGES_REQUESTED" as const,
          reviewedById: user.id,
          reviewNotes: parsed.data.action === "REQUEST_CHANGES"
            ? parsed.data.reviewNotes
            : null,
          changesRequestedAt: now,
        },
        APPROVE: {
          status: "APPROVED" as const,
          reviewedById: user.id,
          reviewNotes: parsed.data.action === "APPROVE"
            ? nullableProjectChangeText(parsed.data.reviewNotes)
            : null,
          clientApprovalReference,
          approvedAt: now,
        },
        REJECT: {
          status: "REJECTED" as const,
          reviewedById: user.id,
          reviewNotes: parsed.data.action === "REJECT"
            ? parsed.data.reviewNotes
            : null,
          rejectedAt: now,
        },
        APPLY: {
          status: "APPLIED" as const,
          appliedById: user.id,
          appliedAt: now,
        },
        CANCEL: {
          status: "CANCELLED" as const,
          reviewNotes: parsed.data.action === "CANCEL"
            ? parsed.data.reviewNotes
            : null,
          cancelledAt: now,
        },
      }[parsed.data.action]

      const updated = await tx.projectChangeRequest.update({
        where: { id: existing.id },
        data: transition,
        include: {
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          appliedBy: { select: { id: true, name: true } },
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              phase: { select: { id: true, name: true } },
              targetDeliverable: { select: { id: true, title: true } },
              resultDeliverable: { select: { id: true, title: true } },
            },
          },
        },
      })

      const activityByAction = {
        SUBMIT: ActivityAction.PROJECT_CHANGE_REQUEST_SUBMITTED,
        REQUEST_CHANGES:
          ActivityAction.PROJECT_CHANGE_REQUEST_CHANGES_REQUESTED,
        APPROVE: ActivityAction.PROJECT_CHANGE_REQUEST_APPROVED,
        REJECT: ActivityAction.PROJECT_CHANGE_REQUEST_REJECTED,
        APPLY: ActivityAction.PROJECT_CHANGE_REQUEST_APPLIED,
        CANCEL: ActivityAction.PROJECT_CHANGE_REQUEST_CANCELLED,
      } as const

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: activityByAction[parsed.data.action],
        entityType: "ProjectChangeRequest",
        entityId: existing.id,
        message: `تم تحديث حالة طلب التغيير ${existing.requestNumber} في مشروع ${project.name}`,
        metadata: {
          projectId,
          requestNumber: existing.requestNumber,
          previousStatus: existing.status,
          status: updated.status,
          reviewNotes: updated.reviewNotes,
          clientApprovalReference: updated.clientApprovalReference,
        },
        ...meta,
      })

      return updated
    },
    { isolationLevel: "Serializable" },
  )

  return ok({ changeRequest: saved })
}

export const PATCH = withApiHandler(
  "PROJECT_CHANGE_REQUEST_PATCH_ERROR",
  updateProjectChangeRequest,
  "تعذر تحديث طلب تغيير المشروع",
)
