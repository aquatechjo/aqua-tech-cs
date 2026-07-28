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
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { canAssignTaskTo } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

const participantSchema = z.object({
  employeeProfileId: z.string().min(1),
  role: z.enum(["OWNER", "CONTRIBUTOR", "REVIEWER", "OBSERVER"]).default("CONTRIBUTOR"),
})

async function addTaskParticipant(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: taskId } = await context.params
  const [task, scope] = await Promise.all([
    requireEditableTask(user, taskId),
    resolveTaskAccessScope(user),
  ])
  assertCanManageTaskParticipants(user, task.accessContext)

  const body = await readJsonBody(request)
  const parsed = participantSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات المشارك غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const employee = await prisma.employeeProfile.findFirst({
    where: {
      id: parsed.data.employeeProfileId,
      companyId: user.companyId,
      status: "ACTIVE",
      user: {
        isActive: true,
      },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!employee) {
    return err("الموظف غير موجود أو غير فعال", 404, {
      code: "EMPLOYEE_NOT_FOUND",
    })
  }

  if (!canAssignTaskTo(scope, employee.userId)) {
    return err("لا يمكنك إضافة موظف خارج نطاق عملك إلى المهمة", 403, {
      code: "TASK_PARTICIPANT_SCOPE_FORBIDDEN",
    })
  }

  const existing = await prisma.taskParticipant.findUnique({
    where: {
      taskId_employeeProfileId: {
        taskId,
        employeeProfileId: employee.id,
      },
    },
    select: {
      id: true,
      role: true,
    },
  })

  if (parsed.data.role === "OWNER" && existing?.role !== "OWNER") {
    assertCanAssignTaskOwner(user, task.accessContext.projectMemberRole)
  }

  if (existing?.role === "OWNER" && parsed.data.role !== "OWNER") {
    assertCanAssignTaskOwner(user, task.accessContext.projectMemberRole)
  }

  const participant = await prisma.$transaction(async (tx) => {
    if (parsed.data.role === "OWNER") {
      await tx.taskParticipant.updateMany({
        where: {
          taskId,
          role: "OWNER",
          employeeProfileId: {
            not: employee.id,
          },
        },
        data: {
          role: "CONTRIBUTOR",
        },
      })
    }

    const saved = await tx.taskParticipant.upsert({
      where: {
        taskId_employeeProfileId: {
          taskId,
          employeeProfileId: employee.id,
        },
      },
      create: {
        companyId: user.companyId,
        taskId,
        employeeProfileId: employee.id,
        role: parsed.data.role,
      },
      update: {
        role: parsed.data.role,
      },
      include: {
        employeeProfile: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (parsed.data.role === "OWNER") {
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          assignedToId: employee.userId,
        },
      })
    }

    if (task.projectId) {
      await tx.projectMember.upsert({
        where: {
          projectId_employeeProfileId: {
            projectId: task.projectId,
            employeeProfileId: employee.id,
          },
        },
        create: {
          companyId: user.companyId,
          projectId: task.projectId,
          employeeProfileId: employee.id,
          role: "CONTRIBUTOR",
          responsibility: "مشارك من خلال مهمة ضمن المشروع",
        },
        update: {},
      })
    }

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: existing
          ? ActivityAction.TASK_PARTICIPANT_UPDATED
          : ActivityAction.TASK_PARTICIPANT_ADDED,
        entityType: "TaskParticipant",
        entityId: saved.id,
        message: existing
          ? `تم تحديث دور ${employee.user.name} في مهمة ${task.title}`
          : `تمت إضافة ${employee.user.name} إلى مهمة ${task.title}`,
        metadata: {
          taskId,
          employeeProfileId: employee.id,
          role: saved.role,
        },
      },
    })

    return saved
  })

  return ok({ participant }, existing ? 200 : 201)
}

export const POST = withApiHandler(
  "TASK_PARTICIPANT_POST_ERROR",
  addTaskParticipant,
  "حدث خطأ أثناء حفظ مشارك المهمة"
)
