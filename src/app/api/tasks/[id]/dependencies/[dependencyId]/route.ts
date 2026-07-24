import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { requireEditableTask } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

async function removeTaskDependency(
  request: Request,
  context: { params: Promise<{ id: string; dependencyId: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId, dependencyId } = await context.params
  const task = await requireEditableTask(user, taskId)

  const dependency = await prisma.taskDependency.findFirst({
    where: {
      id: dependencyId,
      taskId,
      companyId: user.companyId,
    },
    include: {
      dependsOnTask: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!dependency) {
    return err("تبعية المهمة غير موجودة", 404, {
      code: "TASK_DEPENDENCY_NOT_FOUND",
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskDependency.delete({
      where: {
        id: dependency.id,
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_DEPENDENCY_REMOVED,
        entityType: "TaskDependency",
        entityId: dependency.id,
        message: `تمت إزالة اعتماد مهمة ${task.title} على ${dependency.dependsOnTask.title}`,
        metadata: {
          taskId,
          dependsOnTaskId: dependency.dependsOnTaskId,
        },
      },
    })
  })

  return ok({ deleted: true })
}

export const DELETE = withApiHandler(
  "TASK_DEPENDENCY_DELETE_ERROR",
  removeTaskDependency,
  "حدث خطأ أثناء إزالة تبعية المهمة"
)
