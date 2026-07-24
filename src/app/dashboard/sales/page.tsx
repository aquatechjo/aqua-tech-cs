import { redirect } from "next/navigation"
import SalesPipelineClient from "./SalesPipelineClient"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { decimalMinor } from "@/lib/finance-server"
import { minorToMoney } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import {
  followUpBucket,
  isOpenSalesStage,
  isStaleOpportunity,
  weightedValueMinor,
} from "@/lib/sales"

export default async function SalesPage() {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.salesRead)) {
    redirect("/dashboard")
  }

  const [rawOpportunities, serviceRequests, users, clients] = await Promise.all([
    prisma.salesOpportunity.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ stage: "asc" }, { updatedAt: "desc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, code: true } },
        serviceRequest: { select: { id: true, customerName: true, status: true } },
        activities: {
          where: { status: "PLANNED", scheduledAt: { not: null } },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { id: true, subject: true, scheduledAt: true },
        },
        proposals: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            proposalNumber: true,
            version: true,
            status: true,
            amount: true,
          },
        },
        _count: { select: { activities: true, proposals: true } },
      },
    }),
    prisma.serviceRequest.findMany({
      where: {
        companyId: user.companyId,
        salesOpportunity: null,
        status: { notIn: ["CONVERTED", "ARCHIVED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        customerName: true,
        customerCompany: true,
        serviceType: true,
        status: true,
        priority: true,
        createdAt: true,
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

  const opportunities = rawOpportunities.map((opportunity) => {
    const isOpen = isOpenSalesStage(opportunity.stage)
    const stale = isStaleOpportunity(opportunity)
    const followUp = isOpen
      ? followUpBucket({
          followUpAt: opportunity.nextFollowUpAt,
          timeZone: user.company.timezone,
        })
      : ("NONE" as const)

    return {
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
      owner: opportunity.owner,
      client: opportunity.client,
      project: opportunity.project,
      serviceRequest: opportunity.serviceRequest,
      nextActivity: opportunity.activities[0]
        ? {
            ...opportunity.activities[0],
            scheduledAt: opportunity.activities[0].scheduledAt?.toISOString() ?? null,
          }
        : null,
      latestProposal: opportunity.proposals[0]
        ? {
            ...opportunity.proposals[0],
            amount: opportunity.proposals[0].amount.toString(),
          }
        : null,
      activityCount: opportunity._count.activities,
      proposalCount: opportunity._count.proposals,
      stale,
      followUp,
      createdAt: opportunity.createdAt.toISOString(),
      updatedAt: opportunity.updatedAt.toISOString(),
    }
  })

  const summary = opportunities.reduce(
    (current, opportunity) => {
      const isOpen = isOpenSalesStage(opportunity.stage)
      const valueMinor = decimalMinor(opportunity.estimatedValue)

      return {
        openCount: current.openCount + (isOpen ? 1 : 0),
        pipelineMinor: current.pipelineMinor + (isOpen ? valueMinor : 0),
        weightedMinor:
          current.weightedMinor +
          (isOpen ? weightedValueMinor(valueMinor, opportunity.probability) : 0),
        staleCount: current.staleCount + (opportunity.stale ? 1 : 0),
        overdueFollowUps:
          current.overdueFollowUps + (opportunity.followUp === "OVERDUE" ? 1 : 0),
        todayFollowUps:
          current.todayFollowUps + (opportunity.followUp === "TODAY" ? 1 : 0),
        wonCount: current.wonCount + (opportunity.stage === "WON" ? 1 : 0),
        lostCount: current.lostCount + (opportunity.stage === "LOST" ? 1 : 0),
      }
    },
    {
      openCount: 0,
      pipelineMinor: 0,
      weightedMinor: 0,
      staleCount: 0,
      overdueFollowUps: 0,
      todayFollowUps: 0,
      wonCount: 0,
      lostCount: 0,
    },
  )

  const closedCount = summary.wonCount + summary.lostCount

  return (
    <SalesPipelineClient
      opportunities={opportunities}
      serviceRequests={serviceRequests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
      }))}
      users={users}
      clients={clients}
      company={{
        currency: user.company.currency,
        timezone: user.company.timezone,
      }}
      canManage={hasRole(user.role, ACCESS_ROLES.salesManagement)}
      summary={{
        openCount: summary.openCount,
        pipelineValue: minorToMoney(summary.pipelineMinor),
        weightedValue: minorToMoney(summary.weightedMinor),
        staleCount: summary.staleCount,
        overdueFollowUps: summary.overdueFollowUps,
        todayFollowUps: summary.todayFollowUps,
        wonCount: summary.wonCount,
        lostCount: summary.lostCount,
        winRate:
          closedCount === 0 ? 0 : Math.round((summary.wonCount / closedCount) * 100),
      }}
    />
  )
}
