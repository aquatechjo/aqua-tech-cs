# PROJ-07 — Client Feedback & Governed Follow-up

## Purpose

Extend governed project closure with one tenant-scoped feedback record. The record preserves customer satisfaction, NPS, improvement evidence, testimonial publication consent, and accountable follow-up without turning an informal comment into an unaudited promise.

## Contract

- Feedback is accepted only after the PROJ-06 closure reaches `COMPLETED` or `ARCHIVED`.
- NPS is restricted to `0..10`; satisfaction is restricted to `1..5`.
- Low scores (`NPS <= 6` or satisfaction `<= 2`) automatically require action.
- Any explicit follow-up requires an action, active Project member owner, and due date.
- A testimonial is never marked publishable without both text and explicit recorded consent.
- Resolution and waiver require a durable note and actor timestamp.
- All writes are same-origin, tenant-scoped, role-scoped, row-locked, serializable, and logged.

## Lifecycle

`PENDING → RECEIVED | ACTION_REQUIRED → RESOLVED`

`PENDING | RECEIVED | ACTION_REQUIRED → WAIVED` is reserved for a documented management decision.

## Operating surface

The Project execution page adds a feedback panel after closure. It records scores, customer notes, internal improvements, testimonial consent, and an owned follow-up. Completed and archived projects remain read-only except for this governed post-project record.

## Out of scope

- public survey links and anonymous submissions;
- automated email, WhatsApp, notification, or n8n delivery;
- automatic Task creation;
- testimonial publishing;
- aggregate customer-success dashboards.

## Verification

Run `npm run check`, deploy with `npm run db:deploy`, and confirm `npx prisma migrate status` is up to date.
