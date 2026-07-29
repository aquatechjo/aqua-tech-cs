import { z } from "zod"

import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import {
  appendDiscoveryConversationMessage,
  publicDiscoverySessionSelect,
  serializePublicDiscoverySession,
} from "@/lib/discovery-conversation-server"
import {
  DISCOVERY_PRIVACY_VERSION,
  isPublicDiscoveryAccessActive,
  isValidDiscoveryPublicToken,
  nextPublicDiscoveryQuestion,
} from "@/lib/discovery-conversation"
import {
  discoveryQuestionByKey,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"
import {
  activeDiscoveryBlockers,
  persistDiscoveryAnswers,
  refreshDiscoverySessionProgress,
} from "@/lib/discovery-intake-server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  assertSameOrigin,
  getClientIp,
  hashOpaqueValue,
  readJsonBody,
} from "@/lib/request-security"

const publicConversationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START"),
    privacyConsent: z.literal(true),
    contactConfirmed: z.literal(true),
  }),
  z.object({
    action: z.literal("ANSWER"),
    questionKey: z.string().trim().min(1).max(120),
    value: z.string().max(12000),
    isUnknown: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal("ESCALATE"),
    reason: z.string().trim().min(10).max(2000),
  }),
  z.object({
    action: z.literal("CONFIRM"),
  }),
])

