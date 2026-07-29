import { redirect } from "next/navigation"

import AquaPagination from "@/components/aqua/AquaPagination"
import type { Prisma } from "@/generated/prisma/client"
import {
  LeadSource,
  LeadStatus,
  ServiceRequestPriority,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { OPEN_LEAD_STATUSES } from "@/lib/crm-lead"
import { prisma } from "@/lib/prisma"

import LeadsClient from "./LeadsClient"

const PAGE_SIZE = 20

const leadStatuses: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "DISCOVERY",
  "NEEDS_INFO",
  "QUALIFIED",
  "DISQUALIFIED",
  "NURTURE",
  "DUPLICATE",
  "SPAM",
  "CONVERTED",
  "ARCHIVED",
]

const leadSources: LeadSource[] = [
  "WEBSITE",
  "CHATBOT",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "CALL",
  "MEETING",
  "REFERRAL",
  "CAMPAIGN",
  "MANUAL",
  "DIRECT",
  "OTHER",
]

const leadPriorities: ServiceRequestPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]

const attentionFilters = [
  "OVERDUE",
  "MISSING_ACTION",
  "UNASSIGNED",
  "DUPLICATE_CANDIDATE",
] as const

type AttentionFilter = (typeof attentionFilters)[number]

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) return 1

  return Math.floor(page)
}

function parseEnum<T extends string>(
  value: string | undefined,
  values: readonly T[],
) {
  if (!value) return undefined

  return values.includes(value as T) ? (value as T) : undefined
}

function attentionWhere(
  attention: AttentionFilter | undefined,
  now: Date,
): Prisma.LeadWhereInput {
  const openStatuses = [...OPEN_LEAD_STATUSES] as LeadStatus[]

  switch (attention) {
    case "OVERDUE":
      return {
        status: { in: openStatuses },
        nextActionAt: { lt: now },
      }
    case "MISSING_ACTION":
      return {
        status: { in: openStatuses },
        nextActionAt: null,
      }
    case "UNASSIGNED":
      return {
        status: { in: openStatuses },
        ownerId: null,
      }
    case "DUPLICATE_CANDIDATE":
      return {
        status: { notIn: ["DUPLICATE", "SPAM", "ARCHIVED"] },
        possibleDuplicateOfId: { not: null },
      }
    default:
      return {}
  }
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    source?: string
    priority?: string
    ownerId?: string
    attention?: string
  }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.salesRead)) {
    redirect("/dashboard")
  }

  const resolvedSearchParams = await searchParams
  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseEnum(resolvedSearchParams.status, leadStatuses)
  const source = parseEnum(resolvedSearchParams.source, leadSources)
  const priority = parseEnum(
    resolvedSearchParams.priority,
    leadPriorities,
  )
  const ownerId = resolvedSearchParams.ownerId?.trim() ?? ""
  const attention = parseEnum(
    resolvedSearchParams.attention,
    attentionFilters,
  )
  const now = new Date()

  const where: Prisma.LeadWhereInput = {
    companyId: user.companyId,
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(priority ? { priority } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...attentionWhere(attention, now),
    ...(q
      ? {
          OR: [
            { contactName: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { serviceType: { contains: q, mode: "insensitive" } },
            { campaign: { contains: q, mode: "insensitive" } },
            { nextAction: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const openStatuses = [...OPEN_LEAD_STATUSES] as LeadStatus[]
  const [
    totalLeads,
    activeLeads,
    overdueLeads,
    unassignedLeads,
    duplicateCandidates,
    qualifiedLeads,
    owners,
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({
      where: {
        companyId: user.companyId,
        status: { in: openStatuses },
      },
    }),
    prisma.lead.count({
      where: {
        companyId: user.companyId,
        status: { in: openStatuses },
        nextActionAt: { lt: now },
      },
    }),
    prisma.lead.count({
      where: {
        companyId: user.companyId,
        status: { in: openStatuses },
        ownerId: null,
      },
    }),
    prisma.lead.count({
      where: {
        companyId: user.companyId,
        status: { notIn: ["DUPLICATE", "SPAM", "ARCHIVED"] },
        possibleDuplicateOfId: { not: null },
      },
    }),
    prisma.lead.count({
      where: {
        companyId: user.companyId,
        status: "QUALIFIED",
        opportunity: null,
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        role: {
          in: [...ACCESS_ROLES.salesRead],
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const rawLeads = await prisma.lead.findMany({
    where,
    orderBy: [{ nextActionAt: "asc" }, { createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      possibleDuplicateOf: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
          stage: true,
        },
      },
      serviceRequest: {
        select: {
          id: true,
          customerName: true,
          status: true,
        },
      },
    },
  })

  const leads = rawLeads.map((lead) => ({
    id: lead.id,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    serviceType: lead.serviceType,
    status: lead.status,
    source: lead.source,
    priority: lead.priority,
    campaign: lead.campaign,
    completionScore: lead.completionScore,
    contactConsent: lead.contactConsent,
    nextAction: lead.nextAction,
    nextActionAt: lead.nextActionAt?.toISOString() ?? null,
    notes: lead.notes,
    owner: lead.owner,
    possibleDuplicateOf: lead.possibleDuplicateOf,
    opportunity: lead.opportunity,
    serviceRequest: lead.serviceRequest,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }))

  const from = totalLeads === 0 ? 0 : skip + 1
  const to = Math.min(skip + leads.length, totalLeads)

  return (
    <LeadsClient
      leads={leads}
      owners={owners}
      canManage={hasRole(user.role, ACCESS_ROLES.salesManagement)}
      company={{
        timezone: user.company.timezone,
      }}
      filters={{
        q,
        status: status ?? "",
        source: source ?? "",
        priority: priority ?? "",
        ownerId,
        attention: attention ?? "",
      }}
      stats={{
        totalLeads,
        activeLeads,
        overdueLeads,
        unassignedLeads,
        duplicateCandidates,
        qualifiedLeads,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/leads"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
            source,
            priority,
            ownerId,
            attention,
          }}
          from={from}
          to={to}
          totalItems={totalLeads}
        />
      }
    />
  )
}
