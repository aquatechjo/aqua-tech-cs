# Batch 3 — Operational Finance

Batch 3 adds internal financial operations for Aqua Tech. It is designed for
project control and cash visibility, not as a replacement for statutory
accounting, tax filing, or a general ledger.

## Included

- Added tenant-scoped invoices, invoice items, posted payments, reversals,
  expenses, and document sequences.
- Added race-safe yearly document numbers such as `INV-2026-0001` and
  `EXP-2026-0001`.
- Added server-side invoice calculations with two-decimal validation. Client
  previews are informational; persisted totals are always recalculated on the
  server.
- Added invoice lifecycle: draft, issued, partially paid, paid, and cancelled.
  Overdue is derived from due date and outstanding balance instead of requiring
  a cron mutation.
- Locked invoice links, currency, items, discount, tax, and totals after issue.
  Notes, terms, and due dates remain operationally editable.
- Prevented overpayment. Payments can be reversed with a required reason but
  are never silently deleted.
- Added expense lifecycle: draft, submitted, approved, rejected, paid, and
  cancelled.
- Added finance dashboard, invoice list and detail pages, payment management,
  expense workflow, and project margin summaries.
- Added finance activity actions and unit tests for money calculations,
  invoice status, overdue derivation, document numbering, expense transitions,
  and finance permissions.

## Permissions

- `OWNER`, `ADMIN`, `FINANCE_MANAGER`, and `OPERATIONS_MANAGER` can view the
  operational finance module.
- `OWNER`, `ADMIN`, and `FINANCE_MANAGER` can create and issue invoices,
  record or reverse payments, and approve or pay expenses.
- `OPERATIONS_MANAGER` can create and submit project expenses but cannot
  approve them or mutate invoices.
- `SALES_MANAGER` and `MEMBER` do not receive company-wide finance access.

## Financial controls

- Invoice and expense references are validated within the authenticated
  company before mutation.
- A payment must be positive and cannot exceed the invoice outstanding amount.
- A paid invoice cannot be cancelled. An invoice with posted payments requires
  payment reversal before cancellation.
- Reversal preserves the original payment, actor, timestamp, and reason.
- Expense approval and payment require the finance-management permission.
- Except for `OWNER`, an expense creator cannot approve their own expense.
- Creators can cancel only draft or rejected expenses; cancelling later workflow
  states requires finance-management permission.
- Operational totals use the company currency only, preventing invalid aggregation
  across different currencies. Linked projects must use the same currency.
- Approved and paid expenses feed projected margins; only paid expenses reduce
  cash margin. Drafts and rejected costs do not.

## Margin definitions

- **Cash margin:** collected invoice payments minus paid expenses.
- **Projected margin:** issued invoice totals minus approved or paid expenses.
- These values are operational indicators and do not include accruals,
  depreciation, payroll allocation, tax settlement, or journal adjustments.

## Application order

1. Start from the clean Batch 2 commit `4d55df8`.
2. Extract the Batch 3 ZIP over the AquaFlow project root.
3. Run `npm install`.
4. Run `npm run db:deploy`.
5. Run `npm run check`.
6. Test `/dashboard/finance`, invoice issue and payment reversal, and expense
   approval locally.
7. Commit locally. Do not push until all planned AquaFlow batches are complete.

Do not edit migrations from Batches 0–2. Batch 3 is an additional forward-only
migration.
