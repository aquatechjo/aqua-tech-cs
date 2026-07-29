import { z } from "zod"

export const DISCOVERY_REPORT_PROMPT_VERSION = "DISCOVERY_REPORT_V1"

const reportText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum)

const reportList = (maximumItems: number) =>
  z.array(reportText(2, 800)).max(maximumItems)

export const discoveryReportContentSchema = z.object({
  executiveSummary: reportText(50, 6000),
  problemStatement: reportText(20, 4000),
  currentState: reportText(20, 4000),
  desiredOutcomes: reportList(12).min(1),
  recommendedApproach: reportText(20, 5000),
  scopeItems: reportList(20).min(1),
  successMeasures: reportList(12).min(1),
  constraints: reportList(12),
  risks: z
    .array(
      z.object({
        title: reportText(2, 500),
        impact: reportText(2, 800),
        mitigation: reportText(2, 800),
      }),
    )
    .max(12),
  assumptions: reportList(12),
  openQuestions: reportList(12),
  recommendedNextStep: reportText(10, 2000),
})

export type DiscoveryReportContent = z.infer<
  typeof discoveryReportContentSchema
>

export const EMPTY_DISCOVERY_REPORT_CONTENT: DiscoveryReportContent = {
  executiveSummary: "",
  problemStatement: "",
  currentState: "",
  desiredOutcomes: [],
  recommendedApproach: "",
  scopeItems: [],
  successMeasures: [],
  constraints: [],
  risks: [],
  assumptions: [],
  openQuestions: [],
  recommendedNextStep: "",
}

export const DISCOVERY_REPORT_CONTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "problemStatement",
    "currentState",
    "desiredOutcomes",
    "recommendedApproach",
    "scopeItems",
    "successMeasures",
    "constraints",
    "risks",
    "assumptions",
    "openQuestions",
    "recommendedNextStep",
  ],
  properties: {
    executiveSummary: { type: "string" },
    problemStatement: { type: "string" },
    currentState: { type: "string" },
    desiredOutcomes: {
      type: "array",
      items: { type: "string" },
    },
    recommendedApproach: { type: "string" },
    scopeItems: {
      type: "array",
      items: { type: "string" },
    },
    successMeasures: {
      type: "array",
      items: { type: "string" },
    },
    constraints: {
      type: "array",
      items: { type: "string" },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "impact", "mitigation"],
        properties: {
          title: { type: "string" },
          impact: { type: "string" },
          mitigation: { type: "string" },
        },
      },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
    openQuestions: {
      type: "array",
      items: { type: "string" },
    },
    recommendedNextStep: { type: "string" },
  },
} as const

export function parseDiscoveryReportLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\s\-•*\d.)]+/, "").trim())
    .filter(Boolean)
}

export function discoveryReportLines(value: readonly string[]) {
  return value.join("\n")
}

export function normalizeDiscoveryReportContent(
  content: DiscoveryReportContent,
): DiscoveryReportContent {
  return {
    executiveSummary: content.executiveSummary.trim(),
    problemStatement: content.problemStatement.trim(),
    currentState: content.currentState.trim(),
    desiredOutcomes: content.desiredOutcomes.map((item) => item.trim()),
    recommendedApproach: content.recommendedApproach.trim(),
    scopeItems: content.scopeItems.map((item) => item.trim()),
    successMeasures: content.successMeasures.map((item) => item.trim()),
    constraints: content.constraints.map((item) => item.trim()),
    risks: content.risks.map((risk) => ({
      title: risk.title.trim(),
      impact: risk.impact.trim(),
      mitigation: risk.mitigation.trim(),
    })),
    assumptions: content.assumptions.map((item) => item.trim()),
    openQuestions: content.openQuestions.map((item) => item.trim()),
    recommendedNextStep: content.recommendedNextStep.trim(),
  }
}

export function isDiscoveryReportEvidenceStale({
  versionEvidenceHash,
  currentEvidenceHash,
}: {
  versionEvidenceHash: string | null
  currentEvidenceHash: string
}) {
  return (
    versionEvidenceHash !== null &&
    versionEvidenceHash !== currentEvidenceHash
  )
}
