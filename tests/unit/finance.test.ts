import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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

const financeCss = readFileSync("src/styles/aqua-finance.css", "utf8")
const rootLayout = readFileSync("src/app/layout.tsx", "utf8")
const financePage = readFileSync("src/app/dashboard/finance/page.tsx", "utf8")
const expensesPage = readFileSync(
  "src/app/dashboard/finance/expenses/ExpensesClient.tsx",
  "utf8",
)
const invoicesPage = readFileSync(
  "src/app/dashboard/finance/invoices/InvoicesClient.tsx",
  "utf8",
)
const invoiceDetailPage = readFileSync(
  "src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx",
  "utf8",
)
const publicInvoicePage = readFileSync(
  "src/app/invoice/[token]/page.tsx",
  "utf8",
)
const invoiceDocumentPage = readFileSync(
  "src/app/invoice-document/[id]/page.tsx",
  "utf8",
)

test("UI-13 applies one Finance, invoices, and expenses visual contract", () => {
  assert.match(rootLayout, /@\/styles\/aqua-finance\.css/u)
  assert.match(financePage, /aqua-finance-page/u)
  assert.match(financePage, /aqua-finance-metrics/u)
  assert.match(expensesPage, /aqua-expenses-page/u)
  assert.match(invoicesPage, /aqua-invoices-page/u)
  assert.match(invoiceDetailPage, /aqua-invoice-detail-page/u)
  assert.match(publicInvoicePage, /aqua-client-invoice/u)
  assert.match(invoiceDocumentPage, /aqua-invoice-document/u)

  for (const contract of [
    ".aqua-finance-page",
    ".aqua-finance-actions",
    ".aqua-finance-metric",
    ".aqua-finance-editor",
    ".aqua-finance-register",
    ".aqua-client-invoice",
    "inset-inline-end",
    "min-inline-size",
    "@media (max-width: 767.98px)",
    "@media print",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.match(
      financeCss,
      new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    )
  }
})

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
  assert.equal(documentNumber("PROP", 2026, 12), "PROP-2026-0012")
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
