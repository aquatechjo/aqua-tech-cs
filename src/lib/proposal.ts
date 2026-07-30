import { z } from "zod"

import type { DiscoveryReportContent } from "@/lib/discovery-report"
import {
  calculatePricingLineTotal,
  type PricingVersionContent,
} from "@/lib/pricing"

export const PROPOSAL_CONTRACT_VERSION = "PROPOSAL_V1"

export const PROPOSAL_AUDIENCES = ["CLIENT", "INTERNAL"] as const
export const PROPOSAL_SECTION_KINDS = [
  "SUMMARY",
  "OBJECTIVES",
  "APPROACH",
  "TIMELINE",
  "TERMS",
  "EXCLUSIONS",
  "ASSUMPTIONS",
  "INTERNAL_NOTE",
  "CUSTOM",
] as const

const moneyText = z
  .string()
  .trim()
  .regex(/^\d{1,14}(?:\.\d{2})$/, "قيمة مالية غير صحيحة")

const percentageText = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/, "أدخل نسبة بدقة منزلتين")
  .refine((value) => Number(value) <= 100, "النسبة لا تتجاوز 100%")

export const proposalSectionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "معرّف القسم غير صالح"),
  kind: z.enum(PROPOSAL_SECTION_KINDS),
  audience: z.enum(PROPOSAL_AUDIENCES),
  title: z.string().trim().min(2).max(300),
  body: z.string().trim().min(1).max(6000),
})

export const proposalPaymentMilestoneSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "معرّف الدفعة غير صالح"),
  label: z.string().trim().min(2).max(300),
  percentage: percentageText,
  dueCondition: z.string().trim().min(2).max(1000),
})

export const proposalDraftInputSchema = z
  .object({
    title: z.string().trim().min(3).max(300),
    validityDays: z.number().int().min(1).max(365),
    estimatedDuration: z.string().trim().max(500),
    sections: z.array(proposalSectionSchema).min(1).max(40),
    paymentMilestones: z
      .array(proposalPaymentMilestoneSchema)
      .max(20),
  })
  .superRefine((value, context) => {
    const sectionIds = new Set<string>()
    value.sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          path: ["sections", index, "id"],
          message: "معرّفات أقسام العرض يجب أن تكون فريدة",
        })
      }
      sectionIds.add(section.id)
    })

    if (!value.sections.some((section) => section.audience === "CLIENT")) {
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "يلزم وجود قسم واحد ظاهر للعميل على الأقل",
      })
    }

    const milestoneIds = new Set<string>()
    let percentageHundredths = 0
    value.paymentMilestones.forEach((milestone, index) => {
      if (milestoneIds.has(milestone.id)) {
        context.addIssue({
          code: "custom",
          path: ["paymentMilestones", index, "id"],
          message: "معرّفات دفعات العرض يجب أن تكون فريدة",
        })
      }
      milestoneIds.add(milestone.id)
      percentageHundredths += percentageToHundredths(
        milestone.percentage,
      )
    })

    if (percentageHundredths > 10_000) {
      context.addIssue({
        code: "custom",
        path: ["paymentMilestones"],
        message: "مجموع نسب الدفعات لا يمكن أن يتجاوز 100%",
      })
    }
  })

export type ProposalDraftInput = z.infer<
  typeof proposalDraftInputSchema
>
export type ProposalSection = ProposalDraftInput["sections"][number]

const commercialItemSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: moneyText,
  lineTotal: moneyText,
})

const commercialSnapshotSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(commercialItemSchema).min(1),
  discount: z.object({
    mode: z.enum(["NONE", "PERCENTAGE", "FIXED"]),
    value: z.string(),
    amount: moneyText,
  }),
  tax: z.object({
    mode: z.enum(["NONE", "PERCENTAGE", "FIXED"]),
    value: z.string(),
    amount: moneyText,
  }),
  totals: z.object({
    clientSubtotal: moneyText,
    discountAmount: moneyText,
    netRevenue: moneyText,
    taxAmount: moneyText,
    grandTotal: moneyText,
  }),
  clientNotes: z.string(),
})

export const proposalVersionContentSchema =
  proposalDraftInputSchema.safeExtend({
    contractVersion: z.literal(PROPOSAL_CONTRACT_VERSION),
    commercial: commercialSnapshotSchema,
  })

export type ProposalVersionContent = z.infer<
  typeof proposalVersionContentSchema
>

function percentageToHundredths(value: string) {
  const [whole, fraction = ""] = value.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
}

function normalizePercentage(value: string) {
  const hundredths = percentageToHundredths(value)
  return `${Math.floor(hundredths / 100)}.${String(
    hundredths % 100,
  ).padStart(2, "0")}`
}

export function proposalPaymentPercentage(
  milestones: ProposalDraftInput["paymentMilestones"],
) {
  return milestones.reduce(
    (sum, milestone) =>
      sum + percentageToHundredths(milestone.percentage),
    0,
  )
}

