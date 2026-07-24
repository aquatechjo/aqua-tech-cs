import { z } from "zod"
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

const inputSchema = z.object({
  type: z.nativeEnum(SalesActivityType),
  status: z.nativeEnum(SalesActivityStatus).optional(),
  subject: z.string().trim().min(2).max(250),
  details: z.string().trim().max(4000).optional().nullable(),
  outcome: z.string().trim().max(2000).optional().nullable(),
  scheduledAt: z.string().trim().optional().nullable(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id } = await params

    const parsed = inputSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات المتابعة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const opportunity = await prisma.salesOpportunity.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, title: true, stage: true },
    })
    if (!opportunity) {
      throw new ApiError("فرصة البيع غير موجودة", 404, "OPPORTUNITY_NOT_FOUND")
    }

    const status =
      parsed.data.status ?? (parsed.data.type === "NOTE" ? "COMPLETED" : "PLANNED")

    if (status === "CANCELLED") {
      throw new ApiError(
        "لا يمكن إنشاء متابعة ملغاة؛ أنشئها كمخططة ثم ألغها عند الحاجة",
        400,
        "CANCELLED_ACTIVITY_CREATE_NOT_ALLOWED",
      )
    }

    if (
      status === "PLANNED" &&
      (opportunity.stage === "WON" || opportunity.stage === "LOST")
    ) {
      throw new ApiError(
        "لا يمكن جدولة متابعة جديدة لفرصة مغلقة",
        409,
        "CLOSED_OPPORTUNITY_FOLLOW_UP_NOT_ALLOWED",
      )
    }

    const scheduledAt = optionalSalesDate(parsed.data.scheduledAt)

    if (status === "PLANNED" && !scheduledAt) {
      throw new ApiError(
        "موعد المتابعة مطلوب للنشاط المخطط",
        400,
        "ACTIVITY_SCHEDULE_REQUIRED",
      )
    }

    const completedAt = status === "COMPLETED" ? new Date() : null
    const meta = await getRequestMeta()

    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.salesActivity.create({
        data: {
          companyId: user.companyId,
          opportunityId: opportunity.id,
          createdById: user.id,
          type: parsed.data.type,
          status,
          subject: parsed.data.subject,
          details: nullableSalesText(parsed.data.details),
          outcome: nullableSalesText(parsed.data.outcome),
          scheduledAt,
          completedAt,
        },
      })

      if (completedAt && isContactActivity(created.type)) {
        await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: { lastContactAt: completedAt },
        })
      }

      await refreshOpportunityFollowUp(tx, user.companyId, opportunity.id)

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action:
          status === "COMPLETED"
            ? ActivityAction.SALES_ACTIVITY_COMPLETED
            : ActivityAction.SALES_ACTIVITY_CREATED,
        entityType: "SalesActivity",
        entityId: created.id,
        message: `تمت إضافة متابعة لفرصة ${opportunity.title}: ${created.subject}`,
        metadata: {
          opportunityId: opportunity.id,
          type: created.type,
          status: created.status,
          scheduledAt: created.scheduledAt?.toISOString() ?? null,
        },
        ...meta,
      })

      return created
    })

    return ok(
      {
        activity: {
          ...activity,
          scheduledAt: activity.scheduledAt?.toISOString() ?? null,
          completedAt: activity.completedAt?.toISOString() ?? null,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(
      error,
      "SALES_ACTIVITY_POST_ERROR",
      "تعذر إضافة المتابعة",
    )
  }
}