function publicSessionUnavailable() {
  return new ApiError(
    "رابط جلسة الاكتشاف غير متاح أو انتهت صلاحيته",
    404,
    "DISCOVERY_PUBLIC_SESSION_UNAVAILABLE",
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request)

    const { token } = await params

    if (!isValidDiscoveryPublicToken(token)) {
      throw publicSessionUnavailable()
    }

    const tokenHash = hashOpaqueValue(token)
    const clientIp = getClientIp(request)

    await enforceRateLimit({
      namespace: "public-discovery-message",
      identifier: `${tokenHash}:${clientIp}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    })

    const parsed = publicConversationSchema.safeParse(
      await readJsonBody(request, 32 * 1024),
    )

    if (!parsed.success) {
      return err(
        parsed.error.issues[0]?.message ??
          "بيانات محادثة الاكتشاف غير صحيحة",
        400,
        parsed.error.flatten(),
      )
    }

    const now = new Date()
    const userAgent = request.headers.get("user-agent")
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "IntakeSession"
        WHERE "publicAccessTokenHash" = ${tokenHash}
        FOR UPDATE
      `

      const session = await tx.intakeSession.findUnique({
        where: {
          publicAccessTokenHash: tokenHash,
        },
        select: publicDiscoverySessionSelect,
      })

      if (
        !session ||
        !isPublicDiscoveryAccessActive({
          expiresAt: session.publicAccessExpiresAt,
          revokedAt: session.publicAccessRevokedAt,
          sessionStatus: session.status,
          now,
        })
      ) {
        throw publicSessionUnavailable()
      }

      const track =
        session.serviceTrack as DiscoveryServiceTrackValue
      const loadUpdatedSession = async () => {
        const updated = await tx.intakeSession.findUnique({
          where: { id: session.id },
          select: publicDiscoverySessionSelect,
        })

        if (!updated) throw publicSessionUnavailable()

        return serializePublicDiscoverySession(updated)
      }

      if (parsed.data.action === "START") {
        if (session.conversationSubmittedAt) {
          return loadUpdatedSession()
        }

        if (
          session.status === "READY_FOR_REVIEW" ||
          session.status === "COMPLETED" ||
          session.status === "ARCHIVED"
        ) {
          throw new ApiError(
            "الجلسة مغلقة حاليًا ولا تستقبل إجابات جديدة",
            409,
            "DISCOVERY_CONVERSATION_LOCKED",
          )
        }

        if (!session.conversationStartedAt) {
          const nextQuestion = nextPublicDiscoveryQuestion({
            track,
            answers: session.answers,
          })

          await tx.intakeSession.update({
            where: { id: session.id },
            data: {
              conversationStartedAt: now,
              privacyConsentAt: now,
              privacyConsentVersion: DISCOVERY_PRIVACY_VERSION,
              contactConfirmedAt: now,
              currentSection: nextQuestion?.sectionKey ?? "summary",
              status: "COLLECTING",
            },
          })

          await appendDiscoveryConversationMessage({
            db: tx,
            companyId: session.companyId,
            intakeSessionId: session.id,
            role: "SYSTEM",
            kind: "INTRODUCTION",
            content:
              "شكرًا لوقتك. سنسألك سؤالًا واحدًا في كل مرة، ويمكنك اختيار «لا أعرف» عندما لا تتوفر المعلومة.",
          })

          await appendDiscoveryConversationMessage({
            db: tx,
            companyId: session.companyId,
            intakeSessionId: session.id,
            role: "SYSTEM",
            kind: nextQuestion ? "QUESTION" : "SUMMARY",
            questionKey: nextQuestion?.key ?? null,
            content:
              nextQuestion?.label ??
              "اكتملت الأسئلة المتاحة. راجع الملخص ثم أكّد الإرسال.",
          })

          await logActivity({
            db: tx,
            companyId: session.companyId,
            action: ActivityAction.DISCOVERY_CONVERSATION_STARTED,
            entityType: "IntakeSession",
            entityId: session.id,
            message: `بدأ العميل محادثة الاكتشاف: ${session.lead.contactName}`,
            metadata: {
              leadId: session.lead.id,
              privacyConsentVersion: DISCOVERY_PRIVACY_VERSION,
            },
            ipAddress: clientIp,
            userAgent,
          })
        }

        return loadUpdatedSession()
      }

      if (!session.conversationStartedAt) {
        throw new ApiError(
          "ابدأ الجلسة ووافق على حفظ الإجابات أولًا",
          409,
          "DISCOVERY_CONVERSATION_NOT_STARTED",
        )
      }

      if (session.conversationSubmittedAt) {
        return loadUpdatedSession()
      }

      if (
        session.status === "READY_FOR_REVIEW" ||
        session.status === "COMPLETED" ||
        session.status === "ARCHIVED"
      ) {
        throw new ApiError(
          "الجلسة مغلقة حاليًا ولا تستقبل إجابات جديدة",
          409,
          "DISCOVERY_CONVERSATION_LOCKED",
        )
      }

      if (parsed.data.action === "ANSWER") {
        const answerData = parsed.data
        const question = discoveryQuestionByKey(
          track,
          answerData.questionKey,
        )
        const value = answerData.value.trim()
        const existingAnswer = session.answers.find(
          (answer) =>
            answer.questionKey === answerData.questionKey,
        )
        const expectedQuestion = nextPublicDiscoveryQuestion({
          track,
          answers: session.answers,
        })

        if (!question) {
          throw new ApiError(
            "السؤال غير تابع لمسار هذه الجلسة",
            400,
            "DISCOVERY_PUBLIC_QUESTION_INVALID",
          )
        }

        if (
          expectedQuestion?.key !== question.key &&
          existingAnswer?.source !== "CUSTOMER_FACT"
        ) {
          throw new ApiError(
            "لا يمكن تعديل هذا السؤال من الرابط العام",
            409,
            "DISCOVERY_PUBLIC_ANSWER_NOT_EDITABLE",
          )
        }

        if (!answerData.isUnknown && value.length < 2) {
          throw new ApiError(
            "اكتب إجابة أو اختر «لا أعرف»",
            400,
            "DISCOVERY_PUBLIC_ANSWER_REQUIRED",
          )
        }

        await persistDiscoveryAnswers({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          track,
          answers: [
            {
              questionKey: question.key,
              value: answerData.isUnknown ? "لا أعرف" : value,
              source: "CUSTOMER_FACT",
              isUnknown: answerData.isUnknown,
            },
          ],
          capturedById: null,
        })

        await appendDiscoveryConversationMessage({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          role: "CUSTOMER",
          kind: "ANSWER",
          questionKey: question.key,
          content: answerData.isUnknown ? "لا أعرف حاليًا" : value,
        })

        const progress = await refreshDiscoverySessionProgress({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          track,
          actorUserId: null,
          now,
        })
        const nextQuestion = nextPublicDiscoveryQuestion({
          track,
          answers: progress.answers,
        })

        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            currentSection: nextQuestion?.sectionKey ?? "summary",
            lastCustomerMessageAt: now,
            status: "COLLECTING",
            readyForReviewAt: null,
          },
        })

        await appendDiscoveryConversationMessage({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          role: "SYSTEM",
          kind: nextQuestion ? "QUESTION" : "SUMMARY",
          questionKey: nextQuestion?.key ?? null,
          content:
            nextQuestion?.label ??
            "اكتملت الأسئلة. راجع ملخص إجاباتك ويمكنك تعديل أي إجابة قبل الإرسال.",
        })

        return loadUpdatedSession()
      }

      if (parsed.data.action === "ESCALATE") {
        await tx.intakeSession.update({
          where: { id: session.id },
          data: {
            status: "NEEDS_INFO",
            conversationEscalatedAt: now,
            conversationEscalationReason: parsed.data.reason,
            lastCustomerMessageAt: now,
          },
        })
        await tx.lead.update({
          where: { id: session.lead.id },
          data: {
            status: "NEEDS_INFO",
            nextAction: "التواصل مع العميل بخصوص جلسة الاكتشاف",
            nextActionAt: now,
          },
        })

        await appendDiscoveryConversationMessage({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          role: "CUSTOMER",
          kind: "ESCALATION",
          content: parsed.data.reason,
        })
        await appendDiscoveryConversationMessage({
          db: tx,
          companyId: session.companyId,
          intakeSessionId: session.id,
          role: "SYSTEM",
          kind: "ESCALATION",
          content:
            "تم تسجيل طلب المساعدة. سيتواصل معك أحد أعضاء فريق Aqua Tech لاستكمال النقاط الصعبة.",
        })

        await logActivity({
          db: tx,
          companyId: session.companyId,
          action: ActivityAction.DISCOVERY_CONVERSATION_ESCALATED,
          entityType: "IntakeSession",
          entityId: session.id,
          message: `طلب العميل مساعدة في محادثة الاكتشاف: ${session.lead.contactName}`,
          metadata: {
            leadId: session.lead.id,
            reason: parsed.data.reason,
          },
          ipAddress: clientIp,
          userAgent,
        })

        return loadUpdatedSession()
      }

      const progress = await refreshDiscoverySessionProgress({
        db: tx,
        companyId: session.companyId,
        intakeSessionId: session.id,
        track,
        actorUserId: null,
        now,
      })
      const nextQuestion = nextPublicDiscoveryQuestion({
        track,
        answers: progress.answers,
      })

      if (nextQuestion) {
        throw new ApiError(
          "لا تزال هناك أسئلة لم تُجب عنها",
          409,
          "DISCOVERY_CONVERSATION_INCOMPLETE",
          {
            details: {
              nextQuestionKey: nextQuestion.key,
            },
          },
        )
      }

      const blockerCount = activeDiscoveryBlockers(progress.gaps)
      const status =
        blockerCount === 0 ? "READY_FOR_REVIEW" : "NEEDS_INFO"

      await tx.intakeSession.update({
        where: { id: session.id },
        data: {
          status,
          conversationSubmittedAt: now,
          lastCustomerMessageAt: now,
          readyForReviewAt: blockerCount === 0 ? now : null,
        },
      })
      await tx.lead.update({
        where: { id: session.lead.id },
        data: {
          status: blockerCount === 0 ? "DISCOVERY" : "NEEDS_INFO",
          nextAction:
            blockerCount === 0
              ? "مراجعة تقرير الاكتشاف الأولي"
              : "استكمال فجوات جلسة الاكتشاف",
          nextActionAt: now,
        },
      })

      await appendDiscoveryConversationMessage({
        db: tx,
        companyId: session.companyId,
        intakeSessionId: session.id,
        role: "SYSTEM",
        kind: "COMPLETION",
        content:
          blockerCount === 0
            ? "تم إرسال إجاباتك بنجاح إلى فريق Aqua Tech للمراجعة."
            : "تم إرسال إجاباتك. سيتواصل معك الفريق لاستكمال المعلومات التي لم تكن متاحة.",
      })

      await logActivity({
        db: tx,
        companyId: session.companyId,
        action: ActivityAction.DISCOVERY_CONVERSATION_SUBMITTED,
        entityType: "IntakeSession",
        entityId: session.id,
        message: `أرسل العميل محادثة الاكتشاف: ${session.lead.contactName}`,
        metadata: {
          leadId: session.lead.id,
          status,
          completionScore: progress.completionScore,
          blockerCount,
        },
        ipAddress: clientIp,
        userAgent,
      })

      return loadUpdatedSession()
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "PUBLIC_DISCOVERY_CONVERSATION_POST_ERROR",
      "تعذر تحديث محادثة الاكتشاف",
    )
  }
}
