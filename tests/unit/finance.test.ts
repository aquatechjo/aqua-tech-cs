import assert from "node:assert/strict"
import test from "node:test"
import {
  businessDate,
  calculateInvoiceTotals,
  canTransitionExpense,
  displayInvoiceStatus,
  documentNumber,
  localDateKey,
  minorToMoney,
  parseScaledDecimal,
  paymentAdjustedInvoiceStatus,
} from "../../src/lib/finance"

test("invoice totals are calculated from scaled decimal values", () => {
  const totals = calculateInvoiceTotals({
    items: [
      { description: "Website", quantity: "1", unitPrice: "1250.50" },
      { description: "Support", quantity: "2.50", unitPrice: "40.00" },
    ],
    discountAmount: "50.25",
    taxAmount: "10.00",
  })

  assert.equal(totals.subtotal, "1350.50")
  assert.equal(totals.discountAmount, "50.25")
  assert.equal(totals.taxAmount, "10.00")
  assert.equal(totals.totalAmount, "1310.25")
  assert.equal(totals.items[1]?.lineTotal, "100.00")
})

test("money parsing rejects excess precision and invalid discounts", () => {
  assert.equal(parseScaledDecimal("12.30"), 1230)
  assert.equal(minorToMoney(-125), "-1.25")
  assert.throws(() => parseScaledDecimal("1.001"), /TOO_MANY_DECIMALS/)
  assert.throws(
    () =>
      calculateInvoiceTotals({
        items: [{ description: "Service", quantity: "1", unitPrice: "10" }],
        discountAmount: "11",
      }),
    /DISCOUNT_EXCEEDS_SUBTOTAL/,
  )
})

test("invoice status follows posted payments without overriding drafts or cancellations", () => {
  assert.equal(
    paymentAdjustedInvoiceStatus({
      currentStatus: "ISSUED",
      totalMinor: 10_000,
      amountPaidMinor: 4_000,
    }),
    "PARTIALLY_PAID",
  )
  assert.equal(
    paymentAdjustedInvoiceStatus({
      currentStatus: "ISSUED",
      totalMinor: 10_000,
      amountPaidMinor: 10_000,
    }),
    "PAID",
  )
  assert.equal(
    paymentAdjustedInvoiceStatus({
      currentStatus: "DRAFT",
      totalMinor: 10_000,
      amountPaidMinor: 0,
    }),
    "DRAFT",
  )
})

test("overdue status is derived without mutating stored invoice status", () => {
  assert.equal(
    displayInvoiceStatus({
      status: "ISSUED",
      dueDate: "2026-07-01T00:00:00.000Z",
      totalMinor: 10_000,
      amountPaidMinor: 0,
      now: new Date("2026-07-24T00:00:00.000Z"),
    }),
    "OVERDUE",
  )

  assert.equal(
    displayInvoiceStatus({
      status: "ISSUED",
      dueDate: "2026-07-24T00:00:00.000Z",
      totalMinor: 10_000,
      amountPaidMinor: 0,
      now: new Date("2026-07-24T18:00:00.000Z"),
      timeZone: "Asia/Amman",
    }),
    "ISSUED",
    "an invoice due on the current business day is not overdue",
  )

  assert.equal(
    displayInvoiceStatus({
      status: "PAID",
      dueDate: "2026-07-01T00:00:00.000Z",
      totalMinor: 10_000,
      amountPaidMinor: 10_000,
      now: new Date("2026-07-24T00:00:00.000Z"),
    }),
    "PAID",
  )
})

test("expense transitions enforce submission approval and payment order", () => {
  assert.equal(canTransitionExpense("DRAFT", "SUBMITTED"), true)
  assert.equal(canTransitionExpense("DRAFT", "PAID"), false)
  assert.equal(canTransitionExpense("SUBMITTED", "APPROVED"), true)
  assert.equal(canTransitionExpense("APPROVED", "PAID"), true)
  assert.equal(canTransitionExpense("PAID", "CANCELLED"), false)
  assert.equal(canTransitionExpense("REJECTED", "DRAFT"), true)
})

test("document numbers are stable and padded", () => {
  assert.equal(documentNumber("INV", 2026, 1), "INV-2026-0001")
  assert.equal(documentNumber("EXP", 2026, 87), "EXP-2026-0087")
})


test("company timezone date keys are stable", () => {
  const instant = new Date("2026-07-24T21:30:00.000Z")
  assert.equal(localDateKey(instant, "Asia/Amman"), "2026-07-25")
  assert.equal(localDateKey(instant, "UTC"), "2026-07-24")
  assert.equal(
    businessDate(instant, "Asia/Amman").toISOString(),
    "2026-07-25T00:00:00.000Z",
  )
})
