# PROJ-25 — Receivables Aging and Collections View

## Goal

Give Finance an operational view of unpaid invoice balances by age without persisting derived aging values that become stale over time.

## Buckets

- Not yet due.
- 1–30 days overdue.
- 31–60 days overdue.
- 61–90 days overdue.
- More than 90 days overdue.
- Missing due date, surfaced separately rather than hidden in the current bucket.

## Controls

- Finance read authorization and tenant-scoped queries.
- Only `ISSUED` and `PARTIALLY_PAID` invoices contribute.
- Outstanding amount is total minus posted payment state.
- Aggregates remain separated by invoice currency.
- Detail output is bounded to 100 oldest-due invoices per selected view.
- Reminder scheduling state and successful reminder count are visible for collection follow-up.

## Deferred

- Legal accounting-ledger exports.
- Exchange-rate conversion or a synthetic base-currency total.
- Online payment collection and external BI connectors.
