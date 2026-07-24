import AquaPagination from "@/components/aqua/AquaPagination"
import { redirect } from "next/navigation"
import {
  ServiceRequestPriority,
  ServiceRequestSource,
  ServiceRequestStatus,
} from "@/generated/prisma/enums"
import { requireAuth } from "@/lib/auth"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { prisma } from "@/lib/prisma"
import ServiceRequestsClient from "./ServiceRequestsClient"

const PAGE_SIZE = 20

const serviceRequestStatuses: ServiceRequestStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
  "ARCHIVED",
]

const serviceRequestSources: ServiceRequestSource[] = [
  "WEBSITE",
  "MANUAL",
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "REFERRAL",
  "OTHER",
]

const serviceRequestPriorities: ServiceRequestPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function parseServiceRequestStatus(value: string | undefined) {
  if (!value) return undefined

  return serviceRequestStatuses.includes(value as ServiceRequestStatus)
    ? (value as ServiceRequestStatus)
    : undefined
}

function parseServiceRequestSource(value: string | undefined) {
  if (!value) return undefined

  return serviceRequestSources.includes(value as ServiceRequestSource)
    ? (value as ServiceRequestSource)
    : undefined
}

function parseServiceRequestPriority(value: string | undefined) {
  if (!value) return undefined

  return serviceRequestPriorities.includes(value as ServiceRequestPriority)
    ? (value as ServiceRequestPriority)
    : undefined
}

export default async function ServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    source?: string
    priority?: string
    assignedToId?: string
  }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.serviceRequestManagement)) {
    redirect("/dashboard")
  }

  const resolvedSearchParams = await searchParams

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseServiceRequestStatus(resolvedSearchParams.status)
  const source = parseServiceRequestSource(resolvedSearchParams.source)
  const priority = parseServiceRequestPriority(resolvedSearchParams.priority)
  const assignedToId = resolvedSearchParams.assignedToId?.trim() ?? ""

  const [clients, projects, users] = await Promise.all([
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
    ...(source ? { source } : {}),
    ...(priority ? { priority } : {}),
    ...(assignedToId ? { assignedToId } : {}),

    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" as const } },
            { customerEmail: { contains: q, mode: "insensitive" as const } },
            { customerPhone: { contains: q, mode: "insensitive" as const } },
            { customerCompany: { contains: q, mode: "insensitive" as const } },
            { serviceType: { contains: q, mode: "insensitive" as const } },
            { budgetRange: { contains: q, mode: "insensitive" as const } },
            { timeline: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [totalRequests, newRequests, proposalRequests, approvedRequests] =
    await Promise.all([
      prisma.serviceRequest.count({ where }),

      prisma.serviceRequest.count({
        where: {
          ...where,
          status: "NEW",
        },
      }),

      prisma.serviceRequest.count({
        where: {
          ...where,
          status: "PROPOSAL_SENT",
        },
      }),

      prisma.serviceRequest.count({
        where: {
          ...where,
          status: "APPROVED",
        },
      }),
    ])

  const totalPages = Math.max(1, Math.ceil(totalRequests / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawRequests = await prisma.serviceRequest.findMany({
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
      project: {
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
      salesOpportunity: {
        select: {
          id: true,
        },
      },
    },
  })

  const serviceRequests = rawRequests.map((request) => ({
    id: request.id,
    clientId: request.clientId,
    client: request.client,
    projectId: request.projectId,
    project: request.project,
    assignedToId: request.assignedToId,
    assignedTo: request.assignedTo,
    salesOpportunity: request.salesOpportunity,

    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone,
    customerCompany: request.customerCompany,

    serviceType: request.serviceType,
    budgetRange: request.budgetRange,
    timeline: request.timeline,
    message: request.message,

    status: request.status,
    source: request.source,
    priority: request.priority,

    workflowRunId: request.workflowRunId,
    proposalUrl: request.proposalUrl,

    proposalSentAt: request.proposalSentAt
      ? request.proposalSentAt.toISOString()
      : null,
    approvedAt: request.approvedAt ? request.approvedAt.toISOString() : null,
    rejectedAt: request.rejectedAt ? request.rejectedAt.toISOString() : null,
    convertedAt: request.convertedAt ? request.convertedAt.toISOString() : null,

    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  }))

  const from = totalRequests === 0 ? 0 : skip + 1
  const to = Math.min(skip + serviceRequests.length, totalRequests)

  return (
    <ServiceRequestsClient
      serviceRequests={serviceRequests}
      clients={clients}
      projects={projects}
      users={users}
      filters={{
        q,
        status: status ?? "",
        source: source ?? "",
        priority: priority ?? "",
        assignedToId,
      }}
      stats={{
        totalRequests,
        newRequests,
        proposalRequests,
        approvedRequests,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/service-requests"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
            source,
            priority,
            assignedToId,
          }}
        />
      }
    />
  )
}
