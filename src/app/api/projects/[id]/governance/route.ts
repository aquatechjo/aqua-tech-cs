import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { nextDocumentNumber } from "@/lib/finance-server"
import { prisma } from "@/lib/prisma"
import {
  projectGovernanceCreateSchema,
  projectGovernancePrefix,
} from "@/lib/project-governance"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc } from "@/lib/time"

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

async function assertProjectOwner(
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

async function createProjectGovernanceItem(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = projectGovernanceCreateSchema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(
      parsed.error.issues[0]?.message ?? "بيانات سجل الحوكمة غير صحيحة",
      400,
      "INVALID_PROJECT_GOVERNANCE_INPUT",
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

      const currentProject = await tx.project.findFirst({
        where: { id: projectId, companyId: user.companyId },
        select: {
          id: true,
          status: true,
          company: { select: { timezone: true } },
        },
      })
      if (!currentProject) {
        throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
      }
      if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(currentProject.status)) {
        throw new ApiError(
          "لا يمكن إضافة سجل حوكمة إلى مشروع مغلق",
          409,
          "PROJECT_GOVERNANCE_PROJECT_CLOSED",
        )
      }

      const ownerUserId =
        "ownerUserId" in parsed.data
          ? await assertProjectOwner(
              tx,
              user.companyId,
              projectId,
              parsed.data.ownerUserId,
            )
          : null

      let sourceRiskId: string | null = null
      if (parsed.data.kind === "ISSUE" && parsed.data.sourceRiskId) {
        await tx.$queryRaw`
          SELECT "id"
          FROM "ProjectGovernanceItem"
          WHERE "id" = ${parsed.data.sourceRiskId}
            AND "projectId" = ${projectId}
            AND "companyId" = ${user.companyId}
          FOR UPDATE
        `
        const sourceRisk = await tx.projectGovernanceItem.findFirst({
          where: {
            id: parsed.data.sourceRiskId,
            projectId,
            companyId: user.companyId,
            kind: "RISK",
            status: { in: ["OPEN", "MONITORING", "MITIGATED"] },
            materializedIssue: null,
          },
          select: { id: true, referenceNumber: true },
        })
        if (!sourceRisk) {
          throw new ApiError(
            "الخطر المصدر غير متاح أو تم تحويله إلى مشكلة سابقًا",
            409,
            "PROJECT_GOVERNANCE_SOURCE_RISK_INVALID",
          )
        }
        sourceRiskId = sourceRisk.id
      }

      let supersedesDecisionId: string | null = null
      if (
        parsed.data.kind === "DECISION" &&
        parsed.data.supersedesDecisionId
      ) {
        await tx.$queryRaw`
          SELECT "id"
          FROM "ProjectGovernanceItem"
          WHERE "id" = ${parsed.data.supersedesDecisionId}
            AND "projectId" = ${projectId}
            AND "companyId" = ${user.companyId}
          FOR UPDATE
        `
        const priorDecision = await tx.projectGovernanceItem.findFirst({
          where: {
            id: parsed.data.supersedesDecisionId,
            projectId,
            companyId: user.companyId,
            kind: "DECISION",
            status: "RECORDED",
            supersededByDecision: null,
          },
          select: { id: true, referenceNumber: true },
        })
        if (!priorDecision) {
          throw new ApiError(
            "القرار السابق غير متاح للاستبدال",
            409,
            "PROJECT_GOVERNANCE_DECISION_INVALID",
          )
        }
        supersedesDecisionId = priorDecision.id
      }

      const referenceNumber = await nextDocumentNumber(
        tx,
        user.companyId,
        projectGovernancePrefix(parsed.data.kind),
        new Date(),
        currentProject.company.timezone,
      )

      const data = parsed.data
      const item = await tx.projectGovernanceItem.create({
        data:
          data.kind === "RISK"
            ? {
                companyId: user.companyId,
                projectId,
                ownerUserId,
                createdById: user.id,
                updatedById: user.id,
                referenceNumber,
                kind: "RISK",
                status: "OPEN",
                title: data.title,
                description: data.description,
                probability: data.probability,
                impact: data.impact,
                responsePlan: data.responsePlan,
                contingencyPlan: nullableText(data.contingencyPlan),
                trigger: nullableText(data.trigger),
                dueDate: data.dueDate ? dateKeyToUtc(data.dueDate) : null,
              }
            : data.kind === "ISSUE"
              ? {
                  companyId: user.companyId,
                  projectId,
                  ownerUserId,
                  createdById: user.id,
                  updatedById: user.id,
                  sourceRiskId,
                  referenceNumber,
                  kind: "ISSUE",
                  status: "OPEN",
                  title: data.title,
                  description: data.description,
                  severity: data.severity,
                  dueDate: data.dueDate ? dateKeyToUtc(data.dueDate) : null,
                }
              : {
                  companyId: user.companyId,
                  projectId,
                  createdById: user.id,
                  updatedById: user.id,
                  decidedById: user.id,
                  supersedesDecisionId,
                  referenceNumber,
                  kind: "DECISION",
                  status: "RECORDED",
                  title: data.title,
                  decision: data.decision,
                  rationale: data.rationale,
                  alternatives: nullableText(data.alternatives),
                  impactSummary: nullableText(data.impactSummary),
                  decidedAt: new Date(),
                },
        include: {
          ownerUser: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
          sourceRisk: { select: { id: true, referenceNumber: true, title: true } },
          supersedesDecision: {
            select: { id: true, referenceNumber: true, title: true },
          },
        },
      })

      if (sourceRiskId) {
        await tx.projectGovernanceItem.update({
          where: { id: sourceRiskId },
          data: { status: "MATERIALIZED", updatedById: user.id },
        })
      }
      if (supersedesDecisionId) {
        await tx.projectGovernanceItem.update({
          where: { id: supersedesDecisionId },
          data: { status: "SUPERSEDED", updatedById: user.id },
        })
      }

      const action =
        data.kind === "RISK"
          ? ActivityAction.PROJECT_RISK_CREATED
          : data.kind === "ISSUE"
            ? ActivityAction.PROJECT_ISSUE_CREATED
            : ActivityAction.PROJECT_DECISION_RECORDED
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "ProjectGovernanceItem",
        entityId: item.id,
        message: `تم تسجيل ${referenceNumber} في مشروع ${project.name}: ${item.title}`,
        metadata: {
          projectId,
          kind: item.kind,
          referenceNumber,
          sourceRiskId,
          supersedesDecisionId,
        },
        ...meta,
      })

      if (sourceRiskId) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_RISK_MATERIALIZED,
          entityType: "ProjectGovernanceItem",
          entityId: sourceRiskId,
          message: `تحول خطر إلى مشكلة ${referenceNumber} في مشروع ${project.name}`,
          metadata: { projectId, issueId: item.id, issueReference: referenceNumber },
          ...meta,
        })
      }
      if (supersedesDecisionId) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_DECISION_SUPERSEDED,
          entityType: "ProjectGovernanceItem",
          entityId: supersedesDecisionId,
          message: `تم استبدال قرار سابق بالقرار ${referenceNumber} في مشروع ${project.name}`,
          metadata: { projectId, replacementDecisionId: item.id },
          ...meta,
        })
      }

      return item
    },
    { isolationLevel: "Serializable" },
  )

  return ok({ item: saved }, 201)
}

export const POST = withApiHandler(
  "PROJECT_GOVERNANCE_POST_ERROR",
  createProjectGovernanceItem,
  "تعذر تسجيل بند حوكمة المشروع",
)
