import AquaPagination from "@/components/aqua/AquaPagination"
import type { AquaBadgeVariant } from "@/design-system"
import type { Prisma } from "@/generated/prisma/client"
import {
  TaskPriority,
  TaskStatus,
} from "@/generated/prisma/enums"
import { canEditTask } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { businessDate } from "@/lib/finance"
import {
  classifyMyDayDueDate,
  type MyDayBucket,
} from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"
import {
  buildTaskVisibilityWhere,
  taskScopeLabel,
} from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"
import TasksClient from "./TasksClient"

const PAGE_SIZE = 20

type TaskDueFilter =
  | "OVERDUE"
  | "TODAY"
  | "UPCOMING"
  | "NO_DUE_DATE"

const taskStatuses: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
  "ARCHIVED",
]

const taskPriorities: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

const dueFilters: TaskDueFilter[] = [
  "OVERDUE",
  "TODAY",
  "UPCOMING",
  "NO_DUE_DATE",
]

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function parseTaskStatus(value: string | undefined) {
  if (!value) return undefined

  return taskStatuses.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : undefined
}

function parseTaskPriority(value: string | undefined) {
  if (!value) return undefined

  return taskPriorities.includes(value as TaskPriority)
    ? (value as TaskPriority)
    : undefined
}

function parseDueFilter(value: string | undefined) {
  if (!value) return undefined

  return dueFilters.includes(value as TaskDueFilter)
    ? (value as TaskDueFilter)
    : undefined
}

function dueFilterWhere(
  due: TaskDueFilter | undefined,
  today: Date,
  tomorrow: Date,
  upcomingEnd: Date
): Prisma.TaskWhereInput {
  if (!due) return {}

  const activeStatus: Prisma.TaskWhereInput = {
    status: {
      notIn: ["DONE", "CANCELLED", "ARCHIVED"],
    },
  }

  if (due === "OVERDUE") {
    return {
      ...activeStatus,
      dueDate: {
        lt: today,
      },
    }
  }

  if (due === "TODAY") {
    return {
      ...activeStatus,
      dueDate: {
        gte: today,
        lt: tomorrow,
      },
    }
  }

  if (due === "UPCOMING") {
    return {
      ...activeStatus,
      dueDate: {
        gte: tomorrow,
        lt: upcomingEnd,
      },
    }
  }

  return {
    ...activeStatus,
    dueDate: null,
  }
}

function dueVariant(bucket: MyDayBucket): AquaBadgeVariant {
  return (
    {
      OVERDUE: "danger",
      TODAY: "warning",
      UPCOMING: "aqua",
      LATER: "blue",
      NO_DUE_DATE: "muted",
    } satisfies Record<MyDayBucket, AquaBadgeVariant>
  )[bucket]
}

function dueLabel(bucket: MyDayBucket) {
  return (
    {
      OVERDUE: "متأخرة",
      TODAY: "اليوم",
      UPCOMING: "قادمة",
      LATER: "لاحقًا",
      NO_DUE_DATE: "دون موعد",
    } satisfies Record<MyDayBucket, string>
  )[bucket]
}

