import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import {
  ActivityAction,
  SalesActivityStatus,
  SalesActivityType,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import {
  isContactActivity,
  nullableSalesText,
  optionalSalesDate,
  refreshOpportunityFollowUp,
} from "@/lib/sales-server"

const patchSchema = z.object({
  type: z.nativeEnum(SalesActivityType).optional(),
  status: z.nativeEnum(SalesActivityStatus).optional(),
  subject: z.string().trim().min(2).max(250).optional(),
  details: z.string().trim().max(4000).optional().nullable(),
  outcome: z.string().trim().max(2000).optional().nullable(),
  scheduledAt: z.string().trim().optional().nullable(),
})

function canTransition(current: SalesActivityStatus, next: SalesActivityStatus) {
  if (current === next) return true
  if (current === "PLANNED") return next === "COMPLETED" || next === "CANCELLED"
  if (current === "CANCELLED") return next === "PLANNED"
  return false
}

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; activityId: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id, activityId } = await params

    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات المتابعة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const activity = await prisma.salesActivity.findFirst({
      where: {
        id: activityId,
        opportunityId: id,
        companyId: user.companyId,
      },
      include: {
        opportunity: { select: { id: true, title: true, stage: true } },
      },
    })
    if (!activity) {
      throw new ApiError("المتابعة غير موجودة", 404, "SALES_ACTIVITY_NOT_FOUND")
    }

    const nextStatus = parsed.data.status ?? activity.status

    if (
      activity.status === "COMPLETED" &&
      parsed.data.type !== undefined &&
      parsed.data.type !== activity.type
    ) {
      throw new ApiError(
        "لا يمكن تغيير نوع متابعة مكتملة حفاظًا على سجل التواصل",
        409,
        "COMPLETED_ACTIVITY_TYPE_LOCKED",
      )
    }

    if (
      nextStatus === "PLANNED" &&
      (activity.opportunity.stage === "WON" ||
        activity.opportunity.stage === "LOST")
    ) {
      throw new ApiError(
        "لا يمكن جدولة متابعة لفرصة مغلقة",
        409,
        "CLOSED_OPPORTUNITY_FOLLOW_UP_NOT_ALLOWED",
      )
    }

    if (!canTransition(activity.status, nextStatus)) {
      throw new ApiError(
        "انتقال حالة المتابعة غير مسموح",
        409,
        "INVALID_ACTIVITY_TRANSITION",
      )
    }

    const scheduledAt =
      parsed.data.scheduledAt !== undefined
        ? optionalSalesDate(parsed.data.scheduledAt)
        : activity.scheduledAt

    if (nextStatus === "PLANNED" && !scheduledAt) {
      throw new ApiError(
        "موعد المتابعة مطلوب للنشاط المخطط",
        400,
        "ACTIVITY_SCHEDULE_REQUIRED",
      )
    }

    const completedAt =
      nextStatus === "COMPLETED"
        ? activity.completedAt ?? new Date()
        : null
    const meta = await getRequestMeta()

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.SalesActivityUncheckedUpdateInput = {
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.status !== undefined ? { status: nextStatus } : {}),
        ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject } : {}),
        ...(parsed.data.details !== undefined
          ? { details: nullableSalesText(parsed.data.details) }
          : {}),
        ...(parsed.data.outcome !== undefined
          ? { outcome: nullableSalesText(parsed.data.outcome) }
          : {}),
        ...(parsed.data.scheduledAt !== undefined ? { scheduledAt } : {}),
        ...(parsed.data.status !== undefined ? { completedAt } : {}),
      }

      const result = await tx.salesActivity.update({
        where: { id: activity.id },
        data,
      })

      if (
        result.status === "COMPLETED" &&
        isContactActivity(result.type) &&
        activity.status !== "COMPLETED"
      ) {
        await tx.salesOpportunity.update({
          where: { id: activity.opportunity.id },
          data: { lastContactAt: result.completedAt },
        })
      }

      await refreshOpportunityFollowUp(
        tx,
        user.companyId,
        activity.opportunity.id,
      )

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action:
          result.status === "COMPLETED" && activity.status !== "COMPLETED"
            ? ActivityAction.SALES_ACTIVITY_COMPLETED
            : ActivityAction.SALES_ACTIVITY_UPDATED,
        entityType: "SalesActivity",
        entityId: result.id,
        message: `تم تحديث متابعة فرصة ${activity.opportunity.title}: ${result.subject}`,
        metadata: {
          opportunityId: activity.opportunity.id,
          previousStatus: activity.status,
          status: result.status,
        },
        ...meta,
      })

      return result
    })

    return ok({
      activity: {
        ...updated,
        scheduledAt: updated.scheduledAt?.toISOString() ?? null,
        completedAt: updated.completedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      "SALES_ACTIVITY_PATCH_ERROR",
      "تعذر تحديث المتابعة",
    )
  }
}
