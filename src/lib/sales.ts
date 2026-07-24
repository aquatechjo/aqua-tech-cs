import { localDateKey } from "@/lib/finance"

export const OPEN_SALES_STAGES = [
  "NEW",
  "DISCOVERY",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "ON_HOLD",
] as const

export type SalesOpportunityStageValue =
  | (typeof OPEN_SALES_STAGES)[number]
  | "WON"
  | "LOST"

export type SalesProposalStatusValue =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"

export type DisplaySalesProposalStatus = SalesProposalStatusValue | "EXPIRED"

export const DEFAULT_STAGE_PROBABILITY: Record<SalesOpportunityStageValue, number> = {
  NEW: 10,
  DISCOVERY: 20,
  QUALIFIED: 40,
  PROPOSAL: 60,
  NEGOTIATION: 80,
  ON_HOLD: 25,
  WON: 100,
  LOST: 0,
}

const stageTransitions: Record<
  SalesOpportunityStageValue,
  readonly SalesOpportunityStageValue[]
> = {
  NEW: ["DISCOVERY", "QUALIFIED", "ON_HOLD", "LOST"],
  DISCOVERY: ["NEW", "QUALIFIED", "PROPOSAL", "ON_HOLD", "LOST"],
  QUALIFIED: ["DISCOVERY", "PROPOSAL", "NEGOTIATION", "ON_HOLD", "LOST"],
  PROPOSAL: ["QUALIFIED", "NEGOTIATION", "ON_HOLD", "LOST"],
  NEGOTIATION: ["PROPOSAL", "ON_HOLD", "LOST"],
  ON_HOLD: ["DISCOVERY", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "LOST"],
  WON: [],
  LOST: ["DISCOVERY", "ON_HOLD"],
}

const proposalTransitions: Record<
  SalesProposalStatusValue,
  readonly SalesProposalStatusValue[]
> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: [],
  REJECTED: [],
  CANCELLED: [],
}

export function normalizeProbability(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("INVALID_PROBABILITY")
  }

  return value
}

export function defaultProbability(stage: SalesOpportunityStageValue) {
  return DEFAULT_STAGE_PROBABILITY[stage]
}

export function isOpenSalesStage(
  stage: string,
): stage is (typeof OPEN_SALES_STAGES)[number] {
  return OPEN_SALES_STAGES.includes(
    stage as (typeof OPEN_SALES_STAGES)[number],
  )
}

export function weightedValueMinor(valueMinor: number, probability: number) {
  if (!Number.isSafeInteger(valueMinor) || valueMinor < 0) {
    throw new Error("INVALID_PIPELINE_VALUE")
  }

  return Math.round((valueMinor * normalizeProbability(probability)) / 100)
}

export function canTransitionOpportunity(
  currentStage: SalesOpportunityStageValue,
  nextStage: SalesOpportunityStageValue,
) {
  if (currentStage === nextStage) return true
  return stageTransitions[currentStage].includes(nextStage)
}

export function opportunityTransitionState({
  currentStage,
  nextStage,
  probability,
  lostReason,
  currentLostAt = null,
  now = new Date(),
}: {
  currentStage: SalesOpportunityStageValue
  nextStage: SalesOpportunityStageValue
  probability?: number
  lostReason?: string | null
  currentLostAt?: Date | null
  now?: Date
}) {
  if (nextStage === "WON") {
    throw new Error("WON_REQUIRES_CONVERSION")
  }

  if (!canTransitionOpportunity(currentStage, nextStage)) {
    throw new Error("INVALID_OPPORTUNITY_TRANSITION")
  }

  const normalizedLostReason = lostReason?.trim() || null

  if (nextStage === "LOST" && !normalizedLostReason) {
    throw new Error("LOST_REASON_REQUIRED")
  }

  const resolvedProbability =
    nextStage === currentStage && probability !== undefined
      ? normalizeProbability(probability)
      : probability !== undefined
        ? normalizeProbability(probability)
        : defaultProbability(nextStage)

  return {
    stage: nextStage,
    probability: resolvedProbability,
    lostReason: nextStage === "LOST" ? normalizedLostReason : null,
    lostAt:
      nextStage === "LOST"
        ? currentStage === "LOST"
          ? currentLostAt ?? now
          : now
        : null,
    wonAt: null,
    nextFollowUpAt: nextStage === "LOST" ? null : undefined,
  }
}

