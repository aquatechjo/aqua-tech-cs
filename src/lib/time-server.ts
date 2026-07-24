import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type { AccessRole } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  canEditTask,
  hasRole,
} from "@/lib/access-control"
import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import {
  assertTimesheetEditable,
  weekStartFromDateKey,
} from "@/lib/time"

export type TimeUser = {
  id: string
  companyId: string
  role: AccessRole
  company: {
    timezone: string
  }
}

export const timeEntryInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      employeeProfile: {
        select: {
          workHoursPerWeek: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      code: true,
      currency: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      estimatedHours: true,
    },
  },
  timesheet: {
    select: {
      id: true,
      weekStart: true,
      status: true,
      submittedAt: true,
      approvedAt: true,
      rejectedAt: true,
      rejectionReason: true,
    },
  },
} satisfies Prisma.TimeEntryInclude

export const timesheetInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      employeeProfile: {
        select: {
          workHoursPerWeek: true,
          hourlyCost: true,
          billableRate: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          jobRole: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
    },
  },
  entries: {
    orderBy: [{ workDate: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      project: {
        select: {
          id: true,
          name: true,
          code: true,
          currency: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          estimatedHours: true,
        },
      },
    },
  },
} satisfies Prisma.TimesheetInclude

export function nullableTimeText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

export async function employeeTimeProfile(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  userId: string,
) {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      employeeProfile: {
        select: {
          id: true,
          status: true,
          workHoursPerWeek: true,
          hourlyCost: true,
          billableRate: true,
        },
      },
    },
  })

  if (!user) {
    throw new ApiError("المستخدم غير موجود أو غير نشط", 404, "TIME_USER_NOT_FOUND")
  }

  if (user.employeeProfile?.status === "TERMINATED") {
    throw new ApiError("لا يمكن تسجيل وقت لموظف منتهي الخدمة", 409, "EMPLOYEE_TERMINATED")
  }

  return {
    userId: user.id,
    name: user.name,
    profileId: user.employeeProfile?.id ?? null,
    workHoursPerWeek: Number(user.employeeProfile?.workHoursPerWeek ?? 40),
    hourlyCost: Number(user.employeeProfile?.hourlyCost ?? 0),
    billableRate: Number(user.employeeProfile?.billableRate ?? 0),
  }
}

export async function ensureTimesheet(
  db: Prisma.TransactionClient | typeof prisma,
  {
    companyId,
    userId,
    workDate,
  }: {
    companyId: string
    userId: string
    workDate: Date
  },
) {
  const weekStart = weekStartFromDateKey(workDate.toISOString().slice(0, 10))
  return db.timesheet.upsert({
    where: {
      companyId_userId_weekStart: {
        companyId,
        userId,
        weekStart,
      },
    },
    update: {},
    create: {
      companyId,
      userId,
      weekStart,
    },
  })
}

export async function makeRejectedTimesheetEditable(
  db: Prisma.TransactionClient | typeof prisma,
  timesheet: {
    id: string
    status: "OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED"
  },
) {
  assertTimesheetEditable(timesheet.status)

  if (timesheet.status !== "REJECTED") return timesheet

  return db.timesheet.update({
    where: { id: timesheet.id },
    data: {
      status: "OPEN",
      submittedAt: null,
      approvedAt: null,
      approvedById: null,
      rejectedAt: null,
      rejectionReason: null,
    },
  })
}

