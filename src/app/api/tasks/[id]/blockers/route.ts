import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireEditableTask } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const blockerSchema = z.object({
  title: z.string().trim().min(2, "عنوان العائق مطلوب").max(180),
  description: z.string().trim().max(1500).optional().nullable(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function createTaskBlocker(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId } = await context.params
  const task = await requireEditableTask(user, taskId)
  if (["DONE", "CANCELLED", "ARCHIVED"].includes(task.status)) {
    return err("لا يمكن تسجيل عائق على مهمة مغلقة أو مؤرشفة", 409, {
      code: "TASK_NOT_ACTIVE",
    })
  }

  const body = await readJsonBody(request)
  const parsed = blockerSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات العائق غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const blocker = await prisma.$transaction(async (tx) => {
    const created = await tx.taskBlocker.create({
      data: {
        companyId: user.companyId,
        taskId,
        reportedById: user.id,
        title: parsed.data.title,
        description: nullableText(parsed.data.description),
        severity: parsed.data.severity,
      },
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await tx.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: "BLOCKED",
        ...(task.startedAt ? {} : { startedAt: new Date() }),
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_BLOCKER_CREATED,
        entityType: "TaskBlocker",
        entityId: created.id,
        message: `تم تسجيل عائق على مهمة ${task.title}: ${created.title}`,
        metadata: {
          taskId,
          severity: created.severity,
        },
      },
    })

    return created
  })

  return ok({ blocker }, 201)
}

export const POST = withApiHandler(
  "TASK_BLOCKER_POST_ERROR",
  createTaskBlocker,
  "حدث خطأ أثناء تسجيل العائق"
)
