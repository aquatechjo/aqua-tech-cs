import type {
  AccessRole,
  ProjectMemberRole,
  TaskParticipantRole,
} from "@/generated/prisma/enums"
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

export type TaskAccessContext = {
  assignedToId: string | null
  createdById: string | null
  participants?: readonly {
    userId: string
    role: TaskParticipantRole
  }[]
  projectMemberRole?: ProjectMemberRole | null
}

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

function isProjectExecutionManager(projectMemberRole?: ProjectMemberRole | null) {
  return projectMemberRole === "PROJECT_LEAD" || projectMemberRole === "MANAGER"
}

function participantCanEdit(
  userId: string,
  participants: TaskAccessContext["participants"]
) {
  return participants?.some(
    (participant) =>
      participant.userId === userId &&
      participant.role !== "OBSERVER"
  ) === true
}

function participantOwnsTask(
  userId: string,
  participants: TaskAccessContext["participants"]
) {
  return participants?.some(
    (participant) =>
      participant.userId === userId && participant.role === "OWNER"
  ) === true
}

export function canEditTask(
  user: { id: string; role: AccessRole },
  task: TaskAccessContext
) {
  return (
    hasRole(user.role, ACCESS_ROLES.taskManagement) ||
    isProjectExecutionManager(task.projectMemberRole) ||
    task.assignedToId === user.id ||
    task.createdById === user.id ||
    participantCanEdit(user.id, task.participants)
  )
}

export function assertCanEditTask(
  user: { id: string; role: AccessRole },
  task: TaskAccessContext
) {
  if (!canEditTask(user, task)) {
    throw new ApiError(
      "يمكنك تعديل المهام المسندة إليك أو التي تشارك في تنفيذها فقط",
      403,
      "FORBIDDEN"
    )
  }
}

export function canManageTaskParticipants(
  user: { id: string; role: AccessRole },
  task: TaskAccessContext
) {
  return (
    hasRole(user.role, ACCESS_ROLES.taskManagement) ||
    isProjectExecutionManager(task.projectMemberRole) ||
    task.assignedToId === user.id ||
    task.createdById === user.id ||
    participantOwnsTask(user.id, task.participants)
  )
}

export function assertCanManageTaskParticipants(
  user: { id: string; role: AccessRole },
  task: TaskAccessContext
) {
  if (!canManageTaskParticipants(user, task)) {
    throw new ApiError(
      "إدارة المشاركين متاحة لمسؤول المهمة أو إدارة المشروع فقط",
      403,
      "TASK_PARTICIPANTS_FORBIDDEN"
    )
  }
}

export function canAssignTaskOwner(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  return (
    hasRole(user.role, ACCESS_ROLES.taskManagement) ||
    isProjectExecutionManager(projectMemberRole)
  )
}

export function assertCanAssignTaskOwner(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  if (!canAssignTaskOwner(user, projectMemberRole)) {
    throw new ApiError(
      "تغيير المسؤول الرئيسي متاح لإدارة المشروع فقط",
      403,
      "TASK_OWNER_ASSIGNMENT_FORBIDDEN"
    )
  }
}

export function canManageProjectExecution(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  return (
    hasRole(user.role, ACCESS_ROLES.projectManagement) ||
    isProjectExecutionManager(projectMemberRole)
  )
}

export function assertCanManageProjectExecution(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  if (!canManageProjectExecution(user, projectMemberRole)) {
    throw new ApiError(
      "إدارة تنفيذ المشروع متاحة لإدارة العمليات أو قائد المشروع فقط",
      403,
      "PROJECT_EXECUTION_FORBIDDEN"
    )
  }
}

export function canManageProjectLeadership(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  return (
    hasRole(user.role, ACCESS_ROLES.projectManagement) ||
    projectMemberRole === "PROJECT_LEAD"
  )
}

export function assertCanManageProjectLeadership(
  user: { role: AccessRole },
  projectMemberRole?: ProjectMemberRole | null
) {
  if (!canManageProjectLeadership(user, projectMemberRole)) {
    throw new ApiError(
      "تعيين قائد المشروع أو تغييره متاح للإدارة أو لقائد المشروع الحالي فقط",
      403,
      "PROJECT_LEADERSHIP_FORBIDDEN"
    )
  }
}