export function wonOpportunityState(now = new Date()) {
  return {
    stage: "WON" as const,
    probability: 100,
    wonAt: now,
    lostAt: null,
    lostReason: null,
    nextFollowUpAt: null,
  }
}

export function canTransitionProposal(
  currentStatus: SalesProposalStatusValue,
  nextStatus: SalesProposalStatusValue,
) {
  if (currentStatus === nextStatus) return true
  return proposalTransitions[currentStatus].includes(nextStatus)
}

export function proposalTransitionState({
  currentStatus,
  nextStatus,
  now = new Date(),
}: {
  currentStatus: SalesProposalStatusValue
  nextStatus: SalesProposalStatusValue
  now?: Date
}) {
  if (!canTransitionProposal(currentStatus, nextStatus)) {
    throw new Error("INVALID_PROPOSAL_TRANSITION")
  }

  return {
    status: nextStatus,
    sentAt: nextStatus === "SENT" ? now : undefined,
    acceptedAt: nextStatus === "ACCEPTED" ? now : undefined,
    rejectedAt: nextStatus === "REJECTED" ? now : undefined,
  }
}

export function displayProposalStatus({
  status,
  validUntil,
  now = new Date(),
  timeZone = "Asia/Amman",
}: {
  status: SalesProposalStatusValue
  validUntil: Date | string | null
  now?: Date
  timeZone?: string
}): DisplaySalesProposalStatus {
  if (
    status === "SENT" &&
    validUntil &&
    localDateKey(new Date(validUntil), timeZone) < localDateKey(now, timeZone)
  ) {
    return "EXPIRED"
  }

  return status
}

export type FollowUpBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NONE"

export function followUpBucket({
  followUpAt,
  now = new Date(),
  timeZone = "Asia/Amman",
}: {
  followUpAt: Date | string | null
  now?: Date
  timeZone?: string
}): FollowUpBucket {
  if (!followUpAt) return "NONE"

  const followUpKey = localDateKey(new Date(followUpAt), timeZone)
  const todayKey = localDateKey(now, timeZone)

  if (followUpKey < todayKey) return "OVERDUE"
  if (followUpKey === todayKey) return "TODAY"
  return "UPCOMING"
}

export function isStaleOpportunity({
  stage,
  lastContactAt,
  updatedAt,
  now = new Date(),
  staleAfterDays = 7,
}: {
  stage: SalesOpportunityStageValue
  lastContactAt: Date | string | null
  updatedAt: Date | string
  now?: Date
  staleAfterDays?: number
}) {
  if (!isOpenSalesStage(stage)) {
    return false
  }

  const anchor = new Date(lastContactAt ?? updatedAt).getTime()
  const threshold = staleAfterDays * 24 * 60 * 60 * 1000
  return now.getTime() - anchor >= threshold
}

export function stageFromServiceRequestStatus(status: string): SalesOpportunityStageValue {
  if (status === "CONTACTED") return "DISCOVERY"
  if (status === "QUALIFIED") return "QUALIFIED"
  if (status === "PROPOSAL_SENT") return "PROPOSAL"
  if (status === "APPROVED") return "NEGOTIATION"
  if (status === "REJECTED") return "LOST"
  if (status === "CONVERTED") return "WON"
  if (status === "ARCHIVED") return "ON_HOLD"
  return "NEW"
}

export function serviceRequestStatusFromStage(stage: SalesOpportunityStageValue) {
  if (stage === "DISCOVERY") return "CONTACTED" as const
  if (stage === "QUALIFIED") return "QUALIFIED" as const
  if (stage === "PROPOSAL" || stage === "NEGOTIATION") {
    return "PROPOSAL_SENT" as const
  }
  if (stage === "LOST") return "REJECTED" as const
  if (stage === "WON") return "CONVERTED" as const
  return null
}