export async function assertTimeTargetAccess(
  user: TimeUser,
  {
    projectId,
    taskId,
  }: {
    projectId?: string | null
    taskId?: string | null
  },
) {
  if (!projectId && !taskId) {
    return {
      projectId: null,
      taskId: null,
    }
  }

  if (taskId) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        companyId: user.companyId,
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        projectId: true,
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
            status: true,
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
    })

    if (!task) {
      throw new ApiError("المهمة المحددة غير موجودة", 404, "TIME_TASK_NOT_FOUND")
    }

    if (projectId && task.projectId !== projectId) {
      throw new ApiError(
        "المهمة لا تتبع المشروع المحدد",
        400,
        "TIME_TASK_PROJECT_MISMATCH",
      )
    }

    if (task.project?.status === "ARCHIVED" || task.project?.status === "CANCELLED") {
      throw new ApiError("لا يمكن تسجيل وقت على مشروع مغلق", 409, "TIME_PROJECT_CLOSED")
    }

    const canUseTask = canEditTask(user, {
      assignedToId: task.assignedToId,
      createdById: task.createdById,
      participants: task.participants.map((participant) => ({
        userId: participant.employeeProfile.userId,
        role: participant.role,
      })),
      projectMemberRole: task.project?.members[0]?.role,
    })

    if (!canUseTask) {
      throw new ApiError(
        "لا يمكنك تسجيل وقت على مهمة لا تشارك في تنفيذها",
        403,
        "TIME_TASK_FORBIDDEN",
      )
    }

    return {
      projectId: task.projectId,
      taskId: task.id,
    }
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId ?? "",
      companyId: user.companyId,
      status: { notIn: ["ARCHIVED", "CANCELLED"] },
    },
    select: {
      id: true,
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
    throw new ApiError("المشروع المحدد غير موجود أو مغلق", 404, "TIME_PROJECT_NOT_FOUND")
  }

  const isManagement = hasRole(user.role, ACCESS_ROLES.projectManagement)
  const memberRole = project.members[0]?.role
  if (!isManagement && (!memberRole || memberRole === "VIEWER")) {
    throw new ApiError(
      "لا يمكنك تسجيل وقت على مشروع لا تشارك في تنفيذه",
      403,
      "TIME_PROJECT_FORBIDDEN",
    )
  }

  return {
    projectId: project.id,
    taskId: null,
  }
}

export function serializeTimeEntry(
  entry: Prisma.TimeEntryGetPayload<{ include: typeof timeEntryInclude }>,
  { includeRates = false }: { includeRates?: boolean } = {},
) {
  return {
    ...entry,
    hourlyCostSnapshot: includeRates
      ? entry.hourlyCostSnapshot.toString()
      : null,
    billableRateSnapshot: includeRates
      ? entry.billableRateSnapshot.toString()
      : null,
    workDate: entry.workDate.toISOString(),
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    task: entry.task
      ? {
          ...entry.task,
          estimatedHours: entry.task.estimatedHours?.toString() ?? null,
        }
      : null,
    user: {
      ...entry.user,
      employeeProfile: entry.user.employeeProfile
        ? {
            workHoursPerWeek:
              entry.user.employeeProfile.workHoursPerWeek.toString(),
          }
        : null,
    },
    timesheet: {
      ...entry.timesheet,
      weekStart: entry.timesheet.weekStart.toISOString(),
      submittedAt: entry.timesheet.submittedAt?.toISOString() ?? null,
      approvedAt: entry.timesheet.approvedAt?.toISOString() ?? null,
      rejectedAt: entry.timesheet.rejectedAt?.toISOString() ?? null,
    },
  }
}

export function serializeTimesheet(
  timesheet: Prisma.TimesheetGetPayload<{ include: typeof timesheetInclude }>,
  { includeRates = false }: { includeRates?: boolean } = {},
) {
  return {
    ...timesheet,
    weekStart: timesheet.weekStart.toISOString(),
    submittedAt: timesheet.submittedAt?.toISOString() ?? null,
    approvedAt: timesheet.approvedAt?.toISOString() ?? null,
    rejectedAt: timesheet.rejectedAt?.toISOString() ?? null,
    createdAt: timesheet.createdAt.toISOString(),
    updatedAt: timesheet.updatedAt.toISOString(),
    user: {
      ...timesheet.user,
      employeeProfile: timesheet.user.employeeProfile
        ? {
            ...timesheet.user.employeeProfile,
            workHoursPerWeek:
              timesheet.user.employeeProfile.workHoursPerWeek.toString(),
            hourlyCost: includeRates
              ? timesheet.user.employeeProfile.hourlyCost.toString()
              : null,
            billableRate: includeRates
              ? timesheet.user.employeeProfile.billableRate.toString()
              : null,
          }
        : null,
    },
    entries: timesheet.entries.map((entry) => ({
      ...entry,
      hourlyCostSnapshot: includeRates
        ? entry.hourlyCostSnapshot.toString()
        : null,
      billableRateSnapshot: includeRates
        ? entry.billableRateSnapshot.toString()
        : null,
      workDate: entry.workDate.toISOString(),
      startedAt: entry.startedAt?.toISOString() ?? null,
      endedAt: entry.endedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      task: entry.task
        ? {
            ...entry.task,
            estimatedHours: entry.task.estimatedHours?.toString() ?? null,
          }
        : null,
    })),
  }
}
