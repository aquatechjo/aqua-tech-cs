import { z } from "zod"

import {
  ActivityAction,
  DiscoveryServiceTrack,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  inferDiscoveryServiceTrack,
  isDiscoveryLeadEligible,
} from "@/lib/discovery-intake"
import {
  discoveryAnswersFromLead,
  persistDiscoveryAnswers,
  refreshDiscoverySessionProgress,
} from "@/lib/discovery-intake-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const createSessionSchema = z.object({
  leadId: z.string().trim().min(1),
  serviceTrack: z.nativeEnum(DiscoveryServiceTrack).optional(),
})

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.discoveryManagement,
      "لا تملك صلاحية بدء جلسات جمع المتطلبات",
    )

    const parsed = createSessionSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات جلسة الاكتشاف غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const meta = await getRequestMeta()
    const now = new Date()
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Lead"
        WHERE "id" = ${parsed.data.leadId}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const lead = await tx.lead.findFirst({
        where: {
          id: parsed.data.leadId,
          companyId: user.companyId,
        },
        include: {
          intakeSession: {
            select: {
              id: true,
            },
          },
          opportunity: {
            select: {
              id: true,
            },
          },
          serviceRequest: {
            select: {
              id: true,
              message: true,
              budgetRange: true,
              timeline: true,
              status: true,
            },
          },
        },
      })

      if (!lead) {
        throw new ApiError(
          "العميل المحتمل غير موجود",
          404,
          "DISCOVERY_LEAD_NOT_FOUND",
        )
      }

      if (lead.intakeSession) {
        return {
          sessionId: lead.intakeSession.id,
          replayed: true,
        }
      }

      if (
        !isDiscoveryLeadEligible({
          status: lead.status,
          hasOpportunity: Boolean(lead.opportunity),
        })
      ) {
        throw new ApiError(
          "حالة العميل المحتمل الحالية لا تسمح ببدء جلسة اكتشاف",
          409,
          "DISCOVERY_LEAD_NOT_ELIGIBLE",
        )
      }

      const serviceTrack =
        parsed.data.serviceTrack ??
        inferDiscoveryServiceTrack(lead.serviceType)
      const session = await tx.intakeSession.create({
        data: {
          companyId: user.companyId,
          leadId: lead.id,
          opportunityId: lead.opportunity?.id ?? null,
          ownerId: lead.ownerId ?? user.id,
          createdById: user.id,
          updatedById: user.id,
          serviceTrack,
          status: "COLLECTING",
          currentSection: "context",
        },
      })
      const seedAnswers = discoveryAnswersFromLead(lead, serviceTrack)

      if (seedAnswers.length > 0) {
        await persistDiscoveryAnswers({
          db: tx,
          companyId: user.companyId,
          intakeSessionId: session.id,
          track: serviceTrack,
          answers: seedAnswers,
          capturedById: user.id,
        })
      }

      const progress = await refreshDiscoverySessionProgress({
        db: tx,
        companyId: user.companyId,
        intakeSessionId: session.id,
        track: serviceTrack,
        actorUserId: user.id,
        now,
      })

      if (lead.status === "NEW" || lead.status === "CONTACTED") {
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: "DISCOVERY",
          },
        })
      }

      if (lead.serviceRequest?.status === "NEW") {
        await tx.serviceRequest.update({
          where: { id: lead.serviceRequest.id },
          data: {
            status: "CONTACTED",
          },
        })
      }

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.DISCOVERY_SESSION_CREATED,
        entityType: "IntakeSession",
        entityId: session.id,
        message: `تم بدء جلسة جمع المتطلبات: ${lead.contactName}`,
        metadata: {
          leadId: lead.id,
          opportunityId: lead.opportunity?.id ?? null,
          serviceTrack,
          completionScore: progress.completionScore,
          seededAnswers: seedAnswers.length,
        },
        ...meta,
      })

      return {
        sessionId: session.id,
        replayed: false,
      }
    })

    return ok(result, result.replayed ? 200 : 201)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_SESSION_POST_ERROR",
      "تعذر بدء جلسة جمع المتطلبات",
    )
  }
}
