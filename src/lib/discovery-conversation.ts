import {
  discoveryQuestionsForTrack,
  type DiscoveryAnswerValue,
  type DiscoveryQuestion,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"

export const DISCOVERY_PRIVACY_VERSION = "2026-07-30"
export const DISCOVERY_PUBLIC_LINK_DAYS = 14
export const DISCOVERY_PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export type PublicDiscoveryPhase =
  | "CONSENT"
  | "QUESTIONS"
  | "SUMMARY"
  | "SUBMITTED"

export function isValidDiscoveryPublicToken(token: string) {
  return DISCOVERY_PUBLIC_TOKEN_PATTERN.test(token)
}

export function publicDiscoveryQuestionQueue({
  track,
  answers,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly Pick<
    DiscoveryAnswerValue,
    "questionKey" | "value" | "source" | "isUnknown"
  >[]
}) {
  const answeredKeys = new Set(
    answers
      .filter(
        (answer) =>
          answer.isUnknown || answer.value.trim().length > 0,
      )
      .map((answer) => answer.questionKey),
  )

  return discoveryQuestionsForTrack(track).filter(
    (question) => !answeredKeys.has(question.key),
  )
}

export function nextPublicDiscoveryQuestion({
  track,
  answers,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly Pick<
    DiscoveryAnswerValue,
    "questionKey" | "value" | "source" | "isUnknown"
  >[]
}): DiscoveryQuestion | null {
  return publicDiscoveryQuestionQueue({ track, answers })[0] ?? null
}

export function publicDiscoveryResponseProgress({
  track,
  answers,
}: {
  track: DiscoveryServiceTrackValue
  answers: readonly Pick<
    DiscoveryAnswerValue,
    "questionKey" | "value" | "source" | "isUnknown"
  >[]
}) {
  const questions = discoveryQuestionsForTrack(track)
  const remaining = publicDiscoveryQuestionQueue({ track, answers })

  if (questions.length === 0) return 100

  return Math.round(
    ((questions.length - remaining.length) / questions.length) * 100,
  )
}

export function publicDiscoveryPhase({
  started,
  submitted,
  track,
  answers,
}: {
  started: boolean
  submitted: boolean
  track: DiscoveryServiceTrackValue
  answers: readonly Pick<
    DiscoveryAnswerValue,
    "questionKey" | "value" | "source" | "isUnknown"
  >[]
}): PublicDiscoveryPhase {
  if (submitted) return "SUBMITTED"
  if (!started) return "CONSENT"

  return nextPublicDiscoveryQuestion({ track, answers })
    ? "QUESTIONS"
    : "SUMMARY"
}

export function isPublicDiscoveryAccessActive({
  expiresAt,
  revokedAt,
  sessionStatus,
  now = new Date(),
}: {
  expiresAt: Date | null
  revokedAt: Date | null
  sessionStatus: string
  now?: Date
}) {
  return (
    expiresAt !== null &&
    expiresAt.getTime() > now.getTime() &&
    revokedAt === null &&
    sessionStatus !== "ARCHIVED"
  )
}

export function publicDiscoveryPath(token: string) {
  if (!isValidDiscoveryPublicToken(token)) {
    throw new Error("INVALID_DISCOVERY_PUBLIC_TOKEN")
  }

  return `/discovery/${token}`
}
