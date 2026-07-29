import { z } from "zod"

import {
  ActivityAction,
  DiscoveryServiceTrack,
  IntakeAnswerSource,
} from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  DISCOVERY_SERVICE_TRACKS,
  discoveryQuestionByKey,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"
import {
  activeDiscoveryBlockers,
  persistDiscoveryAnswers,
  refreshDiscoverySessionProgress,
} from "@/lib/discovery-intake-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const updateSessionSchema = z
  .object({
    serviceTrack: z.nativeEnum(DiscoveryServiceTrack).optional(),
    currentSection: z.string().trim().max(80).optional().nullable(),
    internalSummary: z.string().trim().max(8000).optional().nullable(),
    answers: z
      .array(
        z.object({
          questionKey: z.string().trim().min(1).max(120),
          value: z.string().max(12000),
          source: z.nativeEnum(IntakeAnswerSource),
          isUnknown: z.boolean().optional().default(false),
        }),
      )
      .max(40)
      .optional(),
    intent: z
      .enum(["SAVE", "READY_FOR_REVIEW", "REOPEN"])
      .optional()
      .default("SAVE"),
  })
  .refine(
    (value) =>
      value.serviceTrack !== undefined ||
      value.currentSection !== undefined ||
      value.internalSummary !== undefined ||
      value.answers !== undefined ||
      value.intent !== "SAVE",
    {
      message: "لا توجد تعديلات للحفظ",
    },
  )

function nullableText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    assertRole(
      user.role,
      ACCESS_ROLES.discoveryManagement,
      "لا تملك صلاحية تعديل جلسات جمع المتطلبات",
    )

    const parsed = updateSessionSchema.safeParse(
      await readJsonBody(request),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ?? "بيانات جلسة الاكتشاف غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const { id } = await params
    const data = parsed.data
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
        include: {
          lead: {
            select: {
              id: true,
              status: true,
              contactName: true,
            },
          },
        },
      })

      if (!session) {
        throw new ApiError(
          "جلسة جمع المتطلبات غير موجودة",
          404,
          "DISCOVERY_SESSION_NOT_FOUND",
        )
      }

      if (session.status === "COMPLETED" || session.status === "ARCHIVED") {
        throw new ApiError(
          "لا يمكن تعديل جلسة مكتملة أو مؤرشفة",
          409,
          "DISCOVERY_SESSION_LOCKED",
        )
      }

      const serviceTrack = (data.serviceTrack ??
        session.serviceTrack) as DiscoveryServiceTrackValue

      if (!DISCOVERY_SERVICE_TRACKS.includes(serviceTrack)) {
        throw new ApiError(
          "مسار الخدمة غير صحيح",
          400,
          "DISCOVERY_TRACK_INVALID",
        )
      }

      for (const answer of data.answers ?? []) {
        if (!discoveryQuestionByKey(serviceTrack, answer.questionKey)) {
          throw new ApiError(
            "أحد أسئلة جلسة الاكتشاف لا ينتمي إلى المسار المحدد",
            400,
            "DISCOVERY_QUESTION_INVALID",
          )
        }
      }

      if (data.answers) {
        await persistDiscoveryAnswers({
          db: tx,
          companyId: user.companyId,
          intakeSessionId: session.id,
          track: serviceTrack,
          answers: data.answers,
          capturedById: user.id,
        })
      }

      await tx.intakeSession.update({
        where: { id: session.id },
        data: {
          serviceTrack,
          currentSection:
            data.currentSection === undefined
              ? session.currentSection
              : nullableText(data.currentSection),
          internalSummary:
            data.internalSummary === undefined
              ? session.internalSummary
              : nullableText(data.internalSummary),
          updatedById: user.id,
        },
      })

      const progress = await refreshDiscoverySessionProgress({
        db: tx,
        companyId: user.companyId,
        intakeSessionId: session.id,
        track: serviceTrack,
        actorUserId: user.id,
        now,
      })
      const blockerCount = activeDiscoveryBlockers(progress.gaps)
      let status = session.status

      if (data.intent === "READY_FOR_REVIEW") {
        status = blockerCount === 0 ? "READY_FOR_REVIEW" : "NEEDS_INFO"
      } else if (data.intent === "REOPEN") {
        status = "COLLECTING"
      } else if (
        session.status === "READY_FOR_REVIEW" &&
        (data.answers !== undefined ||
          data.serviceTrack !== undefined ||
          data.internalSummary !== undefined)
      ) {
        status = "COLLECTING"
      }

      const updated = await tx.intakeSession.update({
        where: { id: session.id },
        data: {
          status,
          readyForReviewAt:
            status === "READY_FOR_REVIEW"
              ? session.readyForReviewAt ?? now
              : null,
          ...(status === "READY_FOR_REVIEW" &&
          !session.conversationSubmittedAt
            ? {
                publicAccessTokenHash: null,
                publicAccessRevokedAt: now,
              }
            : {}),
          updatedById: user.id,
        },
      })

      if (
        data.intent === "READY_FOR_REVIEW" &&
        session.lead.status !== "QUALIFIED" &&
        session.lead.status !== "CONVERTED"
      ) {
        await tx.lead.update({
          where: { id: session.lead.id },
          data: {
            status: blockerCount === 0 ? "DISCOVERY" : "NEEDS_INFO",
          },
        })
      }

      const readyForReview = updated.status === "READY_FOR_REVIEW"

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: readyForReview
          ? ActivityAction.DISCOVERY_READY_FOR_REVIEW
          : ActivityAction.DISCOVERY_SESSION_UPDATED,
        entityType: "IntakeSession",
        entityId: session.id,
        message: readyForReview
          ? `أصبحت جلسة جمع المتطلبات جاهزة للمراجعة: ${session.lead.contactName}`
          : `تم تحديث جلسة جمع المتطلبات: ${session.lead.contactName}`,
        metadata: {
          leadId: session.lead.id,
          previousStatus: session.status,
          status: updated.status,
          serviceTrack,
          completionScore: progress.completionScore,
          blockerCount,
          intent: data.intent,
        },
        ...meta,
      })

      return {
        sessionId: updated.id,
        status: updated.status,
        completionScore: progress.completionScore,
        blockerCount,
        readyForReview,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "DISCOVERY_SESSION_PATCH_ERROR",
      "تعذر حفظ جلسة جمع المتطلبات",
    )
  }
}
