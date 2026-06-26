import AquaPagination from "@/components/aqua/AquaPagination"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ClientsClient from "./ClientsClient"

const PAGE_SIZE = 20

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await requireAuth()
  const resolvedSearchParams = await searchParams
  const requestedPage = parsePage(resolvedSearchParams.page)

  const where = {
    companyId: user.companyId,
  }

  const [totalClients, activeClients, leadsCount, archivedCount] =
    await Promise.all([
      prisma.client.count({ where }),

      prisma.client.count({
        where: {
          companyId: user.companyId,
          status: "ACTIVE",
        },
      }),

      prisma.client.count({
        where: {
          companyId: user.companyId,
          status: "LEAD",
        },
      }),

      prisma.client.count({
        where: {
          companyId: user.companyId,
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
        />
      }
    />
  )
}