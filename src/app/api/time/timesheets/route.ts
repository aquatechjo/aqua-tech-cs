import type { TimesheetStatus } from "@/generated/prisma/enums"
import { canViewCompanyTime } from "@/lib/access-control"
import { handleApiError, ok } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  weekEndDate,
  weekStartDate,
  weekStartFromDateKey,
} from "@/lib/time"
import {
  serializeTimesheet,
  timesheetInclude,
} from "@/lib/time-server"

const statuses: TimesheetStatus[] = [
  "OPEN",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]

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
    const statusValue = url.searchParams.get("status")
    const status = statuses.includes(statusValue as TimesheetStatus)
      ? (statusValue as TimesheetStatus)
      : null
    const canViewAll = canViewCompanyTime(user.role)

    const timesheets = await prisma.timesheet.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll
          ? requestedUserId
            ? { userId: requestedUserId }
            : {}
          : { userId: user.id }),
        weekStart: {
          gte: weekStart,
          lt: weekEnd,
        },
        ...(status ? { status } : {}),
      },
      orderBy: [
        { status: "asc" },
        { user: { name: "asc" } },
      ],
      include: timesheetInclude,
    })

    return ok({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      canViewAll,
      timesheets: timesheets.map((timesheet) => serializeTimesheet(timesheet)),
    })
  } catch (error) {
    return handleApiError(error, "TIME_TIMESHEETS_GET_ERROR")
  }
}
