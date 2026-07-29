import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import type {
  IntakeAnswerSource,
  RequirementGapStatus,
} from "@/generated/prisma/enums"
import {
  DISCOVERY_TEMPLATE_VERSION,
  discoveryCompletionScore,
  discoveryQuestionByKey,
  discoveryQuestionsForTrack,
  isDiscoveryAnswerSufficient,
  shouldReopenDiscoveryGap,
  type DiscoveryAnswerValue,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"
import { prisma } from "@/lib/prisma"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

type DiscoverySeedLead = {
  serviceRequest: {
    message: string | null
    budgetRange: string | null
    timeline: string | null
  } | null
}

type SavedAnswer = {
  questionKey: string
  value: string
  source: IntakeAnswerSource
  isUnknown: boolean
}

function trimmedText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function discoveryAnswersFromLead(
  lead: DiscoverySeedLead,
  track: DiscoveryServiceTrackValue,
): SavedAnswer[] {
  const candidates = [
    {
      questionKey: "current_problem",
      value: lead.serviceRequest?.message,
    },
    {
      questionKey: "budget_expectation",
      value: lead.serviceRequest?.budgetRange,
    },
    {
      questionKey: "launch_timeline",
      value: lead.serviceRequest?.timeline,
    },
  ]

  return candidates.flatMap((candidate) => {
    const value = trimmedText(candidate.value)
    const question = discoveryQuestionByKey(track, candidate.questionKey)

    if (!value || !question) return []

    return [
      {
        questionKey: question.key,
        value,
        source: "CUSTOMER_FACT" as const,
        isUnknown: false,
      },
    ]
  })
}

export async function persistDiscoveryAnswers({
  db,
  companyId,
  intakeSessionId,
  track,
  answers,
  capturedById,
}: {
  db: DatabaseClient
  companyId: string
  intakeSessionId: string
  track: DiscoveryServiceTrackValue
  answers: readonly SavedAnswer[]
  capturedById?: string | null
}) {
  const allowedQuestions = new Map(
    discoveryQuestionsForTrack(track).map((question) => [
      question.key,
      question,
    ]),
  )

  for (const answer of answers) {
    const question = allowedQuestions.get(answer.questionKey)

    if (!question) continue

    const value = answer.value.trim()

    if (!value && !answer.isUnknown) {
      await db.intakeAnswer.deleteMany({
        where: {
          intakeSessionId,
          companyId,
          questionKey: answer.questionKey,
        },
      })
      continue
    }

    await db.intakeAnswer.upsert({
      where: {
        intakeSessionId_questionKey: {
          intakeSessionId,
          questionKey: answer.questionKey,
        },
      },
      create: {
        companyId,
        intakeSessionId,
        capturedById,
        questionKey: question.key,
        questionLabel: question.label,
        sectionKey: question.sectionKey,
        value: value || "لا أعرف",
        source: answer.source,
        isUnknown: answer.isUnknown,
      },
      update: {
        capturedById,
        questionLabel: question.label,
        sectionKey: question.sectionKey,
        value: value || "لا أعرف",
        source: answer.source,
        isUnknown: answer.isUnknown,
      },
    })
  }
}

export async function syncDiscoveryRequirementGaps({
  db,
  companyId,
  intakeSessionId,
  track,
  answers,
  actorUserId,
  now = new Date(),
}: {
  db: DatabaseClient
  companyId: string
  intakeSessionId: string
  track: DiscoveryServiceTrackValue
  answers: readonly DiscoveryAnswerValue[]
  actorUserId?: string | null
  now?: Date
}) {
  const questions = discoveryQuestionsForTrack(track).filter(
    (question) => question.required,
  )
  const questionKeys = questions.map((question) => question.key)
  const answerMap = new Map(
    answers.map((answer) => [answer.questionKey, answer]),
  )
  const existingGaps = await db.requirementGap.findMany({
    where: {
      intakeSessionId,
      companyId,
    },
  })
  const existingMap = new Map(
    existingGaps.map((gap) => [gap.questionKey, gap]),
  )

  await db.requirementGap.updateMany({
    where: {
      intakeSessionId,
      companyId,
      status: "OPEN",
      questionKey: {
        notIn: questionKeys,
      },
    },
    data: {
      status: "WAIVED",
      resolution: "تم استبعاد السؤال بعد تغيير مسار الخدمة.",
      resolvedById: actorUserId,
      resolvedAt: now,
    },
  })

  for (const question of questions) {
    const sufficient = isDiscoveryAnswerSufficient(
      answerMap.get(question.key),
    )
    const existing = existingMap.get(question.key)

    if (sufficient) {
      if (existing && existing.status !== "RESOLVED") {
        await db.requirementGap.update({
          where: { id: existing.id },
          data: {
            title: question.label,
            severity: question.severity,
            status: "RESOLVED",
            resolution: "تمت الإجابة عن السؤال المطلوب.",
            resolvedById: actorUserId,
            resolvedAt: now,
          },
        })
      }
      continue
    }

    if (!existing) {
      await db.requirementGap.create({
        data: {
          companyId,
          intakeSessionId,
          questionKey: question.key,
          title: question.label,
          severity: question.severity,
          status: "OPEN",
        },
      })
      continue
    }

    if (shouldReopenDiscoveryGap(existing)) {
      await db.requirementGap.update({
        where: { id: existing.id },
        data: {
          title: question.label,
          severity: question.severity,
          status: "OPEN",
          resolution: null,
          resolvedById: null,
          resolvedAt: null,
        },
      })
    } else if (
      existing.title !== question.label ||
      existing.severity !== question.severity
    ) {
      await db.requirementGap.update({
        where: { id: existing.id },
        data: {
          title: question.label,
          severity: question.severity,
        },
      })
    }
  }

  return db.requirementGap.findMany({
    where: {
      intakeSessionId,
      companyId,
    },
    orderBy: [
      { status: "asc" },
      { severity: "desc" },
      { createdAt: "asc" },
    ],
  })
}

export async function refreshDiscoverySessionProgress({
  db,
  companyId,
  intakeSessionId,
  track,
  actorUserId,
  now = new Date(),
}: {
  db: DatabaseClient
  companyId: string
  intakeSessionId: string
  track: DiscoveryServiceTrackValue
  actorUserId?: string | null
  now?: Date
}) {
  const storedAnswers = await db.intakeAnswer.findMany({
    where: {
      intakeSessionId,
      companyId,
    },
    select: {
      questionKey: true,
      value: true,
      source: true,
      isUnknown: true,
    },
  })
  const answers = storedAnswers as DiscoveryAnswerValue[]
  const completionScore = discoveryCompletionScore({
    track,
    answers,
  })
  const gaps = await syncDiscoveryRequirementGaps({
    db,
    companyId,
    intakeSessionId,
    track,
    answers,
    actorUserId,
    now,
  })

  await db.intakeSession.update({
    where: { id: intakeSessionId },
    data: {
      templateVersion: DISCOVERY_TEMPLATE_VERSION,
      serviceTrack: track,
      completionScore,
      ...(actorUserId ? { updatedById: actorUserId } : {}),
    },
  })

  return {
    answers,
    gaps,
    completionScore,
  }
}

export function activeDiscoveryBlockers(
  gaps: readonly { status: RequirementGapStatus }[],
) {
  return gaps.filter((gap) => gap.status === "OPEN").length
}
