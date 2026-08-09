import type { Prisma } from "@/generated/prisma/client"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  assertClosureTransition,
  closureBlockerCount,
  projectClosureMutationSchema,
} from "@/lib/project-closure"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const nullable = (value: string | null | undefined) => value?.trim() || null

async function blockers(tx: Prisma.TransactionClient, companyId: string, projectId: string) {
  const [incompleteDeliverables, openChangeRequests, openRisks, openIssues, incompleteTasks] = await Promise.all([
    tx.projectDeliverable.count({ where: { companyId, projectId, status: { notIn: ["ACCEPTED", "CANCELLED"] } } }),
    tx.projectChangeRequest.count({ where: { companyId, projectId, status: { in: ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"] } } }),
    tx.projectGovernanceItem.count({ where: { companyId, projectId, kind: "RISK", status: { in: ["OPEN", "MONITORING", "MITIGATED"] } } }),
    tx.projectGovernanceItem.count({ where: { companyId, projectId, kind: "ISSUE", status: { in: ["OPEN", "IN_PROGRESS", "RESOLVED"] } } }),
    tx.task.count({ where: { companyId, projectId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } } }),
  ])
  return { incompleteDeliverables, openChangeRequests, openRisks, openIssues, incompleteTasks }
}

async function mutate(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const parsed = projectClosureMutationSchema.safeParse(await readJsonBody(request))
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "بيانات إغلاق المشروع غير صحيحة", 400, "INVALID_PROJECT_CLOSURE_INPUT", { details: parsed.error.flatten() })
  const input = parsed.data
  const meta = await getRequestMeta()

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} AND "companyId" = ${user.companyId} FOR UPDATE`
    const current = await tx.project.findFirst({ where: { id: projectId, companyId: user.companyId }, include: { closure: true } })
    if (!current) throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
    assertClosureTransition(current.closure?.status ?? null, input.action)

    const gate = await blockers(tx, user.companyId, projectId)
    if ((input.action === "SUBMIT" || input.action === "COMPLETE") && closureBlockerCount(gate) > 0 && !("exceptionReason" in input && nullable(input.exceptionReason))) {
      throw new ApiError("أغلق البنود التشغيلية المفتوحة أو وثّق سبب الاستثناء", 409, "PROJECT_CLOSURE_BLOCKED", { details: { blockers: gate } })
    }

    if (input.action === "ARCHIVE") {
      const closure = await tx.projectClosure.update({ where: { projectId }, data: { status: "ARCHIVED", archivedAt: new Date() } })
      await tx.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } })
      await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action: ActivityAction.PROJECT_CLOSURE_ARCHIVED, entityType: "ProjectClosure", entityId: closure.id, message: `تمت أرشفة مشروع ${project.name} بعد إغلاقه`, metadata: { projectId }, ...meta })
      return { closure, blockers: gate }
    }

    const data = {
      companyId: user.companyId,
      projectId,
      preparedById: user.id,
      outcome: input.outcome,
      summary: input.summary,
      lessonsLearned: input.lessonsLearned,
      followUpActions: nullable(input.followUpActions),
      clientHandoverRef: input.clientHandoverRef,
      internalArchiveRef: input.internalArchiveRef,
      exceptionReason: nullable(input.exceptionReason),
      status: input.action === "SAVE_DRAFT" ? "DRAFT" as const : input.action === "SUBMIT" ? "READY_FOR_REVIEW" as const : "COMPLETED" as const,
      submittedAt: input.action === "SUBMIT" ? new Date() : current.closure?.submittedAt,
      completedAt: input.action === "COMPLETE" ? new Date() : current.closure?.completedAt,
      approvedById: input.action === "COMPLETE" ? user.id : current.closure?.approvedById,
    }
    const closure = await tx.projectClosure.upsert({ where: { projectId }, create: data, update: data })
    if (input.action === "COMPLETE") await tx.project.update({ where: { id: projectId }, data: { status: "COMPLETED", completedAt: new Date() } })
    const action = input.action === "SAVE_DRAFT" ? ActivityAction.PROJECT_CLOSURE_UPDATED : input.action === "SUBMIT" ? ActivityAction.PROJECT_CLOSURE_SUBMITTED : ActivityAction.PROJECT_CLOSURE_COMPLETED
    await logActivity({ db: tx, companyId: user.companyId, userId: user.id, action, entityType: "ProjectClosure", entityId: closure.id, message: `تم تحديث إغلاق مشروع ${project.name}`, metadata: { projectId, status: closure.status, blockers: gate }, ...meta })
    return { closure, blockers: gate }
  }, { isolationLevel: "Serializable" })
  return ok(result)
}

export const PATCH = withApiHandler("PROJECT_CLOSURE_PATCH_ERROR", mutate, "تعذر تحديث إغلاق المشروع")
