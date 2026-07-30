import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { normalizePricingContent } from "../../src/lib/pricing"
import {
  clientSafeProposalProjection,
  createInitialProposalDraft,
  normalizeProposalContent,
  proposalDraftInputSchema,
  proposalReviewIssues,
} from "../../src/lib/proposal"

const pricing = normalizePricingContent({
  title: "تسعير معتمد",
  currency: "JOD",
  items: [
    {
      id: "client-1",
      kind: "DELIVERABLE",
      audience: "CLIENT",
      title: "بناء المنصة",
      description: "النطاق الظاهر للعميل",
      quantity: "2",
      unitPrice: "500.00",
      unitCost: "150.00",
      internalNotes: "سر داخلي للبند",
    },
    {
      id: "internal-1",
      kind: "SERVICE",
      audience: "INTERNAL",
      title: "ضمان الجودة",
      description: "",
      quantity: "1",
      unitPrice: "0.00",
      unitCost: "75.00",
      internalNotes: "لا يظهر للعميل",
    },
  ],
  discount: {
    mode: "PERCENTAGE",
    value: "10",
  },
  tax: {
    mode: "NONE",
    value: "0",
  },
  clientNotes: "الأسعار تشمل النطاق المبين",
  internalNotes: "الهامش مستهدف داخليًا",
})

const completeDraft = {
  title: "عرض فني ومالي",
  validityDays: 30,
  estimatedDuration: "6 أسابيع",
  sections: [
    {
      id: "summary",
      kind: "SUMMARY" as const,
      audience: "CLIENT" as const,
      title: "الملخص",
      body: "نقترح تنفيذ النطاق وفق التقرير المعتمد.",
    },
    {
      id: "internal",
      kind: "INTERNAL_NOTE" as const,
      audience: "INTERNAL" as const,
      title: "قرار داخلي",
      body: "هذه العبارة لا تصل إلى العميل إطلاقًا.",
    },
  ],
  paymentMilestones: [
    {
      id: "first",
      label: "الدفعة الأولى",
      percentage: "50",
      dueCondition: "عند اعتماد بدء العمل",
    },
    {
      id: "second",
      label: "الدفعة النهائية",
      percentage: "50",
      dueCondition: "عند التسليم النهائي",
    },
  ],
}

test("proposal draft requires unique ids and a client section", () => {
  const internalOnly = proposalDraftInputSchema.safeParse({
    ...completeDraft,
    sections: [completeDraft.sections[1]],
  })
  const duplicateSections = proposalDraftInputSchema.safeParse({
    ...completeDraft,
    sections: [
      completeDraft.sections[0],
      {
        ...completeDraft.sections[1],
        id: completeDraft.sections[0].id,
      },
    ],
  })
  const duplicatePayments = proposalDraftInputSchema.safeParse({
    ...completeDraft,
    paymentMilestones: [
      completeDraft.paymentMilestones[0],
      {
        ...completeDraft.paymentMilestones[1],
        id: completeDraft.paymentMilestones[0].id,
      },
    ],
  })

  assert.equal(internalOnly.success, false)
  assert.equal(duplicateSections.success, false)
  assert.equal(duplicatePayments.success, false)
})

test("client projection excludes pricing costs and internal narrative", () => {
  const content = normalizeProposalContent({
    draft: proposalDraftInputSchema.parse(completeDraft),
    pricing,
  })
  const projection = clientSafeProposalProjection(content)
  const serialized = JSON.stringify(projection)

  assert.equal(projection.sections.length, 1)
  assert.equal(projection.commercial.items.length, 1)
  assert.equal(projection.commercial.items[0].lineTotal, "1000.00")
  for (const forbidden of [
    "unitCost",
    "internalCost",
    "grossProfit",
    "marginPercent",
    "internalNotes",
    "هذه العبارة لا تصل إلى العميل إطلاقًا",
    "الهامش مستهدف داخليًا",
    "سر داخلي للبند",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden))
  }
})

test("proposal review requires duration, payments totaling 100, and value", () => {
  const ready = normalizeProposalContent({
    draft: proposalDraftInputSchema.parse(completeDraft),
    pricing,
  })
  const incomplete = normalizeProposalContent({
    draft: proposalDraftInputSchema.parse({
      ...completeDraft,
      estimatedDuration: "",
      paymentMilestones: [],
    }),
    pricing,
  })
  const partial = normalizeProposalContent({
    draft: proposalDraftInputSchema.parse({
      ...completeDraft,
      paymentMilestones: [
        {
          ...completeDraft.paymentMilestones[0],
          percentage: "40",
        },
      ],
    }),
    pricing,
  })

  assert.deepEqual(proposalReviewIssues(ready), [])
  assert.ok(proposalReviewIssues(incomplete).length >= 2)
  assert.match(proposalReviewIssues(partial).join(" "), /100%/)
})

test("initial proposal inherits approved narrative and pricing without deciding payments", () => {
  const draft = createInitialProposalDraft({
    displayName: "شركة مثال",
    pricing,
    report: {
      executiveSummary:
        "هذا ملخص تنفيذي معتمد يشرح الحاجة والنطاق المقترح بشكل واضح.",
      problemStatement: "مشكلة واضحة لدى العميل",
      currentState: "وضع حالي موثق",
      desiredOutcomes: ["رفع الكفاءة", "توحيد البيانات"],
      recommendedApproach:
        "تنفيذ مرحلي يبدأ بالتصميم ثم التطوير والتحقق.",
      scopeItems: ["المنصة"],
      successMeasures: ["مقياس"],
      constraints: [],
      risks: [],
      assumptions: [],
      openQuestions: [],
      recommendedNextStep: "إعداد العرض",
    },
  })

  assert.match(draft.title, /شركة مثال/)
  assert.match(draft.sections[0].body, /ملخص تنفيذي معتمد/)
  assert.match(draft.sections[1].body, /رفع الكفاءة/)
  assert.equal(draft.paymentMilestones.length, 0)
  assert.equal(draft.estimatedDuration, "")
  assert.ok(
    draft.sections.some(
      (section) =>
        section.audience === "INTERNAL" &&
        section.body === pricing.internalNotes,
    ),
  )
})

test("PROP-01 mutations are scoped, locked, auditable, and do not send or create projects", () => {
  const saveRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/proposal/route.ts",
    ),
    "utf8",
  )
  const reviewRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/proposal/review/route.ts",
    ),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731010000_prop_01_central_proposals/migration.sql",
    ),
    "utf8",
  )
  const legacyRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/sales/opportunities/[id]/proposals/route.ts",
    ),
    "utf8",
  )
  const queuePage = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/proposals/page.tsx",
    ),
    "utf8",
  )

  for (const source of [saveRoute, reviewRoute]) {
    assert.match(source, /assertSameOrigin\(request\)/)
    assert.match(source, /companyId: user\.companyId/)
    assert.match(source, /FOR UPDATE/)
    assert.match(source, /logActivity/)
  }

  assert.match(saveRoute, /proposalClientContentHash/)
  assert.match(reviewRoute, /assertCanApproveProposal/)
  assert.doesNotMatch(reviewRoute, /salesProposal\.(create|upsert)/)
  assert.doesNotMatch(reviewRoute, /project\.(create|upsert)/)
  assert.doesNotMatch(reviewRoute, /stage:\s*"PROPOSAL"/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.match(legacyRoute, /CENTRAL_PROPOSAL_REQUIRED/)
  assert.match(queuePage, /ACCESS_ROLES\.proposalRead/)
  assert.match(queuePage, /companyId: user\.companyId/)
  assert.match(queuePage, /status: "APPROVED"/)
})
