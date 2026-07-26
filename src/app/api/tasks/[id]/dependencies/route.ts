import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { wouldCreateDependencyCycle } from "@/lib/project-execution"
import { requireEditableTask } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { buildTaskVisibilityWhere } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

const dependencySchema = z.object({
  dependsOnTaskId: z.string().min(1),
  type: z
    .enum(["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "START_TO_FINISH"])
    .default("FINISH_TO_START"),
})

async function addTaskDependency(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId } = await context.params
  const task = await requireEditableTask(user, taskId)
  const scope = await resolveTaskAccessScope(user)
  const body = await readJsonBody(request)
  const parsed = dependencySchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات التبعية غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  if (!task.projectId) {
    return err("يجب ربط المهمة بمشروع قبل إضافة التبعيات", 409, {
      code: "TASK_PROJECT_REQUIRED",
    })
  }

  const dependencyTask = await prisma.task.findFirst({
    where: {
      id: parsed.data.dependsOnTaskId,
      companyId: user.companyId,
      projectId: task.projectId,
      status: {
        not: "ARCHIVED",
      },
      ...buildTaskVisibilityWhere(scope),
    },
    select: {
      id: true,
      title: true,
    },
  })

  if (!dependencyTask) {
    return err("المهمة السابقة غير موجودة داخل المشروع نفسه", 404, {
      code: "DEPENDENCY_TASK_NOT_FOUND",
    })
  }

  const edges = await prisma.taskDependency.findMany({
    where: {
      companyId: user.companyId,
      task: {
        projectId: task.projectId,
      },
    },
    select: {
      taskId: true,
      dependsOnTaskId: true,
    },
  })

  if (wouldCreateDependencyCycle(taskId, dependencyTask.id, edges)) {
    return err("لا يمكن إضافة تبعية دائرية أو ربط المهمة بنفسها", 409, {
      code: "TASK_DEPENDENCY_CYCLE",
    })
  }

  const dependency = await prisma.$transaction(async (tx) => {
    const created = await tx.taskDependency.upsert({
      where: {
        taskId_dependsOnTaskId: {
          taskId,
          dependsOnTaskId: dependencyTask.id,
        },
      },
      create: {
        companyId: user.companyId,
        taskId,
        dependsOnTaskId: dependencyTask.id,
        type: parsed.data.type,
      },
      update: {
        type: parsed.data.type,
      },
      include: {
        dependsOnTask: {
          select: {
            id: true,
            title: true,
            status: true,
            progress: true,
          },
        },
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TASK_DEPENDENCY_ADDED,
        entityType: "TaskDependency",
        entityId: created.id,
        message: `أصبحت مهمة ${task.title} تعتمد على ${dependencyTask.title}`,
        metadata: {
          taskId,
          dependsOnTaskId: dependencyTask.id,
          type: created.type,
        },
      },
    })

    return created
  })

  return ok({ dependency }, 201)
}

export const POST = withApiHandler(
  "TASK_DEPENDENCY_POST_ERROR",
  addTaskDependency,
  "حدث خطأ أثناء إضافة تبعية المهمة"
)
