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
  clientRead: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
    "FINANCE_MANAGER",
  ],
  clientManagement: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
  ],
  projectManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  projectReadinessManagement: [
    "OWNER",
    "ADMIN",
    "OPERATIONS_MANAGER",
  ],
  projectReadinessOverride: ["OWNER", "ADMIN"],
  serviceRequestManagement: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
  ],
  salesRead: ["OWNER", "ADMIN", "SALES_MANAGER", "OPERATIONS_MANAGER"],
  salesManagement: ["OWNER", "ADMIN", "SALES_MANAGER"],
  discoveryRead: ["OWNER", "ADMIN", "SALES_MANAGER", "OPERATIONS_MANAGER"],
  discoveryManagement: ["OWNER", "ADMIN", "SALES_MANAGER"],
  discoveryReportRead: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
  ],
  discoveryReportManagement: ["OWNER", "ADMIN", "SALES_MANAGER"],
  discoveryReportApproval: ["OWNER", "ADMIN", "SALES_MANAGER"],
  pricingRead: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
    "FINANCE_MANAGER",
  ],
  pricingManagement: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "FINANCE_MANAGER",
  ],
  pricingApproval: ["OWNER", "ADMIN", "FINANCE_MANAGER"],
  proposalRead: [
    "OWNER",
    "ADMIN",
    "SALES_MANAGER",
    "OPERATIONS_MANAGER",
    "FINANCE_MANAGER",
  ],
  proposalManagement: ["OWNER", "ADMIN", "SALES_MANAGER"],
  proposalApproval: ["OWNER", "ADMIN", "SALES_MANAGER"],
  proposalDelivery: ["OWNER", "ADMIN", "SALES_MANAGER"],
  projectConversion: ["OWNER", "ADMIN"],
  taskManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  financeRead: ["OWNER", "ADMIN", "FINANCE_MANAGER", "OPERATIONS_MANAGER"],
  financeManagement: ["OWNER", "ADMIN", "FINANCE_MANAGER"],
  expenseSubmission: ["OWNER", "ADMIN", "FINANCE_MANAGER", "OPERATIONS_MANAGER"],
  timeCompanyRead: ["OWNER", "ADMIN", "OPERATIONS_MANAGER", "FINANCE_MANAGER"],
  timeApproval: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  timeCostRead: ["OWNER", "ADMIN", "OPERATIONS_MANAGER", "FINANCE_MANAGER"],
  timeRateManagement: ["OWNER", "ADMIN", "FINANCE_MANAGER"],
  timeCapacityManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  hrCompanyRead: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  hrManagement: ["OWNER", "ADMIN"],
  attendanceManagement: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  leaveApproval: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
  workScheduleManagement: ["OWNER", "ADMIN"],
  holidayManagement: ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly AccessRole[]>

