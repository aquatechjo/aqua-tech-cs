import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import {
  ACCESS_ROLES,
  assertCanApproveProposal,
  assertRole,
} from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { pricingVersionContentSchema } from "@/lib/pricing"
import {
  proposalReviewIssues,
  proposalVersionContentSchema,
} from "@/lib/proposal"
import {
  assertProposalSourceReady,
  assertProposalVersionMatchesPricing,
} from "@/lib/proposal-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const reviewProposalSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUBMIT"),
  }),
  z.object({
    action: z.literal("REQUEST_CHANGES"),
    notes: z.string().trim().min(10).max(4000),
  }),
  z.object({
    action: z.literal("APPROVE"),
  }),
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    const parsed = reviewProposalSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "إجراء مراجعة العرض غير صحيح",
        400,
        parsed.error.flatten(),
      )
    }

    assertRole(
      user.role,
      parsed.data.action === "SUBMIT"
        ? ACCESS_ROLES.proposalManagement
        : ACCESS_ROLES.proposalApproval,
      "لا تملك صلاحية تنفيذ إجراء مراجعة العرض",
    )

    const { id } = await params
    const meta = await getRequestMeta()
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "IntakeSession"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const session = await tx.intakeSession.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
        select: {
          id: true,
          lead: {
            select: {
              id: true,
            },
          },
          opportunity: {
            select: {
              id: true,
            },
          },
          pricingWorkspace: {
            select: {
              id: true,
              status: true,
              currentVersion: true,
            },
          },
          proposalWorkspace: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!session) {
        throw new ApiError(
          "جلسة الاكتشاف غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      assertProposalSourceReady({
        pricingStatus: session.pricingWorkspace?.status ?? null,
        pricingVersion: session.pricingWorkspace?.currentVersion ?? 0,
      })

      if (
        !session.pricingWorkspace ||
        !session.proposalWorkspace
      ) {
        throw new ApiError(
          "احفظ إصدار عرض أولًا",
          409,
          "PROPOSAL_VERSION_REQUIRED",
        )
      }

      const pricingVersion = await tx.pricingVersion.findUnique({
        where: {
          workspaceId_version: {
            workspaceId: session.pricingWorkspace.id,
            version: session.pricingWorkspace.currentVersion,
          },
        },
      })

      if (!pricingVersion) {
        throw new ApiError(
          "إصدار التسعير المعتمد غير موجود",
          404,
          "PRICING_VERSION_NOT_FOUND",
        )
      }

      if (
        !pricingVersionContentSchema.safeParse(
          pricingVersion.content,
        ).success
      ) {
        throw new ApiError(
          "إصدار التسعير المعتمد لا يطابق عقد البيانات",
          409,
          "PRICING_VERSION_INVALID",
        )
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "ProposalWorkspace"
        WHERE "id" = ${session.proposalWorkspace.id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const workspace = await tx.proposalWorkspace.findFirst({
        where: {
          id: session.proposalWorkspace.id,
          companyId: user.companyId,
        },
      })

      if (!workspace || workspace.currentVersion < 1) {
        throw new ApiError(
          "احفظ إصدار عرض أولًا",
          409,
          "PROPOSAL_VERSION_REQUIRED",
        )
      }

      const currentVersion = await tx.proposalVersion.findUnique({
        where: {
          workspaceId_version: {
            workspaceId: workspace.id,
            version: workspace.currentVersion,
          },
        },
      })

      if (!currentVersion) {
        throw new ApiError(
          "إصدار العرض الحالي غير موجود",
          404,
          "PROPOSAL_VERSION_NOT_FOUND",
        )
      }

      const contentResult = proposalVersionContentSchema.safeParse(
        currentVersion.content,
      )

      if (!contentResult.success) {
        throw new ApiError(
          "إصدار العرض الحالي لا يطابق عقد البيانات",
          409,
          "PROPOSAL_VERSION_INVALID",
        )
      }

      const content = contentResult.data

      assertProposalVersionMatchesPricing({
        versionPricingVersion: currentVersion.pricingVersion,
        versionPricingHash: currentVersion.pricingContentHash,
        pricingVersion: pricingVersion.version,
        pricingHash: pricingVersion.contentHash,
      })

      let nextStatus = workspace.status
      let action: ActivityAction
      let message: string

      if (parsed.data.action === "SUBMIT") {
        if (
          workspace.status !== "DRAFT" &&
          workspace.status !== "CHANGES_REQUESTED"
        ) {
          throw new ApiError(
            "حالة العرض لا تسمح بإرساله للمراجعة",
            409,
            "PROPOSAL_INVALID_TRANSITION",
          )
        }

        const reviewIssues = proposalReviewIssues(content)
        if (reviewIssues.length > 0) {
          throw new ApiError(
            reviewIssues[0],
            409,
            "PROPOSAL_NOT_READY_FOR_REVIEW",
            { details: { issues: reviewIssues } },
          )
        }

        nextStatus = "IN_REVIEW"
        action = ActivityAction.PROPOSAL_SUBMITTED
        message = `تم إرسال العرض للمراجعة: الإصدار ${currentVersion.version}`

        await tx.proposalWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            submittedAt: now,
            reviewNotes: null,
            reviewedById: null,
          },
        })
      } else if (parsed.data.action === "REQUEST_CHANGES") {
        if (workspace.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن طلب التعديلات من عرض قيد المراجعة فقط",
            409,
            "PROPOSAL_INVALID_TRANSITION",
          )
        }

        nextStatus = "CHANGES_REQUESTED"
        action = ActivityAction.PROPOSAL_CHANGES_REQUESTED
        message = `طُلب تعديل العرض: الإصدار ${currentVersion.version}`

        await tx.proposalWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            reviewNotes: parsed.data.notes,
            reviewedById: user.id,
            changesRequestedAt: now,
          },
        })
      } else {
        if (workspace.status !== "IN_REVIEW") {
          throw new ApiError(
            "يمكن اعتماد عرض قيد المراجعة فقط",
            409,
            "PROPOSAL_INVALID_TRANSITION",
          )
        }

        assertCanApproveProposal(user, currentVersion.createdById)

        nextStatus = "APPROVED"
        action = ActivityAction.PROPOSAL_APPROVED
        message = `تم اعتماد العرض: الإصدار ${currentVersion.version}`

        await tx.proposalWorkspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: nextStatus,
            reviewedById: user.id,
            reviewNotes: null,
            approvedAt: now,
          },
        })

        await tx.lead.update({
          where: {
            id: session.lead.id,
          },
          data: {
            nextAction: "إرسال العرض المعتمد ومشاركته مع العميل",
            nextActionAt: null,
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action,
        entityType: "ProposalWorkspace",
        entityId: workspace.id,
        message,
        metadata: {
          intakeSessionId: session.id,
          leadId: session.lead.id,
          opportunityId: session.opportunity?.id ?? null,
          pricingWorkspaceId: session.pricingWorkspace.id,
          pricingVersion: pricingVersion.version,
          version: currentVersion.version,
          proposalNumber: workspace.proposalNumber,
          previousStatus: workspace.status,
          status: nextStatus,
          grandTotal: content.commercial.totals.grandTotal,
          currency: content.commercial.currency,
        },
        ...meta,
      })

      return {
        workspaceId: workspace.id,
        proposalNumber: workspace.proposalNumber,
        status: nextStatus,
        version: currentVersion.version,
        sendReady: nextStatus === "APPROVED",
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PROPOSAL_REVIEW_ERROR",
      "تعذر تنفيذ مراجعة العرض",
    )
  }
}
