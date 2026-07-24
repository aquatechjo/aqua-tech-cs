import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { businessDate } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import {
  assertTimeTargetAccess,
  employeeTimeProfile,
  ensureTimesheet,
  makeRejectedTimesheetEditable,
  nullableTimeText,
  serializeTimeEntry,
  timeEntryInclude,
} from "@/lib/time-server"

const timerSchema = z.object({
  projectId: z.string().trim().optional().nullable(),
  taskId: z.string().trim().optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  billable: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const parsed = timerSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات المؤقت غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const active = await prisma.timeEntry.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        startedAt: { not: null },
        endedAt: null,
      },
      select: { id: true },
    })
    if (active) {
      throw new ApiError(
        "لديك مؤقت نشط بالفعل؛ أوقفه قبل بدء مؤقت جديد",
        409,
        "ACTIVE_TIMER_EXISTS",
      )
    }

    const target = await assertTimeTargetAccess(user, {
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
    })
    const profile = await employeeTimeProfile(prisma, user.companyId, user.id)
    const startedAt = new Date()
    const workDate = businessDate(startedAt, user.company.timezone)
    const meta = await getRequestMeta()

    const createdId = await prisma.$transaction(async (tx) => {
      const timesheet = await ensureTimesheet(tx, {
        companyId: user.companyId,
        userId: user.id,
        workDate,
      })
      await makeRejectedTimesheetEditable(tx, timesheet)

      const entry = await tx.timeEntry.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          timesheetId: timesheet.id,
          projectId: target.projectId,
          taskId: target.taskId,
          workDate,
          description: nullableTimeText(parsed.data.description),
          durationMinutes: 0,
          billable: parsed.data.billable,
          hourlyCostSnapshot: profile.hourlyCost,
          billableRateSnapshot: profile.billableRate,
          startedAt,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIME_TIMER_STARTED,
        entityType: "TimeEntry",
        entityId: entry.id,
        message: "تم بدء مؤقت العمل",
        metadata: {
          projectId: entry.projectId,
          taskId: entry.taskId,
          startedAt: startedAt.toISOString(),
          billable: entry.billable,
        },
        ...meta,
      })

      return entry.id
    })

    const entry = await prisma.timeEntry.findUniqueOrThrow({
      where: { id: createdId },
      include: timeEntryInclude,
    })

    return ok({ entry: serializeTimeEntry(entry) }, 201)
  } catch (error) {
    return handleApiError(
      error,
      "TIME_TIMER_START_ERROR",
      "تعذر بدء المؤقت",
    )
  }
}
