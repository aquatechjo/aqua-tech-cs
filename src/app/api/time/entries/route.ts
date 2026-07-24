import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { canViewCompanyTime } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import {
  dateKeyToUtc,
  normalizeDurationMinutes,
  weekEndDate,
  weekStartDate,
  weekStartFromDateKey,
} from "@/lib/time"
import {
  assertTimeTargetAccess,
  employeeTimeProfile,
  ensureTimesheet,
  makeRejectedTimesheetEditable,
  nullableTimeText,
  serializeTimeEntry,
  timeEntryInclude,
} from "@/lib/time-server"

const entrySchema = z.object({
  workDate: z.string().trim(),
  durationMinutes: z.union([z.string(), z.number()]),
  projectId: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  billable: z.boolean().optional().default(true),
})

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
    const projectId = url.searchParams.get("projectId")
    const canViewAll = canViewCompanyTime(user.role)

    const entries = await prisma.timeEntry.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewAll
          ? requestedUserId
            ? { userId: requestedUserId }
            : {}
          : { userId: user.id }),
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      include: timeEntryInclude,
    })

    return ok({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      canViewAll,
      entries: entries.map((entry) => serializeTimeEntry(entry)),
    })
  } catch (error) {
    return handleApiError(error, "TIME_ENTRIES_GET_ERROR")
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const parsed = entrySchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات سجل الوقت غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const workDate = dateKeyToUtc(parsed.data.workDate)
    if (parsed.data.workDate > localDateKey(new Date(), user.company.timezone)) {
      throw new ApiError(
        "لا يمكن تسجيل ساعات على تاريخ مستقبلي",
        400,
        "FUTURE_TIME_ENTRY",
      )
    }

    const durationMinutes = normalizeDurationMinutes(parsed.data.durationMinutes)
    const target = await assertTimeTargetAccess(user, {
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
    })
    const profile = await employeeTimeProfile(prisma, user.companyId, user.id)
    const meta = await getRequestMeta()

    const createdId = await prisma.$transaction(async (tx) => {
      const timesheet = await ensureTimesheet(tx, {
        companyId: user.companyId,
        userId: user.id,
        workDate,
      })
      await makeRejectedTimesheetEditable(tx, timesheet)

      const created = await tx.timeEntry.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          timesheetId: timesheet.id,
          projectId: target.projectId,
          taskId: target.taskId,
          workDate,
          durationMinutes,
          description: nullableTimeText(parsed.data.description),
          billable: parsed.data.billable,
          hourlyCostSnapshot: profile.hourlyCost,
          billableRateSnapshot: profile.billableRate,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIME_ENTRY_CREATED,
        entityType: "TimeEntry",
        entityId: created.id,
        message: `تم تسجيل ${durationMinutes} دقيقة عمل`,
        metadata: {
          projectId: created.projectId,
          taskId: created.taskId,
          workDate: created.workDate.toISOString(),
          durationMinutes,
          billable: created.billable,
        },
        ...meta,
      })

      return created.id
    })

    const entry = await prisma.timeEntry.findUniqueOrThrow({
      where: { id: createdId },
      include: timeEntryInclude,
    })

    return ok({ entry: serializeTimeEntry(entry) }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "TIME_ENTRIES_POST_ERROR",
      "تعذر تسجيل ساعات العمل",
    )
  }
}
