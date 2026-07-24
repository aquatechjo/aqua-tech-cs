import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import {
  ActivityAction,
  SalesOpportunityStage,
  ServiceRequestPriority,
  ServiceRequestSource,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { opportunityTransitionState } from "@/lib/sales"
import {
  assertSalesCurrency,
  assertSalesOwner,
  nullableSalesText,
  optionalSalesDate,
  salesValue,
  syncServiceRequestStage,
} from "@/lib/sales-server"

const patchSchema = z.object({
  title: z.string().trim().min(2).max(250).optional(),
  contactName: z.string().trim().min(2).max(200).optional(),
  companyName: z.string().trim().max(250).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(80).optional().nullable(),
  serviceType: z.string().trim().min(2).max(200).optional(),
  stage: z.nativeEnum(SalesOpportunityStage).optional(),
  priority: z.nativeEnum(ServiceRequestPriority).optional(),
  source: z.nativeEnum(ServiceRequestSource).optional(),
  estimatedValue: z.union([z.string(), z.number()]).optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().trim().optional().nullable(),
  nextFollowUpAt: z.string().trim().optional().nullable(),
  ownerId: z.string().trim().optional().nullable(),
  clientId: z.string().trim().optional().nullable(),
  lostReason: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
})

function opportunityInclude() {
  return {
    client: { select: { id: true, name: true } },
    project: { select: { id: true, name: true, code: true } },
    serviceRequest: {
      select: {
        id: true,
        customerName: true,
        status: true,
        budgetRange: true,
        timeline: true,
      },
    },
    owner: { select: { id: true, name: true, email: true } },
    activities: {
      orderBy: [{ scheduledAt: "asc" as const }, { createdAt: "desc" as const }],
      include: { createdBy: { select: { id: true, name: true } } },
    },
    proposals: {
      orderBy: { version: "desc" as const },
      include: { createdBy: { select: { id: true, name: true } } },
    },
  }
}

function serializeOpportunity(opportunity: Awaited<ReturnType<typeof loadOpportunity>>) {
  if (!opportunity) return null

  return {
    ...opportunity,
    estimatedValue: opportunity.estimatedValue.toString(),
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    nextFollowUpAt: opportunity.nextFollowUpAt?.toISOString() ?? null,
    lastContactAt: opportunity.lastContactAt?.toISOString() ?? null,
    wonAt: opportunity.wonAt?.toISOString() ?? null,
    lostAt: opportunity.lostAt?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    activities: opportunity.activities.map((activity) => ({
      ...activity,
      scheduledAt: activity.scheduledAt?.toISOString() ?? null,
      completedAt: activity.completedAt?.toISOString() ?? null,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
    })),
    proposals: opportunity.proposals.map((proposal) => ({
      ...proposal,
      amount: proposal.amount.toString(),
      validUntil: proposal.validUntil?.toISOString() ?? null,
      sentAt: proposal.sentAt?.toISOString() ?? null,
      acceptedAt: proposal.acceptedAt?.toISOString() ?? null,
      rejectedAt: proposal.rejectedAt?.toISOString() ?? null,
      createdAt: proposal.createdAt.toISOString(),
      updatedAt: proposal.updatedAt.toISOString(),
    })),
  }
}

async function loadOpportunity(companyId: string, id: string) {
  return prisma.salesOpportunity.findFirst({
    where: { id, companyId },
    include: opportunityInclude(),
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesRead)
    const { id } = await params

    const opportunity = await loadOpportunity(user.companyId, id)
    if (!opportunity) {
      throw new ApiError("فرصة البيع غير موجودة", 404, "OPPORTUNITY_NOT_FOUND")
    }

    return ok({ opportunity: serializeOpportunity(opportunity) })
  } catch (error) {
    return handleApiError(error, "SALES_OPPORTUNITY_GET_ERROR")
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id } = await params

    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات الفرصة غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const existing = await prisma.salesOpportunity.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) {
      throw new ApiError("فرصة البيع غير موجودة", 404, "OPPORTUNITY_NOT_FOUND")
    }

    if (parsed.data.stage === "WON") {
      throw new ApiError(
        "تسجيل الفوز يتم من زر التحويل لضمان إنشاء العميل والمشروع بصورة مترابطة",
        409,
        "WON_REQUIRES_CONVERSION",
      )
    }

    if (
      existing.stage === "WON" &&
      (parsed.data.stage !== undefined ||
        parsed.data.estimatedValue !== undefined ||
        parsed.data.currency !== undefined ||
        parsed.data.probability !== undefined ||
        parsed.data.clientId !== undefined ||
        parsed.data.lostReason !== undefined)
    ) {
      throw new ApiError(
        "الحقول التجارية للفرصة الفائزة مقفلة؛ استخدم المشروع والمالية لأي تعديل لاحق",
        409,
        "WON_OPPORTUNITY_COMMERCIAL_FIELDS_LOCKED",
      )
    }

    if (parsed.data.clientId !== undefined && existing.projectId) {
      throw new ApiError(
        "لا يمكن تغيير العميل بعد ربط الفرصة بمشروع",
        409,
        "PROJECT_LINKED_CLIENT_LOCKED",
      )
    }

    if (parsed.data.ownerId !== undefined) {
      await assertSalesOwner(prisma, user.companyId, parsed.data.ownerId)
    }

    if (parsed.data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: parsed.data.clientId, companyId: user.companyId },
        select: { id: true },
      })
      if (!client) {
        throw new ApiError("العميل المحدد غير موجود", 404, "CLIENT_NOT_FOUND")
      }
    }

    const currency = parsed.data.currency ?? existing.currency
    if (parsed.data.currency !== undefined) {
      await assertSalesCurrency(prisma, user.companyId, currency)
    }

    const expectedCloseDate =
      parsed.data.expectedCloseDate !== undefined
        ? optionalSalesDate(parsed.data.expectedCloseDate)
        : undefined
    const nextFollowUpAt =
      parsed.data.nextFollowUpAt !== undefined
        ? optionalSalesDate(parsed.data.nextFollowUpAt)
        : undefined
    const estimatedValue =
      parsed.data.estimatedValue !== undefined
        ? salesValue(parsed.data.estimatedValue)
        : undefined

    let transition:
      | ReturnType<typeof opportunityTransitionState>
      | undefined
    const nextStage = parsed.data.stage ?? existing.stage

    if (
      parsed.data.stage !== undefined ||
      parsed.data.probability !== undefined ||
      parsed.data.lostReason !== undefined
    ) {
      try {
        transition = opportunityTransitionState({
          currentStage: existing.stage,
          nextStage,
          probability: parsed.data.probability,
          lostReason:
            parsed.data.lostReason !== undefined
              ? parsed.data.lostReason
              : existing.lostReason,
          currentLostAt: existing.lostAt,
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : "INVALID_TRANSITION"
        const messages: Record<string, string> = {
          INVALID_OPPORTUNITY_TRANSITION: "انتقال مرحلة البيع غير مسموح",
          WON_REQUIRES_CONVERSION: "الفوز يتطلب تحويل الفرصة إلى عميل ومشروع",
          LOST_REASON_REQUIRED: "سبب خسارة الفرصة مطلوب",
          INVALID_PROBABILITY: "نسبة الاحتمال يجب أن تكون بين 0 و100",
        }
        throw new ApiError(messages[code] ?? "تعذر تحديث مرحلة الفرصة", 409, code)
      }
    }

    const meta = await getRequestMeta()

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.SalesOpportunityUncheckedUpdateInput = {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.contactName !== undefined
          ? { contactName: parsed.data.contactName }
          : {}),
        ...(parsed.data.companyName !== undefined
          ? { companyName: nullableSalesText(parsed.data.companyName) }
          : {}),
        ...(parsed.data.email !== undefined
          ? { email: nullableSalesText(parsed.data.email) }
          : {}),
        ...(parsed.data.phone !== undefined
          ? { phone: nullableSalesText(parsed.data.phone) }
          : {}),
        ...(parsed.data.serviceType !== undefined
          ? { serviceType: parsed.data.serviceType }
          : {}),
        ...(parsed.data.priority !== undefined
          ? { priority: parsed.data.priority }
          : {}),
        ...(parsed.data.source !== undefined ? { source: parsed.data.source } : {}),
        ...(estimatedValue !== undefined ? { estimatedValue } : {}),
        ...(parsed.data.currency !== undefined ? { currency } : {}),
        ...(expectedCloseDate !== undefined ? { expectedCloseDate } : {}),
        ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
        ...(parsed.data.ownerId !== undefined
          ? { ownerId: parsed.data.ownerId || null }
          : {}),
        ...(parsed.data.clientId !== undefined
          ? { clientId: parsed.data.clientId || null }
          : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: nullableSalesText(parsed.data.notes) }
          : {}),
        ...(transition ?? {}),
      }

      const opportunity = await tx.salesOpportunity.update({
        where: { id: existing.id },
        data,
      })

      if (transition && opportunity.stage !== existing.stage) {
        await syncServiceRequestStage(
          tx,
          user.companyId,
          opportunity.serviceRequestId,
          opportunity.stage,
        )
      }

      const stageChanged = opportunity.stage !== existing.stage
      const action =
        opportunity.stage === "LOST" && stageChanged
          ? ActivityAction.SALES_OPPORTUNITY_LOST
          : stageChanged
            ? ActivityAction.SALES_OPPORTUNITY_STAGE_CHANGED
            : ActivityAction.SALES_OPPORTUNITY_UPDATED

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "SalesOpportunity",
        entityId: opportunity.id,
        message: stageChanged
          ? `تم نقل فرصة البيع ${opportunity.title} من ${existing.stage} إلى ${opportunity.stage}`
          : `تم تحديث فرصة البيع: ${opportunity.title}`,
        metadata: {
          previousStage: existing.stage,
          stage: opportunity.stage,
          probability: opportunity.probability,
          ownerId: opportunity.ownerId,
          lostReason: opportunity.lostReason,
        },
        ...meta,
      })

      return opportunity
    })

    const opportunity = await loadOpportunity(user.companyId, updated.id)
    return ok({ opportunity: serializeOpportunity(opportunity) })
  } catch (error) {
    return handleApiError(
      error,
      "SALES_OPPORTUNITY_PATCH_ERROR",
      "تعذر تحديث فرصة البيع",
    )
  }
}
