import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { assertCanApproveTimesheet } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { canTransitionTimesheet } from "@/lib/time"
import {
  serializeTimesheet,
  timesheetInclude,
} from "@/lib/time-server"

const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const parsed = rejectSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "سبب الرفض مطلوب",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

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
      },
    })

    if (!existing) {
      throw new ApiError("سجل الساعات غير موجود", 404, "TIMESHEET_NOT_FOUND")
    }

    assertCanApproveTimesheet(user, existing.userId)

    if (!canTransitionTimesheet(existing.status, "REJECTED")) {
      throw new ApiError(
        "لا يمكن رفض سجل غير مرسل",
        409,
        "INVALID_TIMESHEET_TRANSITION",
      )
    }

    const rejectedAt = new Date()
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: existing.id },
        data: {
          status: "REJECTED",
          approvedById: null,
          approvedAt: null,
          rejectedAt,
          rejectionReason: parsed.data.reason,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIMESHEET_REJECTED,
        entityType: "Timesheet",
        entityId: existing.id,
        message: `تم رفض سجل ساعات ${existing.user.name}`,
        metadata: {
          ownerUserId: existing.userId,
          reason: parsed.data.reason,
          weekStart: existing.weekStart.toISOString(),
        },
        ...meta,
      })

      await tx.notification.create({
        data: {
          companyId: user.companyId,
          userId: existing.userId,
          title: "يحتاج سجل الساعات إلى تعديل",
          message: parsed.data.reason,
          type: "WARNING",
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
      "TIMESHEET_REJECT_ERROR",
      "تعذر رفض سجل الساعات",
    )
  }
}
