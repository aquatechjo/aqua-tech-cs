import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { handleApiError, ok } from "@/lib/api-response"
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

export async function GET() {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesRead)

    const opportunities = await prisma.salesOpportunity.findMany({
      where: { companyId: user.companyId },
      select: {
        stage: true,
        estimatedValue: true,
        probability: true,
        nextFollowUpAt: true,
        lastContactAt: true,
        updatedAt: true,
      },
    })

    let pipelineMinor = 0
    let weightedMinor = 0
    let staleCount = 0
    let overdueFollowUps = 0
    let todayFollowUps = 0
    let wonCount = 0
    let lostCount = 0
    const byStage: Record<string, { count: number; valueMinor: number }> = {}

    for (const opportunity of opportunities) {
      const valueMinor = decimalMinor(opportunity.estimatedValue)
      const stageSummary = byStage[opportunity.stage] ?? {
        count: 0,
        valueMinor: 0,
      }
      stageSummary.count += 1
      stageSummary.valueMinor += valueMinor
      byStage[opportunity.stage] = stageSummary

      if (isOpenSalesStage(opportunity.stage)) {
        pipelineMinor += valueMinor
        weightedMinor += weightedValueMinor(valueMinor, opportunity.probability)
      }

      if (opportunity.stage === "WON") wonCount += 1
      if (opportunity.stage === "LOST") lostCount += 1

      if (isStaleOpportunity(opportunity)) staleCount += 1

      if (isOpenSalesStage(opportunity.stage)) {
        const bucket = followUpBucket({
          followUpAt: opportunity.nextFollowUpAt,
          timeZone: user.company.timezone,
        })
        if (bucket === "OVERDUE") overdueFollowUps += 1
        if (bucket === "TODAY") todayFollowUps += 1
      }
    }

    const closedCount = wonCount + lostCount

    return ok({
      summary: {
        openCount: opportunities.filter((opportunity) =>
          isOpenSalesStage(opportunity.stage),
        ).length,
        pipelineValue: minorToMoney(pipelineMinor),
        weightedValue: minorToMoney(weightedMinor),
        staleCount,
        overdueFollowUps,
        todayFollowUps,
        wonCount,
        lostCount,
        winRate: closedCount === 0 ? 0 : Math.round((wonCount / closedCount) * 100),
        currency: user.company.currency,
        byStage: Object.fromEntries(
          Object.entries(byStage).map(([stage, value]) => [
            stage,
            {
              count: value.count,
              value: minorToMoney(value.valueMinor),
            },
          ]),
        ),
      },
    })
  } catch (error) {
    return handleApiError(error, "SALES_SUMMARY_GET_ERROR")
  }
}