export type TaskAccessContext = {
  assignedToId: string | null
  createdById: string | null
  participants?: readonly {
    userId: string
    role: TaskParticipantRole
  }[]
  projectMemberRole?: ProjectMemberRole | null
  managedUserIds?: readonly string[]
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

function managesTaskWork(task: TaskAccessContext) {
  const managedUserIds = task.managedUserIds ?? []

  return (
    (task.assignedToId !== null &&
      managedUserIds.includes(task.assignedToId)) ||
    task.participants?.some((participant) =>
      managedUserIds.includes(participant.userId)
    ) === true
  )
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
    participantCanEdit(user.id, task.participants) ||
    managesTaskWork(task)
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
    participantOwnsTask(user.id, task.participants) ||
    managesTaskWork(task)
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

export function canManageProjectReadiness(role: AccessRole) {
  return hasRole(role, ACCESS_ROLES.projectReadinessManagement)
}

export function canOverrideProjectReadiness(role: AccessRole) {
  return hasRole(role, ACCESS_ROLES.projectReadinessOverride)
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

export function canViewCompanyTime(role: AccessRole) {
  return hasRole(role, ACCESS_ROLES.timeCompanyRead)
}

export function canApproveTimesheet(
  approver: { id: string; role: AccessRole },
  ownerUserId: string,
) {
  if (!hasRole(approver.role, ACCESS_ROLES.timeApproval)) return false
  return approver.role === "OWNER" || approver.id !== ownerUserId
}

export function assertCanApproveTimesheet(
  approver: { id: string; role: AccessRole },
  ownerUserId: string,
) {
  if (!canApproveTimesheet(approver, ownerUserId)) {
    throw new ApiError(
      approver.id === ownerUserId
        ? "لا يمكن اعتماد سجل ساعاتك بنفسك"
        : "لا تملك صلاحية اعتماد سجلات الساعات",
      403,
      approver.id === ownerUserId
        ? "TIMESHEET_SELF_APPROVAL_FORBIDDEN"
        : "TIMESHEET_APPROVAL_FORBIDDEN",
    )
  }
}

export function canViewCompanyHr(role: AccessRole) {
  return hasRole(role, ACCESS_ROLES.hrCompanyRead)
}

export function canApproveLeave(
  approver: { id: string; role: AccessRole },
  requesterUserId: string,
) {
  if (!hasRole(approver.role, ACCESS_ROLES.leaveApproval)) return false
  return approver.role === "OWNER" || approver.id !== requesterUserId
}

export function assertCanApproveLeave(
  approver: { id: string; role: AccessRole },
  requesterUserId: string,
) {
  if (!canApproveLeave(approver, requesterUserId)) {
    throw new ApiError(
      approver.id === requesterUserId
        ? "لا يمكنك اعتماد طلب إجازتك بنفسك"
        : "لا تملك صلاحية اعتماد طلبات الإجازة",
      403,
      approver.id === requesterUserId
        ? "LEAVE_SELF_APPROVAL_FORBIDDEN"
        : "LEAVE_APPROVAL_FORBIDDEN",
    )
  }
}

export function canApprovePricing(
  approver: { id: string; role: AccessRole },
  versionCreatorId: string | null,
) {
  if (!hasRole(approver.role, ACCESS_ROLES.pricingApproval)) return false
  return (
    approver.role === "OWNER" ||
    versionCreatorId === null ||
    approver.id !== versionCreatorId
  )
}

export function assertCanApprovePricing(
  approver: { id: string; role: AccessRole },
  versionCreatorId: string | null,
) {
  if (!canApprovePricing(approver, versionCreatorId)) {
    throw new ApiError(
      versionCreatorId === approver.id
        ? "لا يمكنك اعتماد إصدار التسعير الذي أنشأته بنفسك"
        : "لا تملك صلاحية اعتماد التسعير",
      403,
      versionCreatorId === approver.id
        ? "PRICING_SELF_APPROVAL_FORBIDDEN"
        : "PRICING_APPROVAL_FORBIDDEN",
    )
  }
}

export function canApproveProposal(
  approver: { id: string; role: AccessRole },
  versionCreatorId: string | null,
) {
  if (!hasRole(approver.role, ACCESS_ROLES.proposalApproval)) return false
  return (
    approver.role === "OWNER" ||
    versionCreatorId === null ||
    approver.id !== versionCreatorId
  )
}

export function assertCanApproveProposal(
  approver: { id: string; role: AccessRole },
  versionCreatorId: string | null,
) {
  if (!canApproveProposal(approver, versionCreatorId)) {
    throw new ApiError(
      versionCreatorId === approver.id
        ? "لا يمكنك اعتماد إصدار العرض الذي أنشأته بنفسك"
        : "لا تملك صلاحية اعتماد العرض",
      403,
      versionCreatorId === approver.id
        ? "PROPOSAL_SELF_APPROVAL_FORBIDDEN"
        : "PROPOSAL_APPROVAL_FORBIDDEN",
    )
  }
}
