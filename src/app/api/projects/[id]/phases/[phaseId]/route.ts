import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { assertProgress, normalizePhaseCode } from "@/lib/project-execution"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const optionalDateStringSchema = z.string().refine(
  (value) => value.trim() === "" || !Number.isNaN(Date.parse(value)),
  "صيغة التاريخ غير صحيحة"
)

const updatePhaseSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  code: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z
    .enum(["PLANNED", "ACTIVE", "BLOCKED", "COMPLETED", "CANCELLED"])
    .optional(),
  progress: z.number().int().min(0).max(100).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  startDate: optionalDateStringSchema.optional().nullable(),
  dueDate: optionalDateStringSchema.optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function nullableDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function updateProjectPhase(
  request: Request,
  context: { params: Promise<{ id: string; phaseId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, phaseId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = updatePhaseSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات المرحلة غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const existing = await prisma.projectPhase.findFirst({
    where: {
      id: phaseId,
      projectId,
      companyId: user.companyId,
    },
  })

  if (!existing) {
    return err("المرحلة غير موجودة", 404, {
      code: "PROJECT_PHASE_NOT_FOUND",
    })
  }

  const data = parsed.data
  const startDate =
    data.startDate !== undefined ? nullableDate(data.startDate) : existing.startDate
  const dueDate = data.dueDate !== undefined ? nullableDate(data.dueDate) : existing.dueDate

  if (startDate && dueDate && dueDate < startDate) {
    return err("تاريخ نهاية المرحلة يجب أن يكون بعد تاريخ البداية", 400, {
      code: "INVALID_PHASE_DATES",
    })
  }

  let code = existing.code
  if (data.code !== undefined) {
    code = data.code ? normalizePhaseCode(data.code) : null
    if (data.code && !code) {
      return err("رمز المرحلة يجب أن يحتوي أحرفًا إنجليزية أو أرقامًا", 400, {
        code: "INVALID_PHASE_CODE",
      })
    }
  }

  if (code && code !== existing.code) {
    const duplicate = await prisma.projectPhase.findFirst({
      where: {
        projectId,
        companyId: user.companyId,
        code,
        id: {
          not: existing.id,
        },
      },
      select: { id: true },
    })

    if (duplicate) {
      return err("رمز المرحلة مستخدم داخل هذا المشروع", 409, {
        code: "PROJECT_PHASE_CODE_EXISTS",
      })
    }
  }

  const nextStatus = data.status ?? existing.status
  const nextProgress =
    nextStatus === "COMPLETED"
      ? 100
      : data.progress !== undefined
        ? assertProgress(data.progress)
        : existing.progress

  const phase = await prisma.$transaction(async (tx) => {
    const updated = await tx.projectPhase.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code } : {}),
        ...(data.description !== undefined
          ? { description: nullableText(data.description) }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        progress: nextProgress,
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.startDate !== undefined ? { startDate } : {}),
        ...(data.dueDate !== undefined ? { dueDate } : {}),
        ...(nextStatus === "COMPLETED" && !existing.completedAt
          ? { completedAt: new Date() }
          : {}),
        ...(nextStatus !== "COMPLETED" ? { completedAt: null } : {}),
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_PHASE_UPDATED,
        entityType: "ProjectPhase",
        entityId: updated.id,
        message: `تم تحديث مرحلة ${updated.name} في مشروع ${project.name}`,
        metadata: {
          projectId,
          status: updated.status,
          progress: updated.progress,
        },
      },
    })

    return updated
  })

  return ok({ phase })
}

async function removeProjectPhase(
  request: Request,
  context: { params: Promise<{ id: string; phaseId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId, phaseId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)

  const phase = await prisma.projectPhase.findFirst({
    where: {
      id: phaseId,
      projectId,
      companyId: user.companyId,
    },
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  })

  if (!phase) {
    return err("المرحلة غير موجودة", 404, {
      code: "PROJECT_PHASE_NOT_FOUND",
    })
  }

  if (phase._count.tasks > 0) {
    return err("انقل مهام المرحلة أو أزل ارتباطها قبل حذف المرحلة", 409, {
      code: "PROJECT_PHASE_HAS_TASKS",
      details: {
        taskCount: phase._count.tasks,
      },
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectPhase.delete({
      where: {
        id: phase.id,
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_PHASE_REMOVED,
        entityType: "ProjectPhase",
        entityId: phase.id,
        message: `تم حذف مرحلة ${phase.name} من مشروع ${project.name}`,
        metadata: {
          projectId,
        },
      },
    })
  })

  return ok({ deleted: true })
}

export const PATCH = withApiHandler(
  "PROJECT_PHASE_PATCH_ERROR",
  updateProjectPhase,
  "حدث خطأ أثناء تعديل المرحلة"
)
export const DELETE = withApiHandler(
  "PROJECT_PHASE_DELETE_ERROR",
  removeProjectPhase,
  "حدث خطأ أثناء حذف المرحلة"
)
