import AquaPagination from "@/components/aqua/AquaPagination"
import {
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/enums"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ProjectsClient from "./ProjectsClient"

const PAGE_SIZE = 20

const projectStatuses: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]

const projectPriorities: ProjectPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function parseProjectStatus(value: string | undefined) {
  if (!value) return undefined

  return projectStatuses.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : undefined
}

function parseProjectPriority(value: string | undefined) {
  if (!value) return undefined

  return projectPriorities.includes(value as ProjectPriority)
    ? (value as ProjectPriority)
    : undefined
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    priority?: string
    clientId?: string
  }>
}) {
  const user = await requireAuth()
  const resolvedSearchParams = await searchParams

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseProjectStatus(resolvedSearchParams.status)
  const priority = parseProjectPriority(resolvedSearchParams.priority)
  const clientId = resolvedSearchParams.clientId?.trim() ?? ""

  const clients = await prisma.client.findMany({
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

  const where = {
    companyId: user.companyId,

    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),

    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { currency: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [
    totalProjects,
    inProgressProjects,
    completedProjects,
    archivedProjects,
  ] = await Promise.all([
    prisma.project.count({ where }),

    prisma.project.count({
      where: {
        ...where,
        status: "IN_PROGRESS",
      },
    }),

    prisma.project.count({
      where: {
        ...where,
        status: "COMPLETED",
      },
    }),

    prisma.project.count({
      where: {
        ...where,
        status: "ARCHIVED",
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawProjects = await prisma.project.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const projects = rawProjects.map((project) => ({
    id: project.id,
    clientId: project.clientId,
    client: project.client,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    priority: project.priority,
    budget: project.budget ? project.budget.toString() : null,
    currency: project.currency,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    completedAt: project.completedAt ? project.completedAt.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }))

  const from = totalProjects === 0 ? 0 : skip + 1
  const to = Math.min(skip + projects.length, totalProjects)

  return (
    <ProjectsClient
      projects={projects}
      clients={clients}
      filters={{
        q,
        status: status ?? "",
        priority: priority ?? "",
        clientId,
      }}
      stats={{
        totalProjects,
        inProgressProjects,
        completedProjects,
        archivedProjects,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/projects"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
            priority,
            clientId,
          }}
        />
      }
    />
  )
}