import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import {
  assertCanAssignTaskOwner,
  assertCanManageTaskParticipants,
} from "@/lib/access-control"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireEditableTask } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertProjectExecutionActivated } from "@/lib/project-readiness-server"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateParticipantSchema = z.object({
  role: z.enum(["OWNER", "CONTRIBUTOR", "REVIEWER", "OBSERVER"]),
})

async function updateTaskParticipant(
  request: Request,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId, participantId } = await context.params
  const task = await requireEditableTask(user, taskId)
  assertCanManageTaskParticipants(user, task.accessContext)
  if (task.projectId) {
    await assertProjectExecutionActivated(prisma, {
      companyId: user.companyId,
      projectId: task.projectId,
    })
  }

  const body = await readJsonBody(request)
  const parsed = updateParticipantSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "دور المشارك غير صحيح", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const existing = await prisma.taskParticipant.findFirst({
    where: {
      id: participantId,
      taskId,
      companyId: user.companyId,
    },
    include: {
      employeeProfile: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!existing) {
    return err("مشارك المهمة غير موجود", 404, {
      code: "TASK_PARTICIPANT_NOT_FOUND",
    })
  }

  if (
    (parsed.data.role === "OWNER" && existing.role !== "OWNER") ||
    (existing.role === "OWNER" && parsed.data.role !== "OWNER")
  ) {
    assertCanAssignTaskOwner(user, task.accessContext.projectMemberRole)
  }

  const participant = await prisma.$transaction(async (tx) => {
    if (parsed.data.role === "OWNER") {
      await tx.taskParticipant.updateMany({
        where: {
          taskId,
          role: "OWNER",
          id: {
            not: participantId,
          },
        },
        data: {
          role: "CONTRIBUTOR",
        },
      })
    }

    const updated = await tx.taskParticipant.update({
      where: {
        id: participantId,
      },
      data: {
        role: parsed.data.role,
      },
    })

    if (parsed.data.role === "OWNER") {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          assignedToId: existing.employeeProfile.userId,
        },
      })
    } else if (existing.role === "OWNER" && task.assignedToId === existing.employeeProfile.userId) {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          assignedToId: null,
        },
      })
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_PARTICIPANT_UPDATED,
        entityType: "TaskParticipant",
        entityId: updated.id,
        message: `تم تحديث دور ${existing.employeeProfile.user.name} في مهمة ${task.title}`,
        metadata: {
          taskId,
          role: updated.role,
        },
      },
    })

    return updated
  })

  return ok({ participant })
}

async function removeTaskParticipant(
  request: Request,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId, participantId } = await context.params
  const task = await requireEditableTask(user, taskId)
  assertCanManageTaskParticipants(user, task.accessContext)

  const existing = await prisma.taskParticipant.findFirst({
    where: {
      id: participantId,
      taskId,
      companyId: user.companyId,
    },
    include: {
      employeeProfile: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!existing) {
    return err("مشارك المهمة غير موجود", 404, {
      code: "TASK_PARTICIPANT_NOT_FOUND",
    })
  }

  if (existing.role === "OWNER") {
    assertCanAssignTaskOwner(user, task.accessContext.projectMemberRole)
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskParticipant.delete({
      where: {
        id: existing.id,
      },
    })

    if (task.assignedToId === existing.employeeProfile.userId) {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          assignedToId: null,
        },
      })
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_PARTICIPANT_REMOVED,
        entityType: "TaskParticipant",
        entityId: existing.id,
        message: `تمت إزالة ${existing.employeeProfile.user.name} من مهمة ${task.title}`,
        metadata: {
          taskId,
          employeeProfileId: existing.employeeProfileId,
        },
      },
    })
  })

  return ok({ deleted: true })
}

export const PATCH = withApiHandler(
  "TASK_PARTICIPANT_PATCH_ERROR",
  updateTaskParticipant,
  "حدث خطأ أثناء تعديل مشارك المهمة"
)
export const DELETE = withApiHandler(
  "TASK_PARTICIPANT_DELETE_ERROR",
  removeTaskParticipant,
  "حدث خطأ أثناء إزالة مشارك المهمة"
)
