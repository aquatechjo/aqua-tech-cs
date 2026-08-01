import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { nextDocumentNumber } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import {
  assertGovernanceActionAllowed,
  projectGovernanceMutationSchema,
} from "@/lib/project-governance"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

async function projectOwnerId(
  db: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  ownerUserId: string | null | undefined,
) {
  if (!ownerUserId) return null
  const member = await db.projectMember.findFirst({
    where: {
      companyId,
      projectId,
      employeeProfile: {
        userId: ownerUserId,
        status: "ACTIVE",
        user: { isActive: true },
      },
    },
    select: { id: true },
  })
  if (!member) {
    throw new ApiError(
      "يجب أن يكون مسؤول السجل عضوًا نشطًا في المشروع",
      400,
      "PROJECT_GOVERNANCE_OWNER_INVALID",
    )
  }
  return ownerUserId
}

const governanceInclude = {
  ownerUser: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  sourceRisk: { select: { id: true, referenceNumber: true, title: true } },
  materializedIssue: {
    select: { id: true, referenceNumber: true, title: true },
  },
  supersedesDecision: {
    select: { id: true, referenceNumber: true, title: true },
  },
  supersededByDecision: {
    select: { id: true, referenceNumber: true, title: true },
  },
} as const

async function updateProjectGovernanceItem(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, itemId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectGovernanceMutationSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات سجل الحوكمة غير صحيحة",
      400,
      "INVALID_PROJECT_GOVERNANCE_INPUT",
      { details: parsed.error.flatten() },
    )
  }

  const meta = await getRequestMeta()
  const result = await prisma.$transaction(
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
        FROM "ProjectGovernanceItem"
        WHERE "id" = ${itemId}
          AND "projectId" = ${projectId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const existing = await tx.projectGovernanceItem.findFirst({
        where: { id: itemId, projectId, companyId: user.companyId },
        include: {
          project: {
            select: {
              status: true,
              company: { select: { timezone: true } },
            },
          },
          materializedIssue: { select: { id: true } },
          supersededByDecision: { select: { id: true } },
        },
      })
      if (!existing) {
        throw new ApiError(
          "سجل حوكمة المشروع غير موجود",
          404,
          "PROJECT_GOVERNANCE_NOT_FOUND",
        )
      }
      if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(existing.project.status)) {
        throw new ApiError(
          "لا يمكن تعديل سجل حوكمة لمشروع مغلق",
          409,
          "PROJECT_GOVERNANCE_PROJECT_CLOSED",
        )
      }

      try {
        assertGovernanceActionAllowed(
          existing.kind,
          existing.status,
          parsed.data.action,
        )
      } catch {
        throw new ApiError(
          "هذا الإجراء غير متاح للحالة الحالية",
          409,
          "PROJECT_GOVERNANCE_ACTION_NOT_ALLOWED",
        )
      }

      const input = parsed.data
      let saved
      let activityAction: ActivityAction
      let activityMessage: string
      let relatedItemId: string | null = null

      if (input.action === "UPDATE_RISK") {
        const ownerUserId = await projectOwnerId(
          tx,
          user.companyId,
          projectId,
          input.ownerUserId,
        )
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            ownerUserId,
            updatedById: user.id,
            status: input.status,
            title: input.title,
            description: input.description,
            probability: input.probability,
            impact: input.impact,
            responsePlan: input.responsePlan,
            contingencyPlan: nullableText(input.contingencyPlan),
            trigger: nullableText(input.trigger),
            dueDate: input.dueDate ? dateKeyToUtc(input.dueDate) : null,
            closureNote: null,
            closedAt: null,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_RISK_UPDATED
        activityMessage = `تم تحديث الخطر ${existing.referenceNumber}`
      } else if (input.action === "MATERIALIZE_RISK") {
        if (existing.materializedIssue) {
          throw new ApiError(
            "تم تحويل هذا الخطر إلى مشكلة سابقًا",
            409,
            "PROJECT_RISK_ALREADY_MATERIALIZED",
          )
        }
        const ownerUserId = await projectOwnerId(
          tx,
          user.companyId,
          projectId,
          input.ownerUserId,
        )
        const issueReference = await nextDocumentNumber(
          tx,
          user.companyId,
          "ISS",
          new Date(),
          existing.project.company.timezone,
        )
        const issue = await tx.projectGovernanceItem.create({
          data: {
            companyId: user.companyId,
            projectId,
            ownerUserId,
            createdById: user.id,
            updatedById: user.id,
            sourceRiskId: existing.id,
            referenceNumber: issueReference,
            kind: "ISSUE",
            status: "OPEN",
            title: input.issueTitle,
            description: input.issueDescription,
            severity: input.severity,
            dueDate: input.dueDate ? dateKeyToUtc(input.dueDate) : null,
          },
        })
        relatedItemId = issue.id
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: { status: "MATERIALIZED", updatedById: user.id },
          include: governanceInclude,
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_ISSUE_CREATED,
          entityType: "ProjectGovernanceItem",
          entityId: issue.id,
          message: `تم إنشاء المشكلة ${issueReference} من الخطر ${existing.referenceNumber}`,
          metadata: { projectId, sourceRiskId: existing.id },
          ...meta,
        })
        activityAction = ActivityAction.PROJECT_RISK_MATERIALIZED
        activityMessage = `تحول الخطر ${existing.referenceNumber} إلى المشكلة ${issueReference}`
      } else if (input.action === "CLOSE_RISK") {
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            status: "CLOSED",
            closureNote: input.closureNote,
            closedAt: new Date(),
            updatedById: user.id,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_RISK_CLOSED
        activityMessage = `تم إغلاق الخطر ${existing.referenceNumber}`
      } else if (input.action === "REOPEN_RISK") {
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            status: "OPEN",
            closureNote: null,
            closedAt: null,
            updatedById: user.id,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_RISK_REOPENED
        activityMessage = `تمت إعادة فتح الخطر ${existing.referenceNumber}`
      } else if (input.action === "UPDATE_ISSUE") {
        const ownerUserId = await projectOwnerId(
          tx,
          user.companyId,
          projectId,
          input.ownerUserId,
        )
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            ownerUserId,
            updatedById: user.id,
            status: input.status,
            title: input.title,
            description: input.description,
            severity: input.severity,
            dueDate: input.dueDate ? dateKeyToUtc(input.dueDate) : null,
            resolution: null,
            resolvedAt: null,
            closureNote: null,
            closedAt: null,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_ISSUE_UPDATED
        activityMessage = `تم تحديث المشكلة ${existing.referenceNumber}`
      } else if (input.action === "RESOLVE_ISSUE") {
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            status: "RESOLVED",
            resolution: input.resolution,
            resolvedAt: new Date(),
            updatedById: user.id,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_ISSUE_RESOLVED
        activityMessage = `تم حل المشكلة ${existing.referenceNumber}`
      } else if (input.action === "CLOSE_ISSUE") {
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            status: "CLOSED",
            closureNote: input.closureNote,
            closedAt: new Date(),
            updatedById: user.id,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_ISSUE_CLOSED
        activityMessage = `تم إغلاق المشكلة ${existing.referenceNumber}`
      } else if (input.action === "REOPEN_ISSUE") {
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: {
            status: "OPEN",
            resolution: null,
            resolvedAt: null,
            closureNote: null,
            closedAt: null,
            updatedById: user.id,
          },
          include: governanceInclude,
        })
        activityAction = ActivityAction.PROJECT_ISSUE_REOPENED
        activityMessage = `تمت إعادة فتح المشكلة ${existing.referenceNumber}`
      } else {
        if (existing.supersededByDecision) {
          throw new ApiError(
            "تم استبدال هذا القرار سابقًا",
            409,
            "PROJECT_DECISION_ALREADY_SUPERSEDED",
          )
        }
        const referenceNumber = await nextDocumentNumber(
          tx,
          user.companyId,
          "DEC",
          new Date(),
          existing.project.company.timezone,
        )
        const replacement = await tx.projectGovernanceItem.create({
          data: {
            companyId: user.companyId,
            projectId,
            createdById: user.id,
            updatedById: user.id,
            decidedById: user.id,
            supersedesDecisionId: existing.id,
            referenceNumber,
            kind: "DECISION",
            status: "RECORDED",
            title: input.title,
            decision: input.decision,
            rationale: input.rationale,
            alternatives: nullableText(input.alternatives),
            impactSummary: nullableText(input.impactSummary),
            decidedAt: new Date(),
          },
        })
        relatedItemId = replacement.id
        saved = await tx.projectGovernanceItem.update({
          where: { id: existing.id },
          data: { status: "SUPERSEDED", updatedById: user.id },
          include: governanceInclude,
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_DECISION_RECORDED,
          entityType: "ProjectGovernanceItem",
          entityId: replacement.id,
          message: `تم تسجيل القرار البديل ${referenceNumber} في مشروع ${project.name}`,
          metadata: { projectId, supersedesDecisionId: existing.id },
          ...meta,
        })
        activityAction = ActivityAction.PROJECT_DECISION_SUPERSEDED
        activityMessage = `تم استبدال القرار ${existing.referenceNumber} بالقرار ${referenceNumber}`
      }

      const lifecycleNote =
        "note" in input
          ? input.note
          : "closureNote" in input
            ? input.closureNote
            : "resolution" in input
              ? input.resolution
              : null
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: activityAction,
        entityType: "ProjectGovernanceItem",
        entityId: existing.id,
        message: `${activityMessage} في مشروع ${project.name}`,
        metadata: {
          projectId,
          referenceNumber: existing.referenceNumber,
          relatedItemId,
          note: lifecycleNote,
        },
        ...meta,
      })

      return { item: saved, relatedItemId }
    },
    { isolationLevel: "Serializable" },
  )

  return ok(result)
}

export const PATCH = withApiHandler(
  "PROJECT_GOVERNANCE_PATCH_ERROR",
  updateProjectGovernanceItem,
  "تعذر تحديث سجل حوكمة المشروع",
)
