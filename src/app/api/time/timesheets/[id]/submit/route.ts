import { ActivityAction } from "@/generated/prisma/enums"
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
        entries: {
          select: {
            id: true,
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
    if (existing.userId !== user.id) {
      throw new ApiError(
        "يمكن للموظف إرسال سجل ساعاته فقط",
        403,
        "TIMESHEET_SUBMIT_FORBIDDEN",
      )
    }
    if (!canTransitionTimesheet(existing.status, "SUBMITTED")) {
      throw new ApiError(
        "حالة سجل الساعات لا تسمح بالإرسال",
        409,
        "INVALID_TIMESHEET_TRANSITION",
      )
    }
    if (existing.entries.length === 0) {
      throw new ApiError(
        "لا يمكن إرسال سجل ساعات فارغ",
        409,
        "EMPTY_TIMESHEET",
      )
    }
    if (
      existing.entries.some(
        (entry) => entry.startedAt && !entry.endedAt,
      )
    ) {
      throw new ApiError(
        "أوقف المؤقت النشط قبل إرسال السجل",
        409,
        "ACTIVE_TIMER_BLOCKS_SUBMISSION",
      )
    }

    const totalMinutes = existing.entries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0,
    )
    if (totalMinutes <= 0) {
      throw new ApiError(
        "لا توجد مدة عمل قابلة للإرسال",
        409,
        "EMPTY_TIMESHEET",
      )
    }

    const submittedAt = new Date()
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: existing.id },
        data: {
          status: "SUBMITTED",
          submittedAt,
          approvedAt: null,
          approvedById: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIMESHEET_SUBMITTED,
        entityType: "Timesheet",
        entityId: existing.id,
        message: `تم إرسال سجل ساعات الأسبوع ${existing.weekStart.toISOString().slice(0, 10)} للاعتماد`,
        metadata: {
          totalMinutes,
          weekStart: existing.weekStart.toISOString(),
        },
        ...meta,
      })

      const approvers = await tx.user.findMany({
        where: {
          companyId: user.companyId,
          isActive: true,
          role: {
            in: ["OWNER", "ADMIN", "OPERATIONS_MANAGER"],
          },
          id: { not: user.id },
        },
        select: { id: true },
      })

      if (approvers.length > 0) {
        await tx.notification.createMany({
          data: approvers.map((approver) => ({
            companyId: user.companyId,
            userId: approver.id,
            title: "سجل ساعات بانتظار الاعتماد",
            message: `${user.name} أرسل سجل ساعات بقيمة ${totalMinutes} دقيقة`,
            type: "INFO" as const,
            entityType: "Timesheet",
            entityId: existing.id,
          })),
        })
      }
    })

    const timesheet = await prisma.timesheet.findUniqueOrThrow({
      where: { id: existing.id },
      include: timesheetInclude,
    })

    return ok({ timesheet: serializeTimesheet(timesheet) })
  } catch (error) {
    return handleApiError(
      error,
      "TIMESHEET_SUBMIT_ERROR",
      "تعذر إرسال سجل الساعات",
    )
  }
}
