import type { Prisma } from "@/generated/prisma/client"
import type { AccessRole } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import type { TaskAccessScope } from "@/lib/task-scope"

export type ProjectDataScope = "personal" | "team" | "company"

export type ProjectAccessScope = {
  userId: string
  dataScope: ProjectDataScope
  canViewCompanyProjects: boolean
  canCreateProjects: boolean
  canManageProjectMetadata: boolean
  canViewProjectBudgets: boolean
  visibleProjectIds: readonly string[]
  managedProjectIds: readonly string[]
}

export function projectScopeFromTaskScope(
  role: AccessRole,
  taskScope: TaskAccessScope
): ProjectAccessScope {
  const canViewCompanyProjects = hasRole(
    role,
    ACCESS_ROLES.projectManagement
  )
  const canViewProjectBudgets = hasRole(
    role,
    ACCESS_ROLES.financeRead
  )

  return {
    userId: taskScope.userId,
    dataScope: canViewCompanyProjects
      ? "company"
      : taskScope.dataScope,
    canViewCompanyProjects,
    canCreateProjects: canViewCompanyProjects,
    canManageProjectMetadata: canViewCompanyProjects,
    canViewProjectBudgets,
    visibleProjectIds: canViewCompanyProjects
      ? []
      : taskScope.visibleProjectIds,
    managedProjectIds: canViewCompanyProjects
      ? []
      : taskScope.managedProjectIds,
  }
}

export function buildProjectVisibilityWhere(
  scope: ProjectAccessScope
): Prisma.ProjectWhereInput {
  if (scope.canViewCompanyProjects) return {}

  return {
    id: {
      in: [...scope.visibleProjectIds],
    },
  }
}

export function canViewProject(
  scope: ProjectAccessScope,
  projectId: string
) {
  return (
    scope.canViewCompanyProjects ||
    scope.visibleProjectIds.includes(projectId)
  )
}

export function canManageProject(
  scope: ProjectAccessScope,
  projectId: string
) {
  return (
    scope.canViewCompanyProjects ||
    scope.managedProjectIds.includes(projectId)
  )
}

export function canManageProjectMetadata(
  scope: ProjectAccessScope
) {
  return scope.canManageProjectMetadata
}

export function projectScopeLabel(scope: ProjectAccessScope) {
  if (scope.dataScope === "company") return "مشاريع الشركة"
  if (scope.dataScope === "team") return "مشاريع فريقي"
  return "مشاريعي"
}
