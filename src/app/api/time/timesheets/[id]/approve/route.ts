import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanApproveTimesheet } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"
import { canTransitionTimesheet } from "@/lib/time"
import {
  serializeTimesheet,
  timesheetInclude,
} from "@/lib/time-server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.timesheet.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        entries: {
          select: {
            durationMinutes: true,
            startedAt: true,
            endedAt: true,
          },
        },
      },
    })

    if (!existing) {
      throw new ApiError("سجل الساعات غير موجود", 404, "TIMESHEET_NOT_FOUND")
    }

    assertCanApproveTimesheet(user, existing.userId)

    if (!canTransitionTimesheet(existing.status, "APPROVED")) {
      throw new ApiError(
        "لا يمكن اعتماد سجل غير مرسل",
        409,
        "INVALID_TIMESHEET_TRANSITION",
      )
    }
    if (
      existing.entries.some(
        (entry) => entry.startedAt && !entry.endedAt,
      )
    ) {
      throw new ApiError(
        "لا يمكن اعتماد سجل يحتوي مؤقتًا نشطًا",
        409,
        "ACTIVE_TIMER_BLOCKS_APPROVAL",
      )
    }

    const totalMinutes = existing.entries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0,
    )
    const approvedAt = new Date()
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: existing.id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt,
          rejectedAt: null,
          rejectionReason: null,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIMESHEET_APPROVED,
        entityType: "Timesheet",
        entityId: existing.id,
        message: `تم اعتماد سجل ساعات ${existing.user.name}`,
        metadata: {
          ownerUserId: existing.userId,
          totalMinutes,
          weekStart: existing.weekStart.toISOString(),
        },
        ...meta,
      })

      await tx.notification.create({
        data: {
          companyId: user.companyId,
          userId: existing.userId,
          title: "تم اعتماد سجل الساعات",
          message: `اعتمد ${user.name} سجل ساعاتك للأسبوع ${existing.weekStart.toISOString().slice(0, 10)}`,
          type: "SUCCESS",
          entityType: "Timesheet",
          entityId: existing.id,
        },
      })
    })

    const timesheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: existing.id },
      include: timesheetInclude,
    })

    return ok({ timesheet: serializeTimesheet(timesheet) })
  } catch (error) {
    return handleApiError(
      error,
      "TIMESHEET_APPROVE_ERROR",
      "تعذر اعتماد سجل الساعات",
    )
  }
}
