import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import {
  loadPublicProposalForUpdate,
  publicProposalDeliverySelect,
  serializePublicProposal,
} from "@/lib/proposal-delivery-server"
import {
  isValidProposalPublicToken,
  PROPOSAL_RESPONSE_STATEMENT_VERSION,
  proposalClientResponseSchema,
  proposalDecisionForAction,
  proposalWorkspaceStatusForDecision,
} from "@/lib/proposal-delivery"
import { proposalVersionContentSchema } from "@/lib/proposal"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  assertSameOrigin,
  getClientIp,
  hashOpaqueValue,
  readJsonBody,
} from "@/lib/request-security"

function publicProposalUnavailable() {
  return new ApiError(
    "رابط العرض غير متاح أو انتهت صلاحيته",
    404,
    "PROPOSAL_PUBLIC_LINK_UNAVAILABLE",
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request)

    const { token } = await params
    if (!isValidProposalPublicToken(token)) {
      throw publicProposalUnavailable()
    }

    const tokenHash = hashOpaqueValue(token)
    const clientIp = getClientIp(request)
    await enforceRateLimit({
      namespace: "public-proposal-response",
      identifier: `${tokenHash}:${clientIp}`,
      limit: 40,
      windowMs: 60 * 60 * 1000,
    })

    const parsed = proposalClientResponseSchema.safeParse(
      await readJsonBody(request, 12 * 1024),
    )
    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "بيانات الرد على العرض غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const now = new Date()
    const userAgent = request.headers.get("user-agent")
    const result = await prisma.$transaction(async (tx) => {
      const delivery = await loadPublicProposalForUpdate({
        db: tx,
        tokenHash,
        now,
      })

      if (parsed.data.action === "VIEW") {
        const firstView = delivery.firstViewedAt === null

        await tx.proposalDelivery.update({
          where: { id: delivery.id },
          data: {
            firstViewedAt: delivery.firstViewedAt ?? now,
            lastViewedAt: now,
            viewCount: {
              increment: 1,
            },
          },
        })

        if (firstView) {
          await logActivity({
            db: tx,
            companyId: delivery.companyId,
            action: ActivityAction.PROPOSAL_VIEWED,
            entityType: "ProposalWorkspace",
            entityId: delivery.workspace.id,
            message: `فتح العميل العرض ${delivery.workspace.proposalNumber}`,
            metadata: {
              deliveryId: delivery.id,
              version: delivery.version,
              channel: delivery.channel,
            },
            ipAddress: clientIp,
            userAgent,
          })
        }

        return {
          state: serializePublicProposal(delivery),
          viewed: true,
        }
      }

      const existingResponse =
        await tx.proposalClientResponse.findUnique({
          where: {
            workspaceId_version: {
              workspaceId: delivery.workspace.id,
              version: delivery.version,
            },
          },
        })

      if (existingResponse) {
        return {
          state: serializePublicProposal(delivery),
          decision: existingResponse.decision,
          replayed: true,
        }
      }

      if (delivery.workspace.status !== "SENT") {
        throw new ApiError(
          "تم تسجيل رد على هذا الإصدار مسبقًا",
          409,
          "PROPOSAL_ALREADY_RESPONDED",
        )
      }

      const version = delivery.workspace.versions.find(
        (candidate) => candidate.version === delivery.version,
      )
      const content = proposalVersionContentSchema.safeParse(
        version?.content,
      )
      if (
        !version ||
        version.clientContentHash !== delivery.clientContentHash ||
        !content.success
      ) {
        throw publicProposalUnavailable()
      }

      const decision = proposalDecisionForAction(parsed.data.action)
      const workspaceStatus =
        proposalWorkspaceStatusForDecision(decision)
      const response = await tx.proposalClientResponse.create({
        data: {
          companyId: delivery.companyId,
          workspaceId: delivery.workspace.id,
          deliveryId: delivery.id,
          version: delivery.version,
          clientContentHash: delivery.clientContentHash,
          decision,
          responderName: parsed.data.responderName,
          responderEmail: parsed.data.responderEmail,
          responderTitle: parsed.data.responderTitle ?? null,
          notes: parsed.data.notes?.trim() || null,
          authorityConfirmed: true,
          ipAddress: clientIp,
          userAgent,
          respondedAt: now,
        },
      })

      await tx.proposalWorkspace.update({
        where: { id: delivery.workspace.id },
        data: {
          status: workspaceStatus,
          clientRespondedAt: now,
          clientResponseName: response.responderName,
          clientResponseEmail: response.responderEmail,
          clientResponseTitle: response.responderTitle,
          clientResponseNotes: response.notes,
        },
      })

      const opportunity = delivery.workspace.opportunity
      if (opportunity) {
        if (decision === "ACCEPTED") {
          await tx.salesOpportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: "NEGOTIATION",
              probability: 90,
              estimatedValue:
                content.data.commercial.totals.grandTotal,
              lastContactAt: now,
              nextFollowUpAt: null,
              lostReason: null,
              lostAt: null,
            },
          })
          await tx.salesProposal.updateMany({
            where: {
              companyId: delivery.companyId,
              opportunityId: opportunity.id,
              version: delivery.version,
              status: "SENT",
            },
            data: {
              status: "ACCEPTED",
              acceptedAt: now,
            },
          })
          if (opportunity.serviceRequestId) {
            await tx.serviceRequest.updateMany({
              where: {
                id: opportunity.serviceRequestId,
                companyId: delivery.companyId,
                status: { not: "CONVERTED" },
              },
              data: {
                status: "APPROVED",
                approvedAt: now,
              },
            })
          }
        } else if (decision === "CHANGES_REQUESTED") {
          await tx.salesOpportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: "NEGOTIATION",
              probability: Math.max(opportunity.probability, 80),
              lastContactAt: now,
              nextFollowUpAt: now,
            },
          })
        } else {
          const reason = `رفض العميل العرض: ${response.notes}`
          await tx.salesOpportunity.update({
            where: { id: opportunity.id },
            data: {
              stage: "LOST",
              probability: 0,
              lostReason: reason,
              lostAt: now,
              nextFollowUpAt: null,
            },
          })
          await tx.salesProposal.updateMany({
            where: {
              companyId: delivery.companyId,
              opportunityId: opportunity.id,
              version: delivery.version,
              status: "SENT",
            },
            data: {
              status: "REJECTED",
              rejectedAt: now,
            },
          })
          if (opportunity.serviceRequestId) {
            await tx.serviceRequest.updateMany({
              where: {
                id: opportunity.serviceRequestId,
                companyId: delivery.companyId,
                status: { not: "CONVERTED" },
              },
              data: {
                status: "REJECTED",
                rejectedAt: now,
              },
            })
          }
        }
      }

      const leadId = delivery.workspace.intakeSession.lead.id
      await tx.lead.update({
        where: { id: leadId },
        data:
          decision === "ACCEPTED"
            ? {
                status: "QUALIFIED",
                nextAction:
                  "تحويل العرض المقبول إلى مشروع عبر PROJ-01",
                nextActionAt: null,
              }
            : decision === "CHANGES_REQUESTED"
              ? {
                  status: "QUALIFIED",
                  nextAction:
                    "مراجعة تعديلات العميل وإصدار عرض جديد",
                  nextActionAt: now,
                }
              : {
                  status: "DISQUALIFIED",
                  disqualifiedAt: now,
                  nextAction: null,
                  nextActionAt: null,
                },
      })

      const activityAction =
        decision === "ACCEPTED"
          ? ActivityAction.PROPOSAL_CLIENT_ACCEPTED
          : decision === "CHANGES_REQUESTED"
            ? ActivityAction.PROPOSAL_CLIENT_CHANGES_REQUESTED
            : ActivityAction.PROPOSAL_CLIENT_REJECTED
      const activityLabel =
        decision === "ACCEPTED"
          ? "قبل العميل"
          : decision === "CHANGES_REQUESTED"
            ? "طلب العميل تعديل"
            : "رفض العميل"

      await logActivity({
        db: tx,
        companyId: delivery.companyId,
        action: activityAction,
        entityType: "ProposalWorkspace",
        entityId: delivery.workspace.id,
        message: `${activityLabel} العرض ${delivery.workspace.proposalNumber}`,
        metadata: {
          deliveryId: delivery.id,
          responseId: response.id,
          decision,
          version: delivery.version,
          clientContentHash: delivery.clientContentHash,
          responderName: response.responderName,
          responderEmail: response.responderEmail,
          statementVersion: PROPOSAL_RESPONSE_STATEMENT_VERSION,
        },
        ipAddress: clientIp,
        userAgent,
      })

      const notificationUserId = opportunity?.ownerId
      if (notificationUserId) {
        await tx.notification.create({
          data: {
            companyId: delivery.companyId,
            userId: notificationUserId,
            title:
              decision === "ACCEPTED"
                ? "وافق العميل على العرض"
                : decision === "CHANGES_REQUESTED"
                  ? "طلب العميل تعديل العرض"
                  : "رفض العميل العرض",
            message: `${delivery.workspace.proposalNumber} · الإصدار ${delivery.version}`,
            type:
              decision === "ACCEPTED"
                ? "SUCCESS"
                : decision === "CHANGES_REQUESTED"
                  ? "WARNING"
                  : "ERROR",
            entityType: "ProposalWorkspace",
            entityId: delivery.workspace.id,
          },
        })
      }

      const updatedDelivery = await tx.proposalDelivery.findUnique({
        where: { id: delivery.id },
        select: publicProposalDeliverySelect,
      })

      if (!updatedDelivery) throw publicProposalUnavailable()

      return {
        state: serializePublicProposal(updatedDelivery),
        decision,
        replayed: false,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PUBLIC_PROPOSAL_RESPONSE_ERROR",
      "تعذر تسجيل الرد على العرض",
    )
  }
}
