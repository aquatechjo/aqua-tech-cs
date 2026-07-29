import "server-only"

import crypto from "node:crypto"

import type { Prisma } from "@/generated/prisma/client"
import type {
  ConversationMessageKind,
  ConversationMessageRole,
} from "@/generated/prisma/enums"
import {
  DISCOVERY_PUBLIC_LINK_DAYS,
  isPublicDiscoveryAccessActive,
  isValidDiscoveryPublicToken,
  nextPublicDiscoveryQuestion,
  publicDiscoveryPhase,
  publicDiscoveryResponseProgress,
} from "@/lib/discovery-conversation"
import {
  discoveryQuestionsForTrack,
  discoveryTrackLabel,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"
import { prisma } from "@/lib/prisma"
import { hashOpaqueValue } from "@/lib/request-security"

export const publicDiscoverySessionSelect = {
  id: true,
  companyId: true,
  serviceTrack: true,
  status: true,
  completionScore: true,
  publicAccessExpiresAt: true,
  publicAccessRevokedAt: true,
  conversationStartedAt: true,
  conversationSubmittedAt: true,
  conversationEscalatedAt: true,
  conversationEscalationReason: true,
  privacyConsentAt: true,
  contactConfirmedAt: true,
  lead: {
    select: {
      id: true,
      status: true,
      contactName: true,
      companyName: true,
      serviceType: true,
    },
  },
  answers: {
    orderBy: {
      updatedAt: "asc",
    },
    select: {
      questionKey: true,
      value: true,
      source: true,
      isUnknown: true,
      updatedAt: true,
    },
  },
  conversationMessages: {
    orderBy: {
      sequence: "asc",
    },
    select: {
      id: true,
      role: true,
      kind: true,
      questionKey: true,
      content: true,
      sequence: true,
      createdAt: true,
    },
  },
} as const

export type PublicDiscoverySessionRecord =
  Prisma.IntakeSessionGetPayload<{
    select: typeof publicDiscoverySessionSelect
  }>

export function createDiscoveryPublicAccess({
  now = new Date(),
  validDays = DISCOVERY_PUBLIC_LINK_DAYS,
}: {
  now?: Date
  validDays?: number
} = {}) {
  const token = crypto.randomBytes(32).toString("base64url")

  return {
    token,
    tokenHash: hashOpaqueValue(token),
    expiresAt: new Date(
      now.getTime() + validDays * 24 * 60 * 60 * 1000,
    ),
  }
}

export async function findPublicDiscoverySession(
  token: string,
  now = new Date(),
) {
  if (!isValidDiscoveryPublicToken(token)) return null

  const session = await prisma.intakeSession.findUnique({
    where: {
      publicAccessTokenHash: hashOpaqueValue(token),
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
    return null
  }

  return session
}

export function serializePublicDiscoverySession(
  session: PublicDiscoverySessionRecord,
) {
  const track = session.serviceTrack as DiscoveryServiceTrackValue
  const questions = discoveryQuestionsForTrack(track)
  const customerAnswers = session.answers.filter(
    (answer) => answer.source === "CUSTOMER_FACT",
  )
  const publicAnswerMap = new Map(
    customerAnswers.map((answer) => [answer.questionKey, answer]),
  )
  const nextQuestion = nextPublicDiscoveryQuestion({
    track,
    answers: session.answers,
  })
  const phase = publicDiscoveryPhase({
    started: Boolean(session.conversationStartedAt),
    submitted: Boolean(session.conversationSubmittedAt),
    track,
    answers: session.answers,
  })

  return {
    contactName: session.lead.contactName,
    companyName: session.lead.companyName,
    serviceType: session.lead.serviceType,
    serviceTrack: track,
    serviceTrackLabel: discoveryTrackLabel(track),
    phase,
    responseProgress: publicDiscoveryResponseProgress({
      track,
      answers: session.answers,
    }),
    verifiedCompletionScore: session.completionScore,
    nextQuestion,
    answers: questions.flatMap((question) => {
      const answer = publicAnswerMap.get(question.key)

      if (!answer) return []

      return [
        {
          questionKey: question.key,
          questionLabel: question.label,
          sectionLabel: question.sectionLabel,
          value: answer.value,
          isUnknown: answer.isUnknown,
          updatedAt: answer.updatedAt.toISOString(),
        },
      ]
    }),
    messages: session.conversationMessages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    startedAt:
      session.conversationStartedAt?.toISOString() ?? null,
    submittedAt:
      session.conversationSubmittedAt?.toISOString() ?? null,
    escalatedAt:
      session.conversationEscalatedAt?.toISOString() ?? null,
    expiresAt:
      session.publicAccessExpiresAt?.toISOString() ?? null,
  }
}

export async function appendDiscoveryConversationMessage({
  db,
  companyId,
  intakeSessionId,
  role,
  kind,
  content,
  questionKey,
}: {
  db: Prisma.TransactionClient
  companyId: string
  intakeSessionId: string
  role: ConversationMessageRole
  kind: ConversationMessageKind
  content: string
  questionKey?: string | null
}) {
  const latest = await db.conversationMessage.findFirst({
    where: {
      intakeSessionId,
      companyId,
    },
    orderBy: {
      sequence: "desc",
    },
    select: {
      sequence: true,
    },
  })

  return db.conversationMessage.create({
    data: {
      companyId,
      intakeSessionId,
      role,
      kind,
      content,
      questionKey: questionKey ?? null,
      sequence: (latest?.sequence ?? 0) + 1,
    },
  })
}
