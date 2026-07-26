import "server-only"

import { assertCanEditTask, assertCanManageProjectExecution } from "@/lib/access-control"
import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

export async function requireProjectExecutionManager(
  user: { id: string; companyId: string; role: import("@/generated/prisma/enums").AccessRole },
  projectId: string
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: user.companyId,
    },
    select: {
      id: true,
      name: true,
      members: {
        where: {
          employeeProfile: {
            userId: user.id,
          },
        },
        select: {
          role: true,
        },
        take: 1,
      },
    },
  })

  if (!project) {
    throw new ApiError("المشروع غير موجود", 404, "PROJECT_NOT_FOUND")
  }

  assertCanManageProjectExecution(user, project.members[0]?.role)
  return project
}

export async function requireEditableTask(
  user: { id: string; companyId: string; role: import("@/generated/prisma/enums").AccessRole },
  taskId: string
) {
  const [task, scope] = await Promise.all([
    prisma.task.findFirst({
    where: {
      id: taskId,
      companyId: user.companyId,
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      status: true,
      startedAt: true,
      assignedToId: true,
      createdById: true,
      participants: {
        select: {
          role: true,
          employeeProfile: {
            select: {
              userId: true,
            },
          },
        },
      },
      project: {
        select: {
          members: {
            where: {
              employeeProfile: {
                userId: user.id,
              },
            },
            select: {
              role: true,
            },
            take: 1,
          },
        },
      },
    },
    }),
    resolveTaskAccessScope(user),
  ])

  if (!task) {
    throw new ApiError("المهمة غير موجودة", 404, "TASK_NOT_FOUND")
  }

  const accessContext = {
    assignedToId: task.assignedToId,
    createdById: task.createdById,
    participants: task.participants.map((participant) => ({
      userId: participant.employeeProfile.userId,
      role: participant.role,
    })),
    projectMemberRole: task.project?.members[0]?.role,
    managedUserIds: scope.managedUserIds,
  }

  assertCanEditTask(user, accessContext)

  return {
    ...task,
    accessContext,
  }
}
