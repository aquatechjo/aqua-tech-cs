import type { AccessRole } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"

export const ACCESS_ROLES = {
  companySettings: ["OWNER", "ADMIN"],
  teamManagement: ["OWNER", "ADMIN"],
  organizationManagement: ["OWNER", "ADMIN"],
  activityLog: ["OWNER", "ADMIN"],
  clientManagement: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
  ],
  projectManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  serviceRequestManagement: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
  ],
  taskManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
} as const satisfies Record<string, readonly AccessRole[]>

export function hasRole(role: AccessRole, allowedRoles: readonly AccessRole[]) {
  return allowedRoles.includes(role)
}

export function assertRole(
  role: AccessRole,
  allowedRoles: readonly AccessRole[],
  message = "لا تملك صلاحية تنفيذ هذا الإجراء"
) {
  if (!hasRole(role, allowedRoles)) {
    throw new ApiError(message, 403, "FORBIDDEN")
  }
}

export function canEditTask(
  user: { id: string; role: AccessRole },
  task: { assignedToId: string | null; createdById: string | null }
) {
  return (
    hasRole(user.role, ACCESS_ROLES.taskManagement) ||
    task.assignedToId === user.id ||
    task.createdById === user.id
  )
}

export function assertCanEditTask(
  user: { id: string; role: AccessRole },
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
