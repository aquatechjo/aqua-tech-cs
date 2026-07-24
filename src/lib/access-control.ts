import type { UserRole } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"

export const ACCESS_ROLES = {
  companySettings: ["OWNER", "ADMIN"],
  teamManagement: ["OWNER", "ADMIN"],
  activityLog: ["OWNER", "ADMIN"],
  clientManagement: ["OWNER", "ADMIN", "SALES", "PROJECT_MANAGER"],
  projectManagement: ["OWNER", "ADMIN", "PROJECT_MANAGER"],
  serviceRequestManagement: ["OWNER", "ADMIN", "SALES", "PROJECT_MANAGER"],
  taskManagement: ["OWNER", "ADMIN", "PROJECT_MANAGER"],
} as const satisfies Record<string, readonly UserRole[]>

export function hasRole(role: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(role)
}

export function assertRole(
  role: UserRole,
  allowedRoles: readonly UserRole[],
  message = "لا تملك صلاحية تنفيذ هذا الإجراء"
) {
  if (!hasRole(role, allowedRoles)) {
    throw new ApiError(message, 403, "FORBIDDEN")
  }
}

export function canEditTask(
  user: { id: string; role: UserRole },
  task: { assignedToId: string | null; createdById: string | null }
) {
  return (
    hasRole(user.role, ACCESS_ROLES.taskManagement) ||
    task.assignedToId === user.id ||
    task.createdById === user.id
  )
}

export function assertCanEditTask(
  user: { id: string; role: UserRole },
  task: { assignedToId: string | null; createdById: string | null }
) {
  if (!canEditTask(user, task)) {
    throw new ApiError(
      "يمكنك تعديل المهام المسندة إليك أو التي أنشأتها فقط",
      403,
      "FORBIDDEN"
    )
  }
}
