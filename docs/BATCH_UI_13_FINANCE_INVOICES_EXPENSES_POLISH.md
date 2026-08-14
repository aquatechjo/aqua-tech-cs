# UI-13 — Finance, Invoices, and Expenses Polish

Status: **implemented**

## Goal

Give operational finance one compact desktop-first visual contract while leaving all governed monetary transitions intact.

## Scope

- Finance overview and project profitability.
- Invoice register and invoice creation.
- Expense register and approval workflow.
- Invoice details, issue actions, collections, and payment history.
- Amendment invoice delivery and secure client portal.
- Authenticated and public invoice documents.

## Visual contract

- Compact 88px financial metrics with logical accent edges.
- Unified navigation and split action rows.
- Consistent editor, register, card, and table containment.
- Clear amount summaries, collection forms, and payment records.
- Print-safe invoice document polish.
- Logical properties, responsive wrapping, and reduced-motion coverage.

## Preserved behavior

- Scaled-decimal totals, discounts, taxes, balances, and currency handling.
- Draft, issuance, cancellation, overdue, payment, and reversal states.
- Expense submission, approval, rejection, payment, reopening, and cancellation.
- Amendment invoice evidence, delivery, portal issuance, rotation, and revocation.
- Tenant scope, permissions, routes, APIs, and audit evidence.

## Quality gate

- Design System synchronization check.
- Lint, typecheck, unit and closure suites.
- Production build.
- UI-13 contract assertions in the existing Finance unit test.
