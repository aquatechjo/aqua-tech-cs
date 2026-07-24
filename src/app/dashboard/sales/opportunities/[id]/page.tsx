import { notFound, redirect } from "next/navigation"
import OpportunityDetailClient from "./OpportunityDetailClient"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function SalesOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.salesRead)) {
    redirect("/dashboard")
  }

  const { id } = await params
  const [opportunity, users, clients] = await Promise.all([
    prisma.salesOpportunity.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, status: true } },
        project: { select: { id: true, name: true, code: true, status: true } },
        serviceRequest: {
          select: {
            id: true,
            customerName: true,
            status: true,
            budgetRange: true,
            timeline: true,
            proposalUrl: true,
          },
        },
        activities: {
          orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
          include: { createdBy: { select: { id: true, name: true } } },
        },
        proposals: {
          orderBy: { version: "desc" },
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.client.findMany({
      where: { companyId: user.companyId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!opportunity) notFound()

  return (
    <OpportunityDetailClient
      opportunity={{
        id: opportunity.id,
        title: opportunity.title,
        contactName: opportunity.contactName,
        companyName: opportunity.companyName,
        email: opportunity.email,
        phone: opportunity.phone,
        serviceType: opportunity.serviceType,
        stage: opportunity.stage,
        priority: opportunity.priority,
        source: opportunity.source,
        estimatedValue: opportunity.estimatedValue.toString(),
        currency: opportunity.currency,
        probability: opportunity.probability,
        expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
        nextFollowUpAt: opportunity.nextFollowUpAt?.toISOString() ?? null,
        lastContactAt: opportunity.lastContactAt?.toISOString() ?? null,
        lostReason: opportunity.lostReason,
        notes: opportunity.notes,
        wonAt: opportunity.wonAt?.toISOString() ?? null,
        lostAt: opportunity.lostAt?.toISOString() ?? null,
        owner: opportunity.owner,
        client: opportunity.client,
        project: opportunity.project,
        serviceRequest: opportunity.serviceRequest,
        activities: opportunity.activities.map((activity) => ({
          ...activity,
          scheduledAt: activity.scheduledAt?.toISOString() ?? null,
          completedAt: activity.completedAt?.toISOString() ?? null,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        })),
        proposals: opportunity.proposals.map((proposal) => ({
          ...proposal,
          amount: proposal.amount.toString(),
          validUntil: proposal.validUntil?.toISOString() ?? null,
          sentAt: proposal.sentAt?.toISOString() ?? null,
          acceptedAt: proposal.acceptedAt?.toISOString() ?? null,
          rejectedAt: proposal.rejectedAt?.toISOString() ?? null,
          createdAt: proposal.createdAt.toISOString(),
          updatedAt: proposal.updatedAt.toISOString(),
        })),
        createdAt: opportunity.createdAt.toISOString(),
        updatedAt: opportunity.updatedAt.toISOString(),
      }}
      users={users}
      clients={clients}
      company={{ currency: user.company.currency, timezone: user.company.timezone }}
      canManage={hasRole(user.role, ACCESS_ROLES.salesManagement)}
    />
  )
}
