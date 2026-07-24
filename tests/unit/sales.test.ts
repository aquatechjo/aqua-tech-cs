import assert from "node:assert/strict"
import test from "node:test"
import {
  canTransitionOpportunity,
  canTransitionProposal,
  defaultProbability,
  displayProposalStatus,
  followUpBucket,
  isOpenSalesStage,
  isStaleOpportunity,
  opportunityTransitionState,
  proposalTransitionState,
  serviceRequestStatusFromStage,
  stageFromServiceRequestStatus,
  weightedValueMinor,
  wonOpportunityState,
} from "../../src/lib/sales"

test("sales probabilities and weighted values are deterministic", () => {
  assert.equal(defaultProbability("NEW"), 10)
  assert.equal(defaultProbability("NEGOTIATION"), 80)
  assert.equal(weightedValueMinor(125_050, 40), 50_020)
  assert.throws(() => weightedValueMinor(100, 101), /INVALID_PROBABILITY/)
})

test("opportunity stages enforce controlled progression", () => {
  assert.equal(isOpenSalesStage("NEGOTIATION"), true)
  assert.equal(isOpenSalesStage("WON"), false)
  assert.equal(canTransitionOpportunity("NEW", "DISCOVERY"), true)
  assert.equal(canTransitionOpportunity("NEW", "WON"), false)
  assert.equal(canTransitionOpportunity("WON", "DISCOVERY"), false)
  assert.equal(canTransitionOpportunity("LOST", "DISCOVERY"), true)
})

test("won opportunities require conversion and losses require a reason", () => {
  assert.throws(
    () =>
      opportunityTransitionState({
        currentStage: "NEGOTIATION",
        nextStage: "WON",
      }),
    /WON_REQUIRES_CONVERSION/,
  )
  assert.throws(
    () =>
      opportunityTransitionState({
        currentStage: "NEGOTIATION",
        nextStage: "LOST",
      }),
    /LOST_REASON_REQUIRED/,
  )

  const lost = opportunityTransitionState({
    currentStage: "NEGOTIATION",
    nextStage: "LOST",
    lostReason: "Budget frozen",
    now: new Date("2026-07-24T12:00:00.000Z"),
  })
  assert.equal(lost.stage, "LOST")
  assert.equal(lost.probability, 0)
  assert.equal(lost.lostReason, "Budget frozen")
  assert.equal(lost.nextFollowUpAt, null)
  const originalLostAt = new Date("2026-07-20T12:00:00.000Z")
  const revisedLoss = opportunityTransitionState({
    currentStage: "LOST",
    nextStage: "LOST",
    lostReason: "Budget still frozen",
    currentLostAt: originalLostAt,
    now: new Date("2026-07-24T12:00:00.000Z"),
  })
  assert.equal(revisedLoss.lostAt, originalLostAt)
})

test("conversion state closes a won opportunity consistently", () => {
  const now = new Date("2026-07-24T12:00:00.000Z")
  assert.deepEqual(wonOpportunityState(now), {
    stage: "WON",
    probability: 100,
    wonAt: now,
    lostAt: null,
    lostReason: null,
    nextFollowUpAt: null,
  })
})

test("proposal transitions preserve commercial history", () => {
  assert.equal(canTransitionProposal("DRAFT", "SENT"), true)
  assert.equal(canTransitionProposal("SENT", "ACCEPTED"), true)
  assert.equal(canTransitionProposal("ACCEPTED", "SENT"), false)

  const sent = proposalTransitionState({
    currentStatus: "DRAFT",
    nextStatus: "SENT",
    now: new Date("2026-07-24T12:00:00.000Z"),
  })
  assert.equal(sent.status, "SENT")
  assert.equal(sent.sentAt?.toISOString(), "2026-07-24T12:00:00.000Z")
})

test("proposal expiry and follow-up buckets use the business timezone", () => {
  const now = new Date("2026-07-24T21:30:00.000Z")

  assert.equal(
    displayProposalStatus({
      status: "SENT",
      validUntil: "2026-07-24T00:00:00.000Z",
      now,
      timeZone: "Asia/Amman",
    }),
    "EXPIRED",
  )
  assert.equal(
    followUpBucket({
      followUpAt: "2026-07-25T08:00:00.000Z",
      now,
      timeZone: "Asia/Amman",
    }),
    "TODAY",
  )
  assert.equal(
    followUpBucket({
      followUpAt: "2026-07-24T08:00:00.000Z",
      now,
      timeZone: "Asia/Amman",
    }),
    "OVERDUE",
  )
})

test("stale detection applies only to open opportunities", () => {
  const now = new Date("2026-07-24T12:00:00.000Z")

  assert.equal(
    isStaleOpportunity({
      stage: "QUALIFIED",
      lastContactAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
      now,
    }),
    true,
  )
  assert.equal(
    isStaleOpportunity({
      stage: "WON",
      lastContactAt: "2026-07-10T12:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
      now,
    }),
    false,
  )
})

test("service request and opportunity stages map without skipping the handoff", () => {
  assert.equal(stageFromServiceRequestStatus("CONTACTED"), "DISCOVERY")
  assert.equal(stageFromServiceRequestStatus("PROPOSAL_SENT"), "PROPOSAL")
  assert.equal(stageFromServiceRequestStatus("CONVERTED"), "WON")
  assert.equal(serviceRequestStatusFromStage("NEGOTIATION"), "PROPOSAL_SENT")
  assert.equal(serviceRequestStatusFromStage("ON_HOLD"), null)
})
