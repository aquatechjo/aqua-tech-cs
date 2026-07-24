import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"
import { assertTimesheetEditable, durationMinutesBetween } from "@/lib/time"
import { serializeTimeEntry, timeEntryInclude } from "@/lib/time-server"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()

    const active = await prisma.timeEntry.findFirst({
      where: {
        companyId: user.companyId,
        userId: user.id,
        startedAt: { not: null },
        endedAt: null,
      },
      include: timeEntryInclude,
    })

    if (!active || !active.startedAt) {
      throw new ApiError("لا يوجد مؤقت نشط", 404, "ACTIVE_TIMER_NOT_FOUND")
    }

    assertTimesheetEditable(active.timesheet.status)
    const endedAt = new Date()
    const durationMinutes = durationMinutesBetween(active.startedAt, endedAt)
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      await tx.timeEntry.update({
        where: { id: active.id },
        data: {
          endedAt,
          durationMinutes,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIME_TIMER_STOPPED,
        entityType: "TimeEntry",
        entityId: active.id,
        message: `تم إيقاف مؤقت العمل بعد ${durationMinutes} دقيقة`,
        metadata: {
          startedAt: active.startedAt?.toISOString(),
          endedAt: endedAt.toISOString(),
          durationMinutes,
          projectId: active.projectId,
          taskId: active.taskId,
        },
        ...meta,
      })
    })

    const entry = await prisma.timeEntry.findUniqueOrThrow({
      where: { id: active.id },
      include: timeEntryInclude,
    })

    return ok({ entry: serializeTimeEntry(entry) })
  } catch (error) {
    return handleApiError(
      error,
      "TIME_TIMER_STOP_ERROR",
      "تعذر إيقاف المؤقت",
    )
  }
}
