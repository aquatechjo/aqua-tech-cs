import type { Prisma } from "@/generated/prisma/client"
import {
  ProjectPriority,
  ProjectStatus,
} from "@/generated/prisma/enums"

import AquaPagination from "@/components/aqua/AquaPagination"
import { requireAuth } from "@/lib/auth"
import { averageProgress } from "@/lib/project-execution"
import { summarizeWorkflowDefinition } from "@/lib/project-workflow"
import {
  buildProjectVisibilityWhere,
  canManageProjectMetadata,
  projectScopeFromTaskScope,
  projectScopeLabel,
} from "@/lib/project-scope"
import { prisma } from "@/lib/prisma"
import { buildTaskVisibilityWhere } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

import ProjectsClient from "./ProjectsClient"

const PAGE_SIZE = 20
const activeProjectStatuses: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
]
const projectStatuses: ProjectStatus[] = [
  ...activeProjectStatuses,
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]
const projectPriorities: ProjectPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

function parsePage(value: string | undefined) {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1
    ? Math.floor(page)
    : 1
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

function formatDate(value: Date | null, timeZone: string) {
  if (!value) return "دون موعد"

  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value)
}

function formatBudget(
  value: Prisma.Decimal | null,
  currency: string
) {
  if (!value) return null

  return `${new Intl.NumberFormat("en-JO", {
    maximumFractionDigits: 2,
  }).format(Number(value))} ${currency}`
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
  const taskScope = await resolveTaskAccessScope(user)
  const scope = projectScopeFromTaskScope(
    user.role,
    taskScope
  )
  const resolvedSearchParams = await searchParams
  const timeZone = user.company.timezone || "Asia/Amman"
  const now = new Date()

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseProjectStatus(resolvedSearchParams.status)
  const priority = parseProjectPriority(resolvedSearchParams.priority)
  const clientId = resolvedSearchParams.clientId?.trim() ?? ""
  const visibilityWhere = buildProjectVisibilityWhere(scope)
  const taskVisibilityWhere =
    buildTaskVisibilityWhere(taskScope)

  const scopeWhere: Prisma.ProjectWhereInput = {
    companyId: user.companyId,
    ...visibilityWhere,
  }
  const where: Prisma.ProjectWhereInput = {
    ...scopeWhere,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            {
              description: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  }

  const clientWhere: Prisma.ClientWhereInput = {
    companyId: user.companyId,
    status: {
      not: "ARCHIVED",
    },
    ...(scope.canViewCompanyProjects
      ? {}
      : {
          projects: {
            some: visibilityWhere,
          },
        }),
  }

  const [
    clients,
    totalProjects,
    activeProjects,
    completedProjects,
    overdueProjects,
    filteredProjects,
    workflowTemplateRecords,
  ] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.project.count({
      where: scopeWhere,
    }),
    prisma.project.count({
      where: {
        ...scopeWhere,
        status: {
          in: activeProjectStatuses,
        },
      },
    }),
    prisma.project.count({
      where: {
        ...scopeWhere,
        status: "COMPLETED",
      },
    }),
    prisma.project.count({
      where: {
        ...scopeWhere,
        status: {
          in: activeProjectStatuses,
        },
        dueDate: {
          lt: now,
        },
      },
    }),
    prisma.project.count({ where }),
    scope.canCreateProjects
      ? prisma.workflowTemplate.findMany({
          where: {
            companyId: user.companyId,
            isActive: true,
          },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            version: true,
            isDefault: true,
            definition: true,
          },
        })
      : Promise.resolve([]),
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProjects / PAGE_SIZE)
  )
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawProjects = await prisma.project.findMany({
    where,
    orderBy: [
      {
        status: "asc",
      },
      {
        dueDate: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
    skip,
    take: PAGE_SIZE,
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      members: {
        select: {
          id: true,
        },
      },
      workflow: {
        select: {
          templateName: true,
          templateCode: true,
          templateVersion: true,
          status: true,
        },
      },
      tasks: {
        where: {
          status: {
            not: "ARCHIVED",
          },
          ...taskVisibilityWhere,
        },
        select: {
          status: true,
          progress: true,
          blockers: {
            where: {
              status: "OPEN",
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  const projects = rawProjects.map((project) => {
    const openBlockers = project.tasks.reduce(
      (count, task) => count + task.blockers.length,
      0
    )
    const completedTasks = project.tasks.filter(
      (task) => task.status === "DONE"
    ).length
    const isOverdue =
      project.dueDate !== null &&
      project.dueDate < now &&
      activeProjectStatuses.includes(project.status)

    return {
      id: project.id,
      clientId: project.clientId,
      client: project.client,
      name: project.name,
      code: project.code,
      description: project.description,
      status: project.status,
      priority: project.priority,
      budget: scope.canViewProjectBudgets
        ? project.budget?.toString() ?? null
        : null,
      budgetDisplay: scope.canViewProjectBudgets
        ? formatBudget(project.budget, project.currency)
        : null,
      currency: project.currency,
      startDate: project.startDate?.toISOString() ?? null,
      dueDate: project.dueDate?.toISOString() ?? null,
      dueDisplay: formatDate(project.dueDate, timeZone),
      isOverdue,
      completedAt: project.completedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      progress: averageProgress(
        project.tasks.map((task) => task.progress)
      ),
      totalTasks: project.tasks.length,
      completedTasks,
      memberCount: project.members.length,
      openBlockers,
      canEdit: canManageProjectMetadata(scope),
      workflow: project.workflow,
    }
  })
  const workflowTemplates = workflowTemplateRecords.map(
    (template) => ({
      id: template.id,
      name: template.name,
      code: template.code,
      description: template.description,
      version: template.version,
      isDefault: template.isDefault,
      ...summarizeWorkflowDefinition(template.definition),
    })
  )

  const from = filteredProjects === 0 ? 0 : skip + 1
  const to = Math.min(
    skip + projects.length,
    filteredProjects
  )

  return (
    <ProjectsClient
      projects={projects}
      clients={clients}
      workflowTemplates={workflowTemplates}
      scope={{
        label: projectScopeLabel(scope),
        dataScope: scope.dataScope,
        canCreate: scope.canCreateProjects,
        description:
          scope.dataScope === "company"
            ? "عرض وإدارة جميع مشاريع الشركة."
            : scope.dataScope === "team"
              ? "المشاريع المرتبطة بفريقك ومسؤولياتك فقط."
              : "المشاريع التي تشارك فيها أو تعمل على مهامها فقط.",
      }}
      filters={{
        q,
        status: status ?? "",
        priority: priority ?? "",
        clientId,
      }}
      stats={{
        totalProjects,
        activeProjects,
        completedProjects,
        overdueProjects,
        filteredProjects,
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
