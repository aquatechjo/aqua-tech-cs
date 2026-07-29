import AquaPagination from "@/components/aqua/AquaPagination"
import {
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ClientsClient from "./ClientsClient"

const PAGE_SIZE = 20

const clientStatuses: ClientStatus[] = [
  "LEAD",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]

const clientTypes: ClientType[] = ["COMPANY", "INDIVIDUAL"]

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

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

function parseClientStatus(value: string | undefined) {
  if (!value) return undefined

  return clientStatuses.includes(value as ClientStatus)
    ? (value as ClientStatus)
    : undefined
}

function parseClientType(value: string | undefined) {
  if (!value) return undefined

  return clientTypes.includes(value as ClientType)
    ? (value as ClientType)
    : undefined
}

function parseLeadSource(value: string | undefined) {
  if (!value) return undefined

  return leadSources.includes(value as LeadSource)
    ? (value as LeadSource)
    : undefined
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    type?: string
    source?: string
  }>
}) {
  const user = await requireAuth()
  const resolvedSearchParams = await searchParams

  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseClientStatus(resolvedSearchParams.status)
  const type = parseClientType(resolvedSearchParams.type)
  const source = parseLeadSource(resolvedSearchParams.source)

  const where = {
    companyId: user.companyId,

    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(source ? { source } : {}),

    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
            { industry: { contains: q, mode: "insensitive" as const } },
            { country: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [totalClients, activeClients, leadsCount, archivedCount] =
    await Promise.all([
      prisma.client.count({ where }),

      prisma.client.count({
        where: {
          ...where,
          status: "ACTIVE",
        },
      }),

      prisma.client.count({
        where: {
          ...where,
          status: "LEAD",
        },
      }),

      prisma.client.count({
        where: {
          ...where,
          status: "ARCHIVED",
        },
      }),
    ])

  const totalPages = Math.max(1, Math.ceil(totalClients / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const clients = await prisma.client.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      type: true,
      status: true,
      source: true,
      industry: true,
      country: true,
      city: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const from = totalClients === 0 ? 0 : skip + 1
  const to = Math.min(skip + clients.length, totalClients)

  return (
    <ClientsClient
      clients={clients}
      filters={{
        q,
        status: status ?? "",
        type: type ?? "",
        source: source ?? "",
      }}
      stats={{
        totalClients,
        activeClients,
        leadsCount,
        archivedCount,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/clients"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
            type,
            source,
          }}
          from={from}
          to={to}
          totalItems={totalClients}
        />
      }
    />
  )
}
