import { z } from "zod"

import type { DiscoveryReportContent } from "@/lib/discovery-report"

export const PRICING_CONTRACT_VERSION = "PRICING_V1"

export const PRICING_ITEM_KINDS = [
  "SERVICE",
  "DELIVERABLE",
  "PHASE",
  "OPTION",
] as const

export const PRICING_AUDIENCES = ["CLIENT", "INTERNAL"] as const
export const PRICING_ADJUSTMENT_MODES = [
  "NONE",
  "PERCENTAGE",
  "FIXED",
] as const

const moneyText = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, "أدخل مبلغًا موجبًا بدقة منزلتين")

const quantityText = z
  .string()
  .trim()
  .regex(/^\d{1,8}(?:\.\d{1,4})?$/, "أدخل كمية موجبة بدقة أربع منازل")
  .refine((value) => Number(value) > 0, "يجب أن تكون الكمية أكبر من صفر")

const adjustmentSchema = z.object({
  mode: z.enum(PRICING_ADJUSTMENT_MODES),
  value: moneyText,
})

export const pricingLineItemSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "معرّف البند غير صالح"),
  kind: z.enum(PRICING_ITEM_KINDS),
  audience: z.enum(PRICING_AUDIENCES),
  title: z.string().trim().min(2).max(500),
  description: z.string().trim().max(2000),
  quantity: quantityText,
  unitPrice: moneyText,
  unitCost: moneyText,
  internalNotes: z.string().trim().max(2000),
})

export const pricingDraftInputSchema = z
  .object({
    title: z.string().trim().min(3).max(300),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "رمز العملة يجب أن يتكون من 3 أحرف"),
    items: z.array(pricingLineItemSchema).min(1).max(100),
    discount: adjustmentSchema,
    tax: adjustmentSchema,
    clientNotes: z.string().trim().max(4000),
    internalNotes: z.string().trim().max(6000),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>()

    value.items.forEach((item, index) => {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "معرّفات بنود التسعير يجب أن تكون فريدة",
        })
      }
      ids.add(item.id)
    })

    if (!value.items.some((item) => item.audience === "CLIENT")) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "يلزم وجود بند واحد ظاهر للعميل على الأقل",
      })
    }

    for (const [field, adjustment] of [
      ["discount", value.discount],
      ["tax", value.tax],
    ] as const) {
      if (
        adjustment.mode === "PERCENTAGE" &&
        Number(adjustment.value) > 100
      ) {
        context.addIssue({
          code: "custom",
          path: [field, "value"],
          message: "النسبة لا يمكن أن تتجاوز 100%",
        })
      }

      if (adjustment.mode === "NONE" && Number(adjustment.value) !== 0) {
        context.addIssue({
          code: "custom",
          path: [field, "value"],
          message: "يجب أن تكون القيمة صفرًا عند اختيار بدون",
        })
      }
    }
  })

export type PricingDraftInput = z.infer<typeof pricingDraftInputSchema>
export type PricingLineItem = PricingDraftInput["items"][number]

const totalsSchema = z.object({
  clientSubtotal: moneyText,
  internalCost: z.string().regex(/^-?\d{1,16}(?:\.\d{2})$/),
  discountAmount: moneyText,
  netRevenue: moneyText,
  taxAmount: moneyText,
  grandTotal: moneyText,
  grossProfit: z.string().regex(/^-?\d{1,16}(?:\.\d{2})$/),
  marginPercent: z.string().regex(/^-?\d{1,8}(?:\.\d{2})$/),
})

export const pricingVersionContentSchema = pricingDraftInputSchema.safeExtend({
  contractVersion: z.literal(PRICING_CONTRACT_VERSION),
  totals: totalsSchema,
})

export type PricingVersionContent = z.infer<
  typeof pricingVersionContentSchema
>

const BIGINT_ZERO = BigInt(0)
const BIGINT_TWO = BigInt(2)
const BIGINT_TEN = BigInt(10)
const MONEY_SCALE = BigInt(100)
const QUANTITY_SCALE = BigInt(10_000)
const PERCENT_SCALE = BigInt(10_000)
const PERCENT_DENOMINATOR = BigInt(100) * PERCENT_SCALE
const MAX_MONEY_MINOR = BigInt("99999999999999")

function decimalToScaled(value: string, scaleDigits: number) {
  const [whole, fraction = ""] = value.split(".")
  return (
    BigInt(whole) * BIGINT_TEN ** BigInt(scaleDigits) +
    BigInt(fraction.padEnd(scaleDigits, "0"))
  )
}

function roundDivide(value: bigint, denominator: bigint) {
  return (value + denominator / BIGINT_TWO) / denominator
}

function moneyToMinor(value: string) {
  return decimalToScaled(value, 2)
}

function quantityToScaled(value: string) {
  return decimalToScaled(value, 4)
}

function percentageToScaled(value: string) {
  const [whole, fraction = ""] = value.split(".")
  return (
    BigInt(whole) * PERCENT_SCALE +
    BigInt(fraction.padEnd(4, "0"))
  )
}

function lineTotalMinor(quantity: string, unitAmount: string) {
  return roundDivide(
    quantityToScaled(quantity) * moneyToMinor(unitAmount),
    QUANTITY_SCALE,
  )
}

function signedMinorToText(value: bigint) {
  const sign = value < BIGINT_ZERO ? "-" : ""
  const absolute = value < BIGINT_ZERO ? -value : value
  const whole = absolute / MONEY_SCALE
  const fraction = (absolute % MONEY_SCALE).toString().padStart(2, "0")
  return `${sign}${whole}.${fraction}`
}