function formatDueDate(
  value: Date | null,
  timeZone: string
) {
  if (!value) return "دون موعد"

  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value)
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    priority?: string
    due?: string
    projectId?: string
    assignedToId?: string
  }>
}) {
  const user = await requireAuth()
  const scope = await resolveTaskAccessScope(user)
  const resolvedSearchParams = await searchParams
  const timeZone = user.company.timezone || "Asia/Amman"
  const now = new Date()
  const today = businessDate(now, timeZone)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const upcomingEnd = new Date(today)
  upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 8)

  const projectOptionWhere: Prisma.ProjectWhereInput =
    scope.canViewCompanyTasks
      ? {}
      : {
          id: {
            in: [...scope.visibleProjectIds],
          },
        }

  const userOptionWhere: Prisma.UserWhereInput =
    scope.canViewCompanyTasks
      ? {}
      : {
          id: {
            in: [...scope.assignableUserIds],
          },
        }

  const [projects, clients, users] = await Promise.all([
    prisma.project.findMany({
      where: {
        companyId: user.companyId,
        status: {
          not: "ARCHIVED",
        },
        ...projectOptionWhere,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        clientId: true,
      },
    }),
    scope.canViewCompanyTasks
      ? prisma.client.findMany({
          where: {
            companyId: user.companyId,
            status: {
              not: "ARCHIVED",
            },
          },
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
          },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        ...userOptionWhere,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ])

  const projectIds = new Set(projects.map((project) => project.id))
  const userIds = new Set(users.map((item) => item.id))
  const canFilterByAssignee = scope.dataScope !== "personal"

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseTaskStatus(resolvedSearchParams.status)
  const priority = parseTaskPriority(resolvedSearchParams.priority)
  const due = parseDueFilter(resolvedSearchParams.due)
  const requestedProjectId =
    resolvedSearchParams.projectId?.trim() ?? ""
  const requestedAssignedToId =
    resolvedSearchParams.assignedToId?.trim() ?? ""
  const projectId = projectIds.has(requestedProjectId)
    ? requestedProjectId
    : ""
  const assignedToId =
    canFilterByAssignee && userIds.has(requestedAssignedToId)
      ? requestedAssignedToId
      : ""

  const visibilityWhere = buildTaskVisibilityWhere(scope)
  const filterClauses: Prisma.TaskWhereInput[] = [
    visibilityWhere,
    dueFilterWhere(due, today, tomorrow, upcomingEnd),
  ]

  if (status) filterClauses.push({ status })
  if (priority) filterClauses.push({ priority })
  if (projectId) filterClauses.push({ projectId })
  if (assignedToId) filterClauses.push({ assignedToId })
  if (q) {
    filterClauses.push({
      OR: [
        {
          title: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          project: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ],
    })
  }

  const where: Prisma.TaskWhereInput = {
    companyId: user.companyId,
    AND: filterClauses,
  }

  const activeWhere: Prisma.TaskWhereInput = {
    companyId: user.companyId,
    status: {
      notIn: ["DONE", "CANCELLED", "ARCHIVED"],
    },
    AND: [visibilityWhere],
  }

  const [
    totalTasks,
    overdueTasks,
    todayTasks,
    inProgressTasks,
    blockedTasks,
  ] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({
      where: {
        ...activeWhere,
        dueDate: {
          lt: today,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...activeWhere,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...activeWhere,
        status: "IN_PROGRESS",
      },
    }),
    prisma.task.count({
      where: {
        ...activeWhere,
        AND: [
          visibilityWhere,
          {
            OR: [
              {
                status: "BLOCKED",
              },
              {
                blockers: {
                  some: {
                    status: "OPEN",
                  },
                },
              },
            ],
          },
        ],
      },
    }),
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(totalTasks / PAGE_SIZE)
  )
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawTasks = await prisma.task.findMany({
    where,
    orderBy: [
      {
        dueDate: {
          sort: "asc",
          nulls: "last",
        },
      },
      {
        priority: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      projectId: true,
      project: {
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
      },
      clientId: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedToId: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
      createdById: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      source: true,
      sourceRef: true,
      estimatedHours: true,
      progress: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
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
      blockers: {
        where: {
          status: "OPEN",
        },
        select: {
          id: true,
        },
      },
    },
  })

  const tasks = rawTasks.map((task) => {
    const bucket = classifyMyDayDueDate(
      task.dueDate,
      now,
      timeZone
    )
    const editable = canEditTask(user, {
      assignedToId: task.assignedToId,
      createdById: task.createdById,
      participants: task.participants.map((participant) => ({
        userId: participant.employeeProfile.userId,
        role: participant.role,
      })),
      projectMemberRole: task.project?.members[0]?.role,
      managedUserIds: scope.managedUserIds,
    })

    return {
      id: task.id,
      projectId: task.projectId,
      project: task.project
        ? {
            id: task.project.id,
            name: task.project.name,
          }
        : null,
      clientId: task.clientId,
      client: task.client,
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source: task.source,
      sourceRef: task.sourceRef,
      estimatedHours: task.estimatedHours?.toString() ?? null,
      progress: task.progress,
      dueDate: task.dueDate?.toISOString() ?? null,
      dueLabel: dueLabel(bucket),
      dueDisplay: formatDueDate(task.dueDate, timeZone),
      dueVariant: dueVariant(bucket),
      openBlockerCount: task.blockers.length,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      canEdit: editable,
    }
  })

  const from = totalTasks === 0 ? 0 : skip + 1
  const to = Math.min(skip + tasks.length, totalTasks)
  const scopeDescription =
    scope.dataScope === "company"
      ? "عرض تشغيلي موحّد لمهام الشركة مع إمكان توزيع المسؤولية."
      : scope.dataScope === "team"
        ? "تظهر مهامك وعمل أعضاء فريقك والمشاريع التي تديرها فقط."
        : scope.jobRoleName
          ? `${scope.jobRoleName} • تظهر مهامك والعمل الذي تشارك في تنفيذه فقط.`
          : "تظهر مهامك والعمل الذي تشارك في تنفيذه فقط."

  return (
    <TasksClient
      currentUserId={user.id}
      tasks={tasks}
      projects={projects}
      clients={clients}
      users={users}
      scope={{
        label: taskScopeLabel(scope),
        description: scopeDescription,
        dataScope: scope.dataScope,
        canAssignOthers:
          scope.canViewCompanyTasks ||
          scope.assignableUserIds.some((id) => id !== user.id),
        canManageSources: scope.canViewCompanyTasks,
        showAssignee: canFilterByAssignee,
      }}
      filters={{
        q,
        status: status ?? "",
        priority: priority ?? "",
        due: due ?? "",
        projectId,
        assignedToId,
      }}
      stats={{
        totalTasks,
        overdueTasks,
        todayTasks,
        inProgressTasks,
        blockedTasks,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/tasks"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
            priority,
            due,
            projectId,
            assignedToId,
          }}
          from={from}
          to={to}
          totalItems={totalTasks}
        />
      }
    />
  )
}
