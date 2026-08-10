# PROJ-13 — Governed Change Financial Approval

Status: ready for application

## Outcome

Commercially impacted Change Requests now carry an explicit amount and ISO currency and must pass a separate finance decision before management can approve or apply the scope change.

## Controls

- Finance decisions are limited to Owner, Admin, and Finance Manager roles.
- A non-Owner cannot financially approve a Change Request they created.
- The decision is tenant scoped, row locked, and recorded with actor, time, reference, notes, and Activity evidence.
- Draft edits reset earlier financial evidence and return the request to a pending finance decision.
- Financial approval never updates Project budget, invoices, payments, or accounting records automatically.
- Existing pre-PROJ-13 commercial Change Requests remain readable and require a draft refresh before entering the new gate.

## Deferred

- Contract-amendment documents and signatures.
- Automatic Project budget changes.
- Invoice or payment generation.
- Notifications, WhatsApp, n8n, and automatic retries.
