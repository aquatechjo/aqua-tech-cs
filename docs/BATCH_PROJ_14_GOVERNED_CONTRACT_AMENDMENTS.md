# PROJ-14 — Governed Contract Amendments

Status: ready for application

## Outcome

Commercial Change Requests can now produce one governed contract amendment after management and finance approval. The amendment freezes the approved scope, schedule impact, amount, currency, and commercial reference before it enters review.

## Lifecycle

- Draft.
- Ready for review.
- Internally approved.
- Sent to the client.
- Accepted or rejected by the client.

## Controls

- Only approved, financially approved commercial Change Requests can create an amendment.
- One amendment is allowed per Change Request.
- Non-Owners cannot internally approve an amendment they created.
- Every transition is tenant scoped, row locked, evidence backed, and written to Activity.
- Commercial Change Requests cannot be applied until the client acceptance is recorded.
- Frozen amendment values do not update Project budget or create invoices.

## Deferred

- Budget revision after client acceptance.
- Invoice creation from an accepted amendment.
- External amendment delivery links, signatures, notifications, and retries.
