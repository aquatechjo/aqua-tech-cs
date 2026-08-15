# PROJ-26 — Invoice Collection Follow-up

## Goal

Turn the aging report into an accountable collection workflow with a clear owner and next action for every open invoice.

## Workflow

- Finance assigns any active company user as collection owner.
- Statuses: new, contacted, promised, disputed, escalated, and closed.
- Every open status requires a next action and date.
- Promised status additionally requires a payment promise date.
- Notes and the full before/after update are preserved through Activity events.

## Automation boundaries

- Full payment closes collection follow-up and clears future action dates.
- Reversing a payment that reopens the invoice resets collection to new and creates an immediate review action.
- Reminder delivery and scheduling remain governed by PROJ-22 and PROJ-23 rather than being triggered implicitly by a status edit.

## Security

- Finance-management authority and same-origin enforcement.
- Tenant-scoped invoice row lock and active same-company owner validation.
- No deletion endpoint for collection history.
