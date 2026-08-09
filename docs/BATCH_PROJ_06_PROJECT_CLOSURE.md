# PROJ-06 — Project Closure & Post-Project Review

## Purpose

Close delivery projects through an evidence-backed review instead of a direct status change. The batch adds one tenant-scoped closure record per Project and preserves preparation, review, completion, and archive history.

## Closure gate

Before submission or completion the server counts incomplete Deliverables, active Change Requests, open Risks, unresolved Issues, and incomplete Tasks. A project with remaining work is blocked unless the manager records an explicit exception reason. The exception is stored with the closure and included in Activity metadata.

## Lifecycle

`DRAFT → READY_FOR_REVIEW → COMPLETED → ARCHIVED`

- Drafts capture outcome, summary, lessons, follow-up, and evidence references.
- Review requires a meaningful summary and lessons learned, client handover evidence, an internal archive reference, and an outcome.
- Completion records the approving actor and atomically moves the Project to `COMPLETED`.
- Archive is available only after completion and atomically moves both records to their archived states.

## Audit and safety

All mutations are same-origin, authenticated, bounded, tenant-scoped, role-scoped, row-locked, and serializable. Four Activity actions preserve draft update, review submission, completion, and archive events. Database checks protect evidence and timestamps independently of the UI.

## Operating surface

The Project execution page now shows the closure gate, blocker counts, post-project review fields, handover and archive references, exception evidence, and lifecycle actions using the canonical Aqua Data Panel.

## Out of scope

- client surveys and NPS;
- automated follow-up Tasks or n8n dispatch;
- file upload/version storage;
- reopening completed or archived Projects;
- financial final-account reconciliation.

## Verification

Run `npm run check`, deploy migrations with `npm run db:deploy`, and confirm `npx prisma migrate status` reports the database up to date.
