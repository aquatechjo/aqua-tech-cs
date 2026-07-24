import { z } from "zod"
import type { Prisma } from "@/generated/prisma/client"
import {
  ActivityAction,
  SalesProposalStatus,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { minorToMoney, parseScaledDecimal } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { proposalTransitionState } from "@/lib/sales"
import { nullableSalesText, optionalSalesDate, syncServiceRequestStage } from "@/lib/sales-server"

const patchSchema = z.object({
  status: z.nativeEnum(SalesProposalStatus).optional(),
  title: z.string().trim().min(2).max(250).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  validUntil: z.string().trim().optional().nullable(),
  url: z.string().trim().url().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().nullable(),
})

function proposalAmount(value: string | number) {
  try {
    const minor = parseScaledDecimal(value)
    if (minor <= 0) throw new Error("ZERO")
    return minorToMoney(minor)
  } catch {
    throw new ApiError("قيمة العرض غير صحيحة", 400, "INVALID_PROPOSAL_AMOUNT")
  }
}

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; proposalId: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id, proposalId } = await params

    const parsed = patchSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات العرض غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const proposal = await prisma.salesProposal.findFirst({
      where: {
        id: proposalId,
        opportunityId: id,
        companyId: user.companyId,
      },
      include: { opportunity: true },
    })
    if (!proposal) {
      throw new ApiError("العرض غير موجود", 404, "SALES_PROPOSAL_NOT_FOUND")
    }

    const nextStatus = parsed.data.status ?? proposal.status

    if (
      (proposal.opportunity.stage === "WON" ||
        proposal.opportunity.stage === "LOST") &&
      parsed.data.status !== undefined &&
      parsed.data.status !== proposal.status
    ) {
      throw new ApiError(
        "لا يمكن تغيير حالة عرض تابع لفرصة مغلقة",
        409,
        "CLOSED_OPPORTUNITY_PROPOSAL_LOCKED",
      )
    }

    let transition: ReturnType<typeof proposalTransitionState> | undefined

    if (parsed.data.status !== undefined) {
      try {
        transition = proposalTransitionState({
          currentStatus: proposal.status,
          nextStatus,
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : "INVALID_TRANSITION"
        throw new ApiError(
          "انتقال حالة العرض غير مسموح",
          409,
          code,
        )
      }
    }

    const commercialFieldsChanged =
      parsed.data.title !== undefined ||
      parsed.data.amount !== undefined ||
      parsed.data.validUntil !== undefined ||
      parsed.data.url !== undefined

    if (commercialFieldsChanged && proposal.status !== "DRAFT") {
      throw new ApiError(
        "لا يمكن تعديل قيمة أو صلاحية العرض بعد إرساله؛ أنشئ نسخة جديدة بدلًا من ذلك",
        409,
        "SENT_PROPOSAL_LOCKED",
      )
    }

    const amount =
      parsed.data.amount !== undefined
        ? proposalAmount(parsed.data.amount)
        : undefined
    const validUntil =
      parsed.data.validUntil !== undefined
        ? optionalSalesDate(parsed.data.validUntil)
        : undefined
    const meta = await getRequestMeta()

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.SalesProposalUncheckedUpdateInput = {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(validUntil !== undefined ? { validUntil } : {}),
        ...(parsed.data.url !== undefined
          ? { url: nullableSalesText(parsed.data.url) }
          : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: nullableSalesText(parsed.data.notes) }
          : {}),
        ...(transition ?? {}),
      }

      const result = await tx.salesProposal.update({
        where: { id: proposal.id },
        data,
      })

      if (result.status === "SENT" && proposal.status !== "SENT") {
        const shouldAdvance = ["NEW", "DISCOVERY", "QUALIFIED", "ON_HOLD"].includes(
          proposal.opportunity.stage,
        )
        await tx.salesOpportunity.update({
          where: { id: proposal.opportunity.id },
          data: {
            ...(shouldAdvance ? { stage: "PROPOSAL" } : {}),
            probability: Math.max(proposal.opportunity.probability, 60),
            estimatedValue: result.amount,
          },
        })
        await syncServiceRequestStage(
          tx,
          user.companyId,
          proposal.opportunity.serviceRequestId,
          "PROPOSAL",
        )
      }

      if (result.status === "ACCEPTED" && proposal.status !== "ACCEPTED") {
        await tx.salesOpportunity.update({
          where: { id: proposal.opportunity.id },
          data: {
            stage: "NEGOTIATION",
            probability: Math.max(proposal.opportunity.probability, 90),
            estimatedValue: result.amount,
          },
        })
        await syncServiceRequestStage(
          tx,
          user.companyId,
          proposal.opportunity.serviceRequestId,
          "NEGOTIATION",
        )
      }

      const action =
        result.status === "SENT" && proposal.status !== "SENT"
          ? ActivityAction.SALES_PROPOSAL_SENT
          : result.status === "ACCEPTED" && proposal.status !== "ACCEPTED"
            ? ActivityAction.SALES_PROPOSAL_ACCEPTED
            : result.status === "REJECTED" && proposal.status !== "REJECTED"
              ? ActivityAction.SALES_PROPOSAL_REJECTED
              : ActivityAction.SALES_PROPOSAL_UPDATED

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "SalesProposal",
        entityId: result.id,
        message: `تم تحديث العرض ${result.proposalNumber} إلى ${result.status}`,
        metadata: {
          opportunityId: proposal.opportunity.id,
          previousStatus: proposal.status,
          status: result.status,
          amount: result.amount.toString(),
        },
        ...meta,
      })

      return result
    })

    return ok({
      proposal: {
        ...updated,
        amount: updated.amount.toString(),
        validUntil: updated.validUntil?.toISOString() ?? null,
        sentAt: updated.sentAt?.toISOString() ?? null,
        acceptedAt: updated.acceptedAt?.toISOString() ?? null,
        rejectedAt: updated.rejectedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      "SALES_PROPOSAL_PATCH_ERROR",
      "تعذر تحديث العرض",
    )
  }
}
