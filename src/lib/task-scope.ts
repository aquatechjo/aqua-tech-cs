import type { Prisma } from "@/generated/prisma/client"

export type TaskDataScope = "personal" | "team" | "company"

export type TaskAccessScope = {
  userId: string
  dataScope: TaskDataScope
  canViewCompanyTasks: boolean
  managedUserIds: readonly string[]
  visibleProjectIds: readonly string[]
  managedProjectIds: readonly string[]
  assignableUserIds: readonly string[]
  jobRoleName: string | null
}

export function buildTaskVisibilityWhere(
  scope: TaskAccessScope
): Prisma.TaskWhereInput {
  if (scope.canViewCompanyTasks) return {}

  const visibleWorkUserIds = Array.from(
    new Set([scope.userId, ...scope.managedUserIds])
  )

  return {
    OR: [
      {
        assignedToId: {
          in: visibleWorkUserIds,
        },
      },
      {
        createdById: scope.userId,
      },
      {
        participants: {
          some: {
            employeeProfile: {
              userId: {
                in: visibleWorkUserIds,
              },
            },
          },
        },
      },
      ...(scope.managedProjectIds.length > 0
        ? [
            {
              projectId: {
                in: [...scope.managedProjectIds],
              },
            },
          ]
        : []),
    ],
  }
}

export function canAssignTaskTo(
  scope: TaskAccessScope,
  assignedToId: string | null
) {
  if (!assignedToId) return true
  if (scope.canViewCompanyTasks) return true
  return scope.assignableUserIds.includes(assignedToId)
}

export function canUseTaskProject(
  scope: TaskAccessScope,
  projectId: string | null
) {
  if (!projectId) return true
  if (scope.canViewCompanyTasks) return true
  return scope.visibleProjectIds.includes(projectId)
}

export function taskScopeLabel(scope: TaskAccessScope) {
  if (scope.dataScope === "company") return "مهام الشركة"
  if (scope.dataScope === "team") return "مهام فريقي"
  return "مهامي"
}
