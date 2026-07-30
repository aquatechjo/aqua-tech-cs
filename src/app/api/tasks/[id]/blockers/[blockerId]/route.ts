import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireEditableTask } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertProjectExecutionActivated } from "@/lib/project-readiness-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateBlockerSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1500).optional().nullable(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).optional(),
  resolution: z.string().trim().max(1500).optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function updateTaskBlocker(
  request: Request,
  context: { params: Promise<{ id: string; blockerId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId, blockerId } = await context.params
  const task = await requireEditableTask(user, taskId)
  if (task.projectId) {
    await assertProjectExecutionActivated(prisma, {
      companyId: user.companyId,
      projectId: task.projectId,
    })
  }
  const body = await readJsonBody(request)
  const parsed = updateBlockerSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات العائق غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const existing = await prisma.taskBlocker.findFirst({
    where: {
      id: blockerId,
      taskId,
      companyId: user.companyId,
    },
  })

  if (!existing) {
    return err("العائق غير موجود", 404, {
      code: "TASK_BLOCKER_NOT_FOUND",
    })
  }

  const nextStatus = parsed.data.status ?? existing.status
  if (nextStatus === "RESOLVED" && !nullableText(parsed.data.resolution) && !existing.resolution) {
    return err("اكتب طريقة معالجة العائق قبل إغلاقه", 400, {
      code: "BLOCKER_RESOLUTION_REQUIRED",
    })
  }

  const blocker = await prisma.$transaction(async (tx) => {
    const updated = await tx.taskBlocker.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
          ? { description: nullableText(parsed.data.description) }
          : {}),
        ...(parsed.data.severity !== undefined ? { severity: parsed.data.severity } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.resolution !== undefined
          ? { resolution: nullableText(parsed.data.resolution) }
          : {}),
        ...(nextStatus === "RESOLVED"
          ? { resolvedAt: new Date(), resolvedById: user.id }
          : { resolvedAt: null, resolvedById: null }),
      },
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const openBlockerCount = await tx.taskBlocker.count({
      where: {
        taskId,
        status: "OPEN",
      },
    })

    if (openBlockerCount === 0 && nextStatus !== "OPEN") {
      await tx.task.updateMany({
        where: {
          id: taskId,
          status: "BLOCKED",
        },
        data: {
          status: "IN_PROGRESS",
        },
      })
    } else if (nextStatus === "OPEN") {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: "BLOCKED",
        },
      })
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action:
          nextStatus === "RESOLVED" && existing.status !== "RESOLVED"
            ? ActivityAction.TASK_BLOCKER_RESOLVED
            : ActivityAction.TASK_BLOCKER_UPDATED,
        entityType: "TaskBlocker",
        entityId: updated.id,
        message:
          nextStatus === "RESOLVED"
            ? `تمت معالجة عائق مهمة ${task.title}: ${updated.title}`
            : `تم تحديث عائق مهمة ${task.title}: ${updated.title}`,
        metadata: {
          taskId,
          status: updated.status,
          severity: updated.severity,
        },
      },
    })

    return updated
  })

  return ok({ blocker })
}

export const PATCH = withApiHandler(
  "TASK_BLOCKER_PATCH_ERROR",
  updateTaskBlocker,
  "حدث خطأ أثناء تحديث العائق"
)