export function minorToMoneyText(value: bigint) {
  if (value < BIGINT_ZERO) {
    throw new Error("Money values cannot be negative")
  }
  return signedMinorToText(value)
}

function normalizedMoney(value: string) {
  return minorToMoneyText(moneyToMinor(value))
}

function normalizedQuantity(value: string) {
  const scaled = quantityToScaled(value)
  const whole = scaled / QUANTITY_SCALE
  const fraction = (scaled % QUANTITY_SCALE)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "")
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

function adjustmentAmount(
  baseMinor: bigint,
  adjustment: PricingDraftInput["discount"],
) {
  if (adjustment.mode === "NONE") return BIGINT_ZERO
  if (adjustment.mode === "FIXED") {
    return moneyToMinor(adjustment.value)
  }
  return roundDivide(
    baseMinor * percentageToScaled(adjustment.value),
    PERCENT_DENOMINATOR,
  )
}

export function calculatePricingTotals(input: PricingDraftInput) {
  let clientSubtotalMinor = BIGINT_ZERO
  let internalCostMinor = BIGINT_ZERO

  for (const item of input.items) {
    if (item.audience === "CLIENT") {
      clientSubtotalMinor += lineTotalMinor(
        item.quantity,
        item.unitPrice,
      )
    }
    internalCostMinor += lineTotalMinor(item.quantity, item.unitCost)

    if (
      clientSubtotalMinor > MAX_MONEY_MINOR ||
      internalCostMinor > MAX_MONEY_MINOR
    ) {
      throw new Error("PRICING_TOTAL_TOO_LARGE")
    }
  }

  const discountMinor = adjustmentAmount(
    clientSubtotalMinor,
    input.discount,
  )

  if (discountMinor > clientSubtotalMinor) {
    throw new Error("PRICING_DISCOUNT_EXCEEDS_SUBTOTAL")
  }

  const netRevenueMinor = clientSubtotalMinor - discountMinor
  const taxMinor = adjustmentAmount(netRevenueMinor, input.tax)
  const grandTotalMinor = netRevenueMinor + taxMinor
  const grossProfitMinor = netRevenueMinor - internalCostMinor

  if (
    discountMinor > MAX_MONEY_MINOR ||
    taxMinor > MAX_MONEY_MINOR ||
    grandTotalMinor > MAX_MONEY_MINOR
  ) {
    throw new Error("PRICING_TOTAL_TOO_LARGE")
  }
  const marginPercent =
    netRevenueMinor === BIGINT_ZERO
      ? "0.00"
      : (
          (Number(grossProfitMinor) / Number(netRevenueMinor)) *
          100
        ).toFixed(2)

  return {
    clientSubtotalMinor,
    internalCostMinor,
    discountMinor,
    netRevenueMinor,
    taxMinor,
    grandTotalMinor,
    grossProfitMinor,
    marginPercent,
    display: {
      clientSubtotal: minorToMoneyText(clientSubtotalMinor),
      internalCost: signedMinorToText(internalCostMinor),
      discountAmount: minorToMoneyText(discountMinor),
      netRevenue: minorToMoneyText(netRevenueMinor),
      taxAmount: minorToMoneyText(taxMinor),
      grandTotal: minorToMoneyText(grandTotalMinor),
      grossProfit: signedMinorToText(grossProfitMinor),
      marginPercent,
    },
  }
}

export function normalizePricingContent(
  input: PricingDraftInput,
): PricingVersionContent {
  const normalizedInput: PricingDraftInput = {
    title: input.title.trim(),
    currency: input.currency.trim().toUpperCase(),
    items: input.items.map((item) => ({
      ...item,
      title: item.title.trim(),
      description: item.description.trim(),
      quantity: normalizedQuantity(item.quantity),
      unitPrice: normalizedMoney(item.unitPrice),
      unitCost: normalizedMoney(item.unitCost),
      internalNotes: item.internalNotes.trim(),
    })),
    discount: {
      mode: input.discount.mode,
      value:
        input.discount.mode === "NONE"
          ? "0.00"
          : normalizedMoney(input.discount.value),
    },
    tax: {
      mode: input.tax.mode,
      value:
        input.tax.mode === "NONE"
          ? "0.00"
          : normalizedMoney(input.tax.value),
    },
    clientNotes: input.clientNotes.trim(),
    internalNotes: input.internalNotes.trim(),
  }

  return {
    contractVersion: PRICING_CONTRACT_VERSION,
    ...normalizedInput,
    totals: calculatePricingTotals(normalizedInput).display,
  }
}

export function createInitialPricingDraft({
  report,
  currency,
  displayName,
}: {
  report: DiscoveryReportContent
  currency: string
  displayName: string
}): PricingDraftInput {
  return {
    title: `تسعير نطاق — ${displayName}`,
    currency,
    items: report.scopeItems.map((scopeItem, index) => ({
      id: `scope-${index + 1}`,
      kind: "DELIVERABLE",
      audience: "CLIENT",
      title: scopeItem,
      description: "",
      quantity: "1",
      unitPrice: "0.00",
      unitCost: "0.00",
      internalNotes: "",
    })),
    discount: {
      mode: "NONE",
      value: "0.00",
    },
    tax: {
      mode: "NONE",
      value: "0.00",
    },
    clientNotes: "",
    internalNotes: "",
  }
}

export function pricingItemKindLabel(
  kind: PricingLineItem["kind"],
) {
  const labels: Record<PricingLineItem["kind"], string> = {
    SERVICE: "خدمة",
    DELIVERABLE: "مخرج",
    PHASE: "مرحلة",
    OPTION: "خيار إضافي",
  }
  return labels[kind]
}
