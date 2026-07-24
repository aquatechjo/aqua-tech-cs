import {
  ACCESS_ROLES,
  canViewCompanyTime,
  hasRole,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import {
  amountForMinutes,
  utilizationPercent,
  weekEndDate,
  weekStartDate,
  weekStartFromDateKey,
} from "@/lib/time"
import {
  serializeTimeEntry,
  serializeTimesheet,
  timeEntryInclude,
  timesheetInclude,
} from "@/lib/time-server"
import TimeCapacityClient from "./TimeCapacityClient"

export default async function TimeCapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>
}) {
  const user = await requireAuth()
  const query = await searchParams
  const weekStart = query.weekStart
    ? weekStartFromDateKey(query.weekStart)
    : weekStartDate(new Date(), user.company.timezone)
  const weekEnd = weekEndDate(weekStart)
  const canViewAll = canViewCompanyTime(user.role)
  const canApprove = hasRole(user.role, ACCESS_ROLES.timeApproval)
  const costVisible = hasRole(user.role, ACCESS_ROLES.timeCostRead)
  const canManageRates = hasRole(user.role, ACCESS_ROLES.timeRateManagement)
  const canManageCapacity = hasRole(
    user.role,
    ACCESS_ROLES.timeCapacityManagement,
  )

  const projectAccessWhere = hasRole(
    user.role,
    ACCESS_ROLES.projectManagement,
  )
    ? {}
    : {
        OR: [
          {
            members: {
              some: {
                employeeProfile: {
                  userId: user.id,
                },
                role: { not: "VIEWER" as const },
              },
            },
          },
          {
            tasks: {
              some: {
                OR: [
                  { assignedToId: user.id },
                  { createdById: user.id },
                  {
                    participants: {
                      some: {
                        employeeProfile: { userId: user.id },
                        role: { not: "OBSERVER" as const },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      }

  const [
    timesheets,
    activeTimer,
    profiles,
    projects,
    tasks,
  ] = await Promise.all([
    prisma.timesheet.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll ? {} : { userId: user.id }),
        weekStart,
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      include: timesheetInclude,
    }),
    prisma.timeEntry.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        startedAt: { not: null },
        endedAt: null,
      },
      include: timeEntryInclude,
    }),
    prisma.employeeProfile.findMany({
      where: {
        companyId: user.companyId,
        status: { not: "TERMINATED" },
        user: {
          isActive: true,
          ...(canViewAll ? {} : { id: user.id }),
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
      select: {
        id: true,
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
    prisma.project.findMany({
      where: {
        companyId: user.companyId,
        status: { notIn: ["ARCHIVED", "CANCELLED"] },
        ...projectAccessWhere,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
        currency: true,
      },
    }),
    prisma.task.findMany({
      where: {
        companyId: user.companyId,
        status: { notIn: ["ARCHIVED", "CANCELLED"] },
        ...(hasRole(user.role, ACCESS_ROLES.taskManagement)
          ? {}
          : {
              OR: [
                { assignedToId: user.id },
                { createdById: user.id },
                {
                  participants: {
                    some: {
                      employeeProfile: {
                        userId: user.id,
                      },
                      role: { not: "OBSERVER" },
                    },
                  },
                },
                {
                  project: {
                    members: {
                      some: {
                        employeeProfile: {
                          userId: user.id,
                        },
                        role: { in: ["PROJECT_LEAD", "MANAGER"] },
                      },
                    },
                  },
                },
              ],
            }),
      },
      orderBy: [{ project: { name: "asc" } }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        projectId: true,
        estimatedHours: true,
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ])

  const serializedTimesheets = timesheets.map((timesheet) => serializeTimesheet(timesheet))
  const completedEntries = timesheets.flatMap((timesheet) =>
    timesheet.entries.filter((entry) => !entry.startedAt || entry.endedAt),
  )

  const employees = profiles.map((profile) => {
    const employeeEntries = completedEntries.filter(
      (entry) => entry.userId === profile.userId,
    )
    const trackedMinutes = employeeEntries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0,
    )
    const billableMinutes = employeeEntries.reduce(
      (sum, entry) => sum + (entry.billable ? entry.durationMinutes : 0),
      0,
    )
    const cost = employeeEntries.reduce(
      (sum, entry) =>
        sum +
        amountForMinutes(
          entry.durationMinutes,
          Number(entry.hourlyCostSnapshot),
        ),
      0,
    )
    const revenue = employeeEntries.reduce(
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
      id: profile.id,
      userId: profile.userId,
      user: profile.user,
      department: profile.department,
      jobRole: profile.jobRole,
      workHoursPerWeek: profile.workHoursPerWeek.toString(),
      hourlyCost: costVisible ? profile.hourlyCost.toString() : null,
      billableRate: costVisible ? profile.billableRate.toString() : null,
      trackedMinutes,
      billableMinutes,
      utilizationPercent: utilizationPercent(trackedMinutes, capacityHours),
      cost: costVisible ? Math.round(cost * 100) / 100 : null,
      revenue: costVisible ? Math.round(revenue * 100) / 100 : null,
      margin: costVisible ? Math.round((revenue - cost) * 100) / 100 : null,
      timesheetStatus:
        timesheets.find((timesheet) => timesheet.userId === profile.userId)
          ?.status ?? null,
    }
  })

  const projectMap = new Map<
    string,
    {
      project: {
        id: string
        name: string
        code: string | null
        currency: string
      }
      trackedMinutes: number
      billableMinutes: number
      cost: number
      revenue: number
    }
  >()

  for (const entry of completedEntries) {
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

  const projectSummary = [...projectMap.values()]
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

  const totals = employees.reduce(
    (accumulator, employee) => ({
      capacityHours:
        accumulator.capacityHours + Number(employee.workHoursPerWeek),
      trackedMinutes: accumulator.trackedMinutes + employee.trackedMinutes,
      billableMinutes:
        accumulator.billableMinutes + employee.billableMinutes,
      cost:
        accumulator.cost +
        (typeof employee.cost === "number" ? employee.cost : 0),
      revenue:
        accumulator.revenue +
        (typeof employee.revenue === "number" ? employee.revenue : 0),
    }),
    {
      capacityHours: 0,
      trackedMinutes: 0,
      billableMinutes: 0,
      cost: 0,
      revenue: 0,
    },
  )

  return (
    <TimeCapacityClient
      currentUserId={user.id}
      currency={user.company.currency}
      today={localDateKey(new Date(), user.company.timezone)}
      serverNow={new Date().getTime()}
      weekStart={weekStart.toISOString()}
      weekEnd={weekEnd.toISOString()}
      permissions={{
        canViewAll,
        canApprove,
        canSelfApprove: user.role === "OWNER",
        costVisible,
        canManageRates,
        canManageCapacity,
      }}
      activeTimer={
        activeTimer ? serializeTimeEntry(activeTimer) : null
      }
      projects={projects}
      tasks={tasks.map((task) => ({
        ...task,
        estimatedHours: task.estimatedHours?.toString() ?? null,
      }))}
      timesheets={serializedTimesheets}
      employees={employees}
      projectSummary={projectSummary}
      totals={{
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
        revenue: costVisible
          ? Math.round(totals.revenue * 100) / 100
          : null,
        margin: costVisible
          ? Math.round((totals.revenue - totals.cost) * 100) / 100
          : null,
        pendingApprovals: timesheets.filter(
          (timesheet) => timesheet.status === "SUBMITTED",
        ).length,
      }}
    />
  )
}