export function createProposalCommercialSnapshot(
  pricing: PricingVersionContent,
): ProposalVersionContent["commercial"] {
  return {
    currency: pricing.currency,
    items: pricing.items
      .filter((item) => item.audience === "CLIENT")
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: calculatePricingLineTotal(
          item.quantity,
          item.unitPrice,
        ),
      })),
    discount: {
      mode: pricing.discount.mode,
      value: pricing.discount.value,
      amount: pricing.totals.discountAmount,
    },
    tax: {
      mode: pricing.tax.mode,
      value: pricing.tax.value,
      amount: pricing.totals.taxAmount,
    },
    totals: {
      clientSubtotal: pricing.totals.clientSubtotal,
      discountAmount: pricing.totals.discountAmount,
      netRevenue: pricing.totals.netRevenue,
      taxAmount: pricing.totals.taxAmount,
      grandTotal: pricing.totals.grandTotal,
    },
    clientNotes: pricing.clientNotes,
  }
}

export function normalizeProposalContent({
  draft,
  pricing,
}: {
  draft: ProposalDraftInput
  pricing: PricingVersionContent
}): ProposalVersionContent {
  return {
    contractVersion: PROPOSAL_CONTRACT_VERSION,
    title: draft.title.trim(),
    validityDays: draft.validityDays,
    estimatedDuration: draft.estimatedDuration.trim(),
    sections: draft.sections.map((section) => ({
      ...section,
      title: section.title.trim(),
      body: section.body.trim(),
    })),
    paymentMilestones: draft.paymentMilestones.map((milestone) => ({
      ...milestone,
      label: milestone.label.trim(),
      percentage: normalizePercentage(milestone.percentage),
      dueCondition: milestone.dueCondition.trim(),
    })),
    commercial: createProposalCommercialSnapshot(pricing),
  }
}

export function proposalReviewIssues(content: ProposalVersionContent) {
  const issues: string[] = []

  if (content.estimatedDuration.trim().length < 2) {
    issues.push("أدخل المدة التقديرية")
  }
  if (content.paymentMilestones.length === 0) {
    issues.push("أضف جدول دفعات")
  } else if (
    proposalPaymentPercentage(content.paymentMilestones) !== 10_000
  ) {
    issues.push("يجب أن يساوي مجموع نسب الدفعات 100%")
  }
  if (Number(content.commercial.totals.grandTotal) <= 0) {
    issues.push("يجب أن تكون قيمة العرض أكبر من صفر")
  }

  return issues
}

export function clientSafeProposalProjection(
  content: ProposalVersionContent,
) {
  return {
    contractVersion: content.contractVersion,
    title: content.title,
    validityDays: content.validityDays,
    estimatedDuration: content.estimatedDuration,
    sections: content.sections.filter(
      (section) => section.audience === "CLIENT",
    ),
    paymentMilestones: content.paymentMilestones,
    commercial: content.commercial,
  }
}

export function createInitialProposalDraft({
  report,
  pricing,
  displayName,
}: {
  report: DiscoveryReportContent
  pricing: PricingVersionContent
  displayName: string
}): ProposalDraftInput {
  const sections: ProposalDraftInput["sections"] = [
    {
      id: "summary",
      kind: "SUMMARY",
      audience: "CLIENT",
      title: "الملخص التنفيذي",
      body: report.executiveSummary,
    },
    {
      id: "objectives",
      kind: "OBJECTIVES",
      audience: "CLIENT",
      title: "الأهداف والنتائج المتوقعة",
      body: report.desiredOutcomes.map((item) => `• ${item}`).join("\n"),
    },
    {
      id: "approach",
      kind: "APPROACH",
      audience: "CLIENT",
      title: "النهج المقترح",
      body: report.recommendedApproach,
    },
  ]

  if (pricing.internalNotes.trim()) {
    sections.push({
      id: "internal-pricing-note",
      kind: "INTERNAL_NOTE",
      audience: "INTERNAL",
      title: "ملاحظات داخلية من التسعير",
      body: pricing.internalNotes,
    })
  }

  return {
    title: `عرض فني ومالي — ${displayName}`,
    validityDays: 30,
    estimatedDuration: "",
    sections,
    paymentMilestones: [],
  }
}

export function proposalSectionKindLabel(
  kind: ProposalSection["kind"],
) {
  const labels: Record<ProposalSection["kind"], string> = {
    SUMMARY: "ملخص",
    OBJECTIVES: "أهداف",
    APPROACH: "نهج العمل",
    TIMELINE: "جدول زمني",
    TERMS: "شروط",
    EXCLUSIONS: "استثناءات",
    ASSUMPTIONS: "افتراضات",
    INTERNAL_NOTE: "ملاحظة داخلية",
    CUSTOM: "قسم مخصص",
  }
  return labels[kind]
}
