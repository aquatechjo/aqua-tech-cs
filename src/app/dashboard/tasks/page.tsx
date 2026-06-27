import AquaPagination from "@/components/aqua/AquaPagination"
import {
  TaskPriority,
  TaskSource,
  TaskStatus,
} from "@/generated/prisma/enums"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import TasksClient from "./TasksClient"

const PAGE_SIZE = 20

const taskStatuses: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
  "ARCHIVED",
]

const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const taskSources: TaskSource[] = [
  "MANUAL",
  "WEBSITE_REQUEST",
  "WORKFLOW",
  "AI_GENERATED",
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

function parseTaskSource(value: string | undefined) {
  if (!value) return undefined

  return taskSources.includes(value as TaskSource)
    ? (value as TaskSource)
    : undefined
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    priority?: string
    source?: string
    projectId?: string
    assignedToId?: string
  }>
}) {
  const user = await requireAuth()
  const resolvedSearchParams = await searchParams

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseTaskStatus(resolvedSearchParams.status)
  const priority = parseTaskPriority(resolvedSearchParams.priority)
  const source = parseTaskSource(resolvedSearchParams.source)
  const projectId = resolvedSearchParams.projectId?.trim() ?? ""
  const assignedToId = resolvedSearchParams.assignedToId?.trim() ?? ""

  const [projects, clients, users] = await Promise.all([
    prisma.project.findMany({
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
        clientId: true,
      },
    }),

    prisma.client.findMany({
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
    }),

    prisma.user.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ])

  const where = {
    companyId: user.companyId,

    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(source ? { source } : {}),
    ...(projectId ? { projectId } : {}),
    ...(assignedToId ? { assignedToId } : {}),

    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { sourceRef: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [totalTasks, inProgressTasks, doneTasks, archivedTasks] =
    await Promise.all([
      prisma.task.count({ where }),

      prisma.task.count({
        where: {
          ...where,
          status: "IN_PROGRESS",
        },
      }),

      prisma.task.count({
        where: {
          ...where,
          status: "DONE",
        },
      }),

      prisma.task.count({
        where: {
          ...where,
          status: "ARCHIVED",
        },
      }),
    ])

  const totalPages = Math.max(1, Math.ceil(totalTasks / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawTasks = await prisma.task.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  const tasks = rawTasks.map((task) => ({
    id: task.id,
    projectId: task.projectId,
    project: task.project,
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
    estimatedHours: task.estimatedHours ? task.estimatedHours.toString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }))

  const from = totalTasks === 0 ? 0 : skip + 1
  const to = Math.min(skip + tasks.length, totalTasks)

  return (
    <TasksClient
      tasks={tasks}
      projects={projects}
      clients={clients}
      users={users}
      filters={{
        q,
        status: status ?? "",
        priority: priority ?? "",
        source: source ?? "",
        projectId,
        assignedToId,
      }}
      stats={{
        totalTasks,
        inProgressTasks,
        doneTasks,
        archivedTasks,
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
            source,
            projectId,
            assignedToId,
          }}
        />
      }
    />
  )
}