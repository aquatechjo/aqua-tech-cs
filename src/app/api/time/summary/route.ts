import { ACCESS_ROLES, canViewCompanyTime, hasRole } from "@/lib/access-control"
import { handleApiError, ok } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  amountForMinutes,
  utilizationPercent,
  weekEndDate,
  weekStartDate,
  weekStartFromDateKey,
} from "@/lib/time"

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const requestedWeek = url.searchParams.get("weekStart")
    const weekStart = requestedWeek
      ? weekStartFromDateKey(requestedWeek)
      : weekStartDate(new Date(), user.company.timezone)
    const weekEnd = weekEndDate(weekStart)
    const requestedUserId = url.searchParams.get("userId")
    const canViewAll = canViewCompanyTime(user.role)
    const costVisible = hasRole(user.role, ACCESS_ROLES.timeCostRead)
    const selectedUserId =
      canViewAll && requestedUserId ? requestedUserId : canViewAll ? null : user.id

    const [profiles, entries, pendingApprovals] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: {
          companyId: user.companyId,
          status: { not: "TERMINATED" },
          user: {
            isActive: true,
            ...(selectedUserId ? { id: selectedUserId } : {}),
          },
        },
        orderBy: {
          user: {
            name: "asc",
          },
        },
        select: {
          userId: true,
          workHoursPerWeek: true,
          hourlyCost: true,
          billableRate: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          jobRole: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          companyId: user.companyId,
          ...(selectedUserId ? { userId: selectedUserId } : {}),
          workDate: {
            gte: weekStart,
            lt: weekEnd,
          },
          OR: [
            { startedAt: null },
            { endedAt: { not: null } },
          ],
        },
        select: {
          userId: true,
          projectId: true,
          durationMinutes: true,
          billable: true,
          hourlyCostSnapshot: true,
          billableRateSnapshot: true,
          project: {
            select: {
              id: true,
              name: true,
              code: true,
              currency: true,
            },
          },
        },
      }),
      hasRole(user.role, ACCESS_ROLES.timeApproval)
        ? prisma.timesheet.count({
            where: {
              companyId: user.companyId,
              weekStart,
              status: "SUBMITTED",
            },
          })
        : Promise.resolve(0),
    ])

    const userRows = profiles.map((profile) => {
      const userEntries = entries.filter((entry) => entry.userId === profile.userId)
      const trackedMinutes = userEntries.reduce(
        (sum, entry) => sum + entry.durationMinutes,
        0,
      )
      const billableMinutes = userEntries.reduce(
        (sum, entry) => sum + (entry.billable ? entry.durationMinutes : 0),
        0,
      )
      const cost = userEntries.reduce(
        (sum, entry) =>
          sum +
          amountForMinutes(
            entry.durationMinutes,
            Number(entry.hourlyCostSnapshot),
          ),
        0,
      )
      const revenue = userEntries.reduce(
        (sum, entry) =>
          sum +
          (entry.billable
            ? amountForMinutes(
                entry.durationMinutes,
                Number(entry.billableRateSnapshot),
              )
            : 0),
        0,
      )
      const capacityHours = Number(profile.workHoursPerWeek)

      return {
        user: profile.user,
        department: profile.department,
        jobRole: profile.jobRole,
        capacityHours,
        trackedMinutes,
        billableMinutes,
        utilizationPercent: utilizationPercent(trackedMinutes, capacityHours),
        billableUtilizationPercent: utilizationPercent(
          billableMinutes,
          capacityHours,
        ),
        cost: costVisible ? Math.round(cost * 100) / 100 : null,
        revenue: costVisible ? Math.round(revenue * 100) / 100 : null,
        margin: costVisible ? Math.round((revenue - cost) * 100) / 100 : null,
      }
    })

    const projectMap = new Map<
      string,
      {
        project: NonNullable<(typeof entries)[number]["project"]>
        trackedMinutes: number
        billableMinutes: number
        cost: number
        revenue: number
      }
    >()

    for (const entry of entries) {
      if (!entry.projectId || !entry.project) continue
      const current = projectMap.get(entry.projectId) ?? {
        project: entry.project,
        trackedMinutes: 0,
        billableMinutes: 0,
        cost: 0,
        revenue: 0,
      }
      current.trackedMinutes += entry.durationMinutes
      current.billableMinutes += entry.billable ? entry.durationMinutes : 0
      current.cost += amountForMinutes(
        entry.durationMinutes,
        Number(entry.hourlyCostSnapshot),
      )
      current.revenue += entry.billable
        ? amountForMinutes(
            entry.durationMinutes,
            Number(entry.billableRateSnapshot),
          )
        : 0
      projectMap.set(entry.projectId, current)
    }

    const projectIds = [...projectMap.keys()]
    const taskEstimates =
      projectIds.length > 0
        ? await prisma.task.groupBy({
            by: ["projectId"],
            where: {
              companyId: user.companyId,
              projectId: { in: projectIds },
              status: { notIn: ["ARCHIVED", "CANCELLED"] },
              estimatedHours: { not: null },
            },
            _sum: {
              estimatedHours: true,
            },
          })
        : []

    const estimateMap = new Map<string, number>(
      taskEstimates.map((row) => [
        row.projectId ?? "",
        Number(row._sum.estimatedHours ?? 0),
      ]),
    )

    const projectRows = [...projectMap.values()]
      .map((row) => ({
        project: row.project,
        plannedHours: estimateMap.get(row.project.id) ?? 0,
        trackedMinutes: row.trackedMinutes,
        billableMinutes: row.billableMinutes,
        cost: costVisible ? Math.round(row.cost * 100) / 100 : null,
        revenue: costVisible ? Math.round(row.revenue * 100) / 100 : null,
        margin: costVisible
          ? Math.round((row.revenue - row.cost) * 100) / 100
          : null,
      }))
      .sort((a, b) => b.trackedMinutes - a.trackedMinutes)

    const totals = userRows.reduce(
      (accumulator, row) => ({
        capacityHours: accumulator.capacityHours + row.capacityHours,
        trackedMinutes: accumulator.trackedMinutes + row.trackedMinutes,
        billableMinutes: accumulator.billableMinutes + row.billableMinutes,
        cost:
          accumulator.cost +
          (typeof row.cost === "number" ? row.cost : 0),
        revenue:
          accumulator.revenue +
          (typeof row.revenue === "number" ? row.revenue : 0),
      }),
      {
        capacityHours: 0,
        trackedMinutes: 0,
        billableMinutes: 0,
        cost: 0,
        revenue: 0,
      },
    )

    return ok({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      canViewAll,
      costVisible,
      pendingApprovals,
      totals: {
        ...totals,
        utilizationPercent: utilizationPercent(
          totals.trackedMinutes,
          totals.capacityHours,
        ),
        billableUtilizationPercent: utilizationPercent(
          totals.billableMinutes,
          totals.capacityHours,
        ),
        cost: costVisible ? Math.round(totals.cost * 100) / 100 : null,
        revenue: costVisible ? Math.round(totals.revenue * 100) / 100 : null,
        margin: costVisible
          ? Math.round((totals.revenue - totals.cost) * 100) / 100
          : null,
      },
      users: userRows,
      projects: projectRows,
    })
  } catch (error) {
    return handleApiError(
      error,
      "TIME_SUMMARY_GET_ERROR",
      "تعذر تحميل ملخص الوقت والطاقة",
    )
  }
}
