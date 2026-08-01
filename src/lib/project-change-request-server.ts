import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import {
  projectChangeTargetIssues,
  type ProjectChangeItemInput,
} from "@/lib/project-change-request"
import { dateKeyToUtc } from "@/lib/time"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

export function nullableProjectChangeText(
  value: string | null | undefined,
) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function normalizeProjectChangeItems(
  db: DatabaseClient,
  {
    companyId,
    projectId,
    items,
  }: {
    companyId: string
    projectId: string
    items: ProjectChangeItemInput[]
  },
) {
  const phaseIds = [
    ...new Set(
      items.flatMap((item) =>
        "phaseId" in item && item.phaseId ? [item.phaseId] : [],
      ),
    ),
  ]
  const targetIds = [
    ...new Set(
      items.flatMap((item) =>
        "targetDeliverableId" in item
          ? [item.targetDeliverableId]
          : [],
      ),
    ),
  ]

  const [phases, targets] = await Promise.all([
    phaseIds.length
      ? db.projectPhase.findMany({
          where: {
            id: { in: phaseIds },
            companyId,
            projectId,
          },
          select: { id: true },
        })
      : [],
    targetIds.length
      ? db.projectDeliverable.findMany({
          where: {
            id: { in: targetIds },
            companyId,
            projectId,
          },
          select: {
            id: true,
            title: true,
            description: true,
            acceptanceCriteria: true,
            phaseId: true,
            dueDate: true,
            sortOrder: true,
            status: true,
            updatedAt: true,
          },
        })
      : [],
  ])

  if (phases.length !== phaseIds.length) {
    throw new ApiError(
      "إحدى مراحل التغيير غير موجودة داخل المشروع",
      404,
      "PROJECT_CHANGE_PHASE_NOT_FOUND",
    )
  }

  const targetsById = new Map(targets.map((target) => [target.id, target]))

  return items.map((item, index) => {
    if (item.action === "ADD_DELIVERABLE") {
      return {
        companyId,
        projectId,
        action: item.action,
        targetDeliverableId: null,
        targetUpdatedAt: null,
        resultDeliverableId: null,
        title: item.title,
        description: nullableProjectChangeText(item.description),
        acceptanceCriteria: nullableProjectChangeText(
          item.acceptanceCriteria,
        ),
        reason: null,
        phaseId: item.phaseId ?? null,
        dueDate: item.dueDate ? dateKeyToUtc(item.dueDate) : null,
        sortOrder: item.sortOrder ?? index,
      }
    }

    const target = targetsById.get(item.targetDeliverableId)
    const issues = projectChangeTargetIssues({
      action: item.action,
      targetStatus: target?.status,
    })
    if (issues.length > 0 || !target) {
      throw new ApiError(
        issues[0] ?? "التسليم المستهدف غير موجود داخل المشروع",
        409,
        "PROJECT_CHANGE_TARGET_BLOCKED",
      )
    }

    if (item.action === "CANCEL_DELIVERABLE") {
      return {
        companyId,
        projectId,
        action: item.action,
        targetDeliverableId: target.id,
        targetUpdatedAt: target.updatedAt,
        resultDeliverableId: null,
        title: target.title,
        description: target.description,
        acceptanceCriteria: target.acceptanceCriteria,
        reason: item.reason,
        phaseId: target.phaseId,
        dueDate: target.dueDate,
        sortOrder: target.sortOrder,
      }
    }

    return {
      companyId,
      projectId,
      action: item.action,
      targetDeliverableId: target.id,
      targetUpdatedAt: target.updatedAt,
      resultDeliverableId: null,
      title: item.title,
      description: nullableProjectChangeText(item.description),
      acceptanceCriteria: nullableProjectChangeText(
        item.acceptanceCriteria,
      ),
      reason: null,
      phaseId: item.phaseId ?? null,
      dueDate: item.dueDate ? dateKeyToUtc(item.dueDate) : null,
      sortOrder: item.sortOrder ?? target.sortOrder,
    }
  })
}
