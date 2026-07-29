import { redirect } from "next/navigation"

import AquaPagination from "@/components/aqua/AquaPagination"
import type { Prisma } from "@/generated/prisma/client"
import { IntakeSessionStatus } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import DiscoverySessionsClient from "./DiscoverySessionsClient"

const PAGE_SIZE = 20
const discoveryStatuses: IntakeSessionStatus[] = [
  "COLLECTING",
  "NEEDS_INFO",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "ARCHIVED",
]

function parsePage(value?: string) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) return 1

  return Math.floor(page)
}

function parseStatus(value?: string) {
  return discoveryStatuses.includes(value as IntakeSessionStatus)
    ? (value as IntakeSessionStatus)
    : undefined
}

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
  }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.discoveryRead)) {
    redirect("/dashboard")
  }

  const resolvedSearchParams = await searchParams
  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseStatus(resolvedSearchParams.status)
  const where: Prisma.IntakeSessionWhereInput = {
    companyId: user.companyId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            {
              lead: {
                contactName: { contains: q, mode: "insensitive" },
              },
            },
            {
              lead: {
                companyName: { contains: q, mode: "insensitive" },
              },
            },
            {
              lead: {
                serviceType: { contains: q, mode: "insensitive" },
              },
            },
            {
              owner: {
                name: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  }

  const [
    totalSessions,
    collectingSessions,
    needsInfoSessions,
    readySessions,
    eligibleLeads,
  ] = await Promise.all([
    prisma.intakeSession.count({ where }),
    prisma.intakeSession.count({
      where: {
        companyId: user.companyId,
        status: "COLLECTING",
      },
    }),
    prisma.intakeSession.count({
      where: {
        companyId: user.companyId,
        status: "NEEDS_INFO",
      },
    }),
    prisma.intakeSession.count({
      where: {
        companyId: user.companyId,
        status: "READY_FOR_REVIEW",
      },
    }),
    prisma.lead.findMany({
      where: {
        companyId: user.companyId,
        intakeSession: {
          is: null,
        },
        OR: [
          {
            status: {
              in: [
                "NEW",
                "CONTACTED",
                "DISCOVERY",
                "NEEDS_INFO",
                "QUALIFIED",
              ],
            },
          },
          {
            status: "CONVERTED",
            opportunity: {
              isNot: null,
            },
          },
        ],
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        contactName: true,
        companyName: true,
        serviceType: true,
        status: true,
        owner: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE
  const rawSessions = await prisma.intakeSession.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      serviceTrack: true,
      status: true,
      completionScore: true,
      updatedAt: true,
      readyForReviewAt: true,
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          serviceType: true,
          status: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
          stage: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          answers: true,
          gaps: {
            where: {
              status: "OPEN",
            },
          },
        },
      },
    },
  })
  const sessions = rawSessions.map((session) => ({
    ...session,
    updatedAt: session.updatedAt.toISOString(),
    readyForReviewAt: session.readyForReviewAt?.toISOString() ?? null,
  }))
  const from = totalSessions === 0 ? 0 : skip + 1
  const to = Math.min(skip + sessions.length, totalSessions)

  return (
    <DiscoverySessionsClient
      sessions={sessions}
      eligibleLeads={eligibleLeads}
      canManage={hasRole(
        user.role,
        ACCESS_ROLES.discoveryManagement,
      )}
      timeZone={user.company.timezone}
      filters={{
        q,
        status: status ?? "",
      }}
      stats={{
        totalSessions,
        collectingSessions,
        needsInfoSessions,
        readySessions,
        eligibleLeads: eligibleLeads.length,
        from,
        to,
        currentPage,
        totalPages,
      }}
      pagination={
        <AquaPagination
          basePath="/dashboard/discovery"
          currentPage={currentPage}
          totalPages={totalPages}
          queryParams={{
            q,
            status,
          }}
          from={from}
          to={to}
          totalItems={totalSessions}
        />
      }
    />
  )
}
