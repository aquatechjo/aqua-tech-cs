import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { minorToMoney, parseScaledDecimal } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { syncServiceRequestStage, nextProposalNumber, nextProposalVersion, nullableSalesText, optionalSalesDate } from "@/lib/sales-server"

const inputSchema = z.object({
  title: z.string().trim().min(2).max(250),
  amount: z.union([z.string(), z.number()]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  validUntil: z.string().trim().optional().nullable(),
  url: z.string().trim().url().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().nullable(),
  sendImmediately: z.boolean().optional().default(false),
})

function proposalAmount(value: string | number) {
  try {
    const minor = parseScaledDecimal(value)
    if (minor <= 0) throw new Error("ZERO")
    return minorToMoney(minor)
  } catch {
    throw new ApiError(
      "قيمة العرض يجب أن تكون أكبر من صفر وبدقتين عشريتين كحد أقصى",
      400,
      "INVALID_PROPOSAL_AMOUNT",
    )
  }
}

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
        parsed.error.issues[0]?.message ?? "بيانات العرض غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const amount = proposalAmount(parsed.data.amount)
    const validUntil = optionalSalesDate(parsed.data.validUntil)
    const meta = await getRequestMeta()

    const proposal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "SalesOpportunity"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const opportunity = await tx.salesOpportunity.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!opportunity) {
        throw new ApiError("فرصة البيع غير موجودة", 404, "OPPORTUNITY_NOT_FOUND")
      }

      if (opportunity.stage === "WON" || opportunity.stage === "LOST") {
        throw new ApiError(
          "لا يمكن إنشاء عرض لفرصة مغلقة",
          409,
          "CLOSED_OPPORTUNITY_PROPOSAL_NOT_ALLOWED",
        )
      }

      if (parsed.data.currency !== user.company.currency) {
        throw new ApiError(
          `العروض تستخدم عملة الشركة ${user.company.currency}`,
          400,
          "SALES_CURRENCY_MISMATCH",
        )
      }

      const proposalNumber = await nextProposalNumber(
        tx,
        user.companyId,
        user.company.timezone,
      )
      const version = await nextProposalVersion(
        tx,
        user.companyId,
        opportunity.id,
      )
      const sentAt = parsed.data.sendImmediately ? new Date() : null

      const created = await tx.salesProposal.create({
        data: {
          companyId: user.companyId,
          opportunityId: opportunity.id,
          createdById: user.id,
          proposalNumber,
          version,
          status: parsed.data.sendImmediately ? "SENT" : "DRAFT",
          title: parsed.data.title,
          amount,
          currency: parsed.data.currency,
          validUntil,
          url: nullableSalesText(parsed.data.url),
          notes: nullableSalesText(parsed.data.notes),
          sentAt,
        },
      })

      if (parsed.data.sendImmediately) {
        const shouldAdvance = ["NEW", "DISCOVERY", "QUALIFIED", "ON_HOLD"].includes(
          opportunity.stage,
        )
        await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: {
            ...(shouldAdvance ? { stage: "PROPOSAL" } : {}),
            probability: Math.max(opportunity.probability, 60),
            estimatedValue: amount,
          },
        })
        await syncServiceRequestStage(
          tx,
          user.companyId,
          opportunity.serviceRequestId,
          "PROPOSAL",
        )
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_PROPOSAL_CREATED,
        entityType: "SalesProposal",
        entityId: created.id,
        message: `تم إنشاء العرض ${created.proposalNumber} لفرصة ${opportunity.title}`,
        metadata: {
          opportunityId: opportunity.id,
          amount: created.amount.toString(),
          currency: created.currency,
          version: created.version,
          status: created.status,
        },
        ...meta,
      })

      if (parsed.data.sendImmediately) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.SALES_PROPOSAL_SENT,
          entityType: "SalesProposal",
          entityId: created.id,
          message: `تم إرسال العرض ${created.proposalNumber}`,
          metadata: { opportunityId: opportunity.id },
          ...meta,
        })
      }

      return created
    })

    return ok(
      {
        proposal: {
          ...proposal,
          amount: proposal.amount.toString(),
          validUntil: proposal.validUntil?.toISOString() ?? null,
          sentAt: proposal.sentAt?.toISOString() ?? null,
          acceptedAt: proposal.acceptedAt?.toISOString() ?? null,
          rejectedAt: proposal.rejectedAt?.toISOString() ?? null,
          createdAt: proposal.createdAt.toISOString(),
          updatedAt: proposal.updatedAt.toISOString(),
        },
      },
      201,
    )
  } catch (error) {
    return handleApiError(
      error,
      "SALES_PROPOSAL_POST_ERROR",
      "تعذر إنشاء العرض",
    )
  }
}
