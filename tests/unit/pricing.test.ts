import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  calculatePricingTotals,
  createInitialPricingDraft,
  normalizePricingContent,
  pricingDraftInputSchema,
} from "../../src/lib/pricing"

const baseDraft = {
  title: "تسعير مشروع تجريبي",
  currency: "JOD",
  items: [
    {
      id: "client-1",
      kind: "DELIVERABLE" as const,
      audience: "CLIENT" as const,
      title: "تطوير النظام",
      description: "تنفيذ النطاق المعتمد",
      quantity: "2",
      unitPrice: "100.00",
      unitCost: "40.00",
      internalNotes: "",
    },
    {
      id: "internal-1",
      kind: "SERVICE" as const,
      audience: "INTERNAL" as const,
      title: "مراجعة الجودة",
      description: "",
      quantity: "3",
      unitPrice: "0.00",
      unitCost: "10.00",
      internalNotes: "لا يظهر للعميل",
    },
  ],
  discount: {
    mode: "PERCENTAGE" as const,
    value: "10",
  },
  tax: {
    mode: "PERCENTAGE" as const,
    value: "16",
  },
  clientNotes: "",
  internalNotes: "",
}

test("pricing separates client revenue from all internal costs", () => {
  const parsed = pricingDraftInputSchema.parse(baseDraft)
  const totals = calculatePricingTotals(parsed)

  assert.equal(totals.display.clientSubtotal, "200.00")
  assert.equal(totals.display.internalCost, "110.00")
  assert.equal(totals.display.discountAmount, "20.00")
  assert.equal(totals.display.netRevenue, "180.00")
  assert.equal(totals.display.taxAmount, "28.80")
  assert.equal(totals.display.grandTotal, "208.80")
  assert.equal(totals.display.grossProfit, "70.00")
  assert.equal(totals.display.marginPercent, "38.89")
})

test("tax and discount stay explicit with no assumed rate", () => {
  const parsed = pricingDraftInputSchema.parse({
    ...baseDraft,
    discount: {
      mode: "FIXED",
      value: "25",
    },
    tax: {
      mode: "NONE",
      value: "0",
    },
  })
  const content = normalizePricingContent(parsed)

  assert.equal(content.discount.value, "25.00")
  assert.equal(content.tax.value, "0.00")
  assert.equal(content.totals.netRevenue, "175.00")
  assert.equal(content.totals.taxAmount, "0.00")
  assert.equal(content.totals.grandTotal, "175.00")
})

test("pricing rejects a discount above client revenue", () => {
  const parsed = pricingDraftInputSchema.parse({
    ...baseDraft,
    discount: {
      mode: "FIXED",
      value: "250",
    },
  })

  assert.throws(
    () => calculatePricingTotals(parsed),
    /PRICING_DISCOUNT_EXCEEDS_SUBTOTAL/,
  )
})

test("pricing rounds fractional quantities to currency precision", () => {
  const parsed = pricingDraftInputSchema.parse({
    ...baseDraft,
    items: [
      {
        ...baseDraft.items[0],
        quantity: "1.3333",
        unitPrice: "10.00",
        unitCost: "0.00",
      },
    ],
    discount: {
      mode: "NONE",
      value: "0",
    },
    tax: {
      mode: "NONE",
      value: "0",
    },
  })

  assert.equal(
    calculatePricingTotals(parsed).display.grandTotal,
    "13.33",
  )
})

test("pricing requires a client-visible line and unique item ids", () => {
  const internalOnly = pricingDraftInputSchema.safeParse({
    ...baseDraft,
    items: [baseDraft.items[1]],
  })
  const duplicateIds = pricingDraftInputSchema.safeParse({
    ...baseDraft,
    items: [
      baseDraft.items[0],
      {
        ...baseDraft.items[1],
        id: baseDraft.items[0].id,
      },
    ],
  })

  assert.equal(internalOnly.success, false)
  assert.equal(duplicateIds.success, false)
})

test("initial pricing draft inherits approved discovery scope without prices", () => {
  const draft = createInitialPricingDraft({
    displayName: "شركة مثال",
    currency: "JOD",
    report: {
      executiveSummary: "ملخص معتمد",
      problemStatement: "مشكلة واضحة",
      currentState: "وضع حالي واضح",
      desiredOutcomes: ["نتيجة"],
      recommendedApproach: "منهج",
      scopeItems: ["الموقع", "لوحة التحكم"],
      successMeasures: ["مقياس"],
      constraints: [],
      risks: [],
      assumptions: [],
      openQuestions: [],
      recommendedNextStep: "التسعير",
    },
  })

  assert.equal(draft.items.length, 2)
  assert.deepEqual(
    draft.items.map((item) => item.title),
    ["الموقع", "لوحة التحكم"],
  )
  assert.ok(
    draft.items.every(
      (item) =>
        item.audience === "CLIENT" &&
        item.unitPrice === "0.00" &&
        item.unitCost === "0.00",
    ),
  )
})

test("PRIC-01 mutations stay scoped, locked, auditable, and proposal-free", () => {
  const saveRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/pricing/route.ts",
    ),
    "utf8",
  )
  const reviewRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/discovery/sessions/[id]/pricing/review/route.ts",
    ),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260730180000_pric_01_human_scope_pricing/migration.sql",
    ),
    "utf8",
  )
  const queuePage = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/pricing/page.tsx",
    ),
    "utf8",
  )

  for (const source of [saveRoute, reviewRoute]) {
    assert.match(source, /assertSameOrigin\(request\)/)
    assert.match(source, /companyId: user\.companyId/)
    assert.match(source, /FOR UPDATE/)
    assert.match(source, /logActivity/)
  }

  assert.match(reviewRoute, /assertCanApprovePricing/)
  assert.match(reviewRoute, /estimatedValue: content\.totals\.grandTotal/)
  assert.doesNotMatch(reviewRoute, /salesProposal\.(create|upsert)/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.match(queuePage, /ACCESS_ROLES\.pricingRead/)
  assert.match(queuePage, /companyId: user\.companyId/)
  assert.match(queuePage, /status: "APPROVED"/)
  assert.match(queuePage, /pricingVersionContentSchema\.safeParse/)
})
