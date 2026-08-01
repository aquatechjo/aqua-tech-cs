import { z } from "zod"

export const PROJECT_GOVERNANCE_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const

export type ProjectGovernanceLevel =
  (typeof PROJECT_GOVERNANCE_LEVELS)[number]

export const PROJECT_RISK_STATUSES = [
  "OPEN",
  "MONITORING",
  "MITIGATED",
  "MATERIALIZED",
  "CLOSED",
] as const

export const PROJECT_ISSUE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable()

const ownerAndDueDate = {
  ownerUserId: z.string().trim().min(1).optional().nullable(),
  dueDate: z.iso.date().optional().nullable(),
}

const riskFields = {
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().min(3).max(4000),
  probability: z.enum(PROJECT_GOVERNANCE_LEVELS),
  impact: z.enum(PROJECT_GOVERNANCE_LEVELS),
  responsePlan: z.string().trim().min(3).max(4000),
  contingencyPlan: optionalText(4000),
  trigger: optionalText(1000),
  ...ownerAndDueDate,
}

const issueFields = {
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().min(3).max(4000),
  severity: z.enum(PROJECT_GOVERNANCE_LEVELS),
  ...ownerAndDueDate,
}

const decisionFields = {
  title: z.string().trim().min(3).max(300),
  decision: z.string().trim().min(3).max(4000),
  rationale: z.string().trim().min(3).max(4000),
  alternatives: optionalText(4000),
  impactSummary: optionalText(4000),
}

export const projectGovernanceCreateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("RISK"), ...riskFields }),
  z.object({
    kind: z.literal("ISSUE"),
    ...issueFields,
    sourceRiskId: z.string().trim().min(1).optional().nullable(),
  }),
  z.object({
    kind: z.literal("DECISION"),
    ...decisionFields,
    supersedesDecisionId: z.string().trim().min(1).optional().nullable(),
  }),
])

export type ProjectGovernanceCreateInput = z.infer<
  typeof projectGovernanceCreateSchema
>

export const projectGovernanceMutationSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("UPDATE_RISK"),
      status: z.enum(["OPEN", "MONITORING", "MITIGATED"]),
      ...riskFields,
    }),
    z.object({
      action: z.literal("MATERIALIZE_RISK"),
      issueTitle: z.string().trim().min(3).max(300),
      issueDescription: z.string().trim().min(3).max(4000),
      severity: z.enum(PROJECT_GOVERNANCE_LEVELS),
      ...ownerAndDueDate,
    }),
    z.object({
      action: z.literal("CLOSE_RISK"),
      closureNote: z.string().trim().min(3).max(4000),
    }),
    z.object({
      action: z.literal("REOPEN_RISK"),
      note: z.string().trim().min(3).max(4000),
    }),
    z.object({
      action: z.literal("UPDATE_ISSUE"),
      status: z.enum(["OPEN", "IN_PROGRESS"]),
      ...issueFields,
    }),
    z.object({
      action: z.literal("RESOLVE_ISSUE"),
      resolution: z.string().trim().min(3).max(4000),
    }),
    z.object({
      action: z.literal("CLOSE_ISSUE"),
      closureNote: z.string().trim().min(3).max(4000),
    }),
    z.object({
      action: z.literal("REOPEN_ISSUE"),
      note: z.string().trim().min(3).max(4000),
    }),
    z.object({
      action: z.literal("SUPERSEDE_DECISION"),
      ...decisionFields,
    }),
  ],
)

export type ProjectGovernanceMutation = z.infer<
  typeof projectGovernanceMutationSchema
>

const LEVEL_SCORE: Record<ProjectGovernanceLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
}

export function projectRiskExposure(
  probability: ProjectGovernanceLevel,
  impact: ProjectGovernanceLevel,
) {
  return LEVEL_SCORE[probability] * LEVEL_SCORE[impact]
}

export function projectRiskExposureBand(score: number) {
  if (score >= 12) return "CRITICAL" as const
  if (score >= 8) return "HIGH" as const
  if (score >= 4) return "MEDIUM" as const
  return "LOW" as const
}

export function projectGovernancePrefix(
  kind: ProjectGovernanceCreateInput["kind"],
) {
  if (kind === "RISK") return "RSK" as const
  if (kind === "ISSUE") return "ISS" as const
  return "DEC" as const
}

export function assertGovernanceActionAllowed(
  kind: "RISK" | "ISSUE" | "DECISION",
  status: string,
  action: ProjectGovernanceMutation["action"],
) {
  const allowed =
    (kind === "RISK" &&
      ((action === "UPDATE_RISK" &&
        ["OPEN", "MONITORING", "MITIGATED"].includes(status)) ||
        (action === "MATERIALIZE_RISK" &&
          ["OPEN", "MONITORING", "MITIGATED"].includes(status)) ||
        (action === "CLOSE_RISK" &&
          ["OPEN", "MONITORING", "MITIGATED"].includes(status)) ||
        (action === "REOPEN_RISK" && status === "CLOSED"))) ||
    (kind === "ISSUE" &&
      ((action === "UPDATE_ISSUE" &&
        ["OPEN", "IN_PROGRESS"].includes(status)) ||
        (action === "RESOLVE_ISSUE" &&
          ["OPEN", "IN_PROGRESS"].includes(status)) ||
        (action === "CLOSE_ISSUE" && status === "RESOLVED") ||
        (action === "REOPEN_ISSUE" &&
          ["RESOLVED", "CLOSED"].includes(status)))) ||
    (kind === "DECISION" &&
      action === "SUPERSEDE_DECISION" &&
      status === "RECORDED")

  if (!allowed) {
    throw new Error("PROJECT_GOVERNANCE_ACTION_NOT_ALLOWED")
  }
}
