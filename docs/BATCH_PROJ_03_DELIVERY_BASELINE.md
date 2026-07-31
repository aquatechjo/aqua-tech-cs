# PROJ-03 — Delivery Baseline and Deliverables

## Purpose

Create a governed delivery baseline between project activation and day-to-day
execution. The batch makes the outputs promised in an accepted Proposal visible,
traceable, reviewable, and auditable inside the Project instead of leaving them
inside narrative text or commercial line items.

## Accepted-Proposal baseline

- Every client-visible Pricing item with kind `DELIVERABLE` is copied into the
  converted Project as an independent `ProjectDeliverable`.
- The copy preserves a deterministic source reference containing the Proposal
  workspace, accepted version, and commercial item ID.
- Replayed conversions use the unique source reference and `skipDuplicates` so
  the same accepted scope cannot create duplicate deliverables.
- Existing accepted-Proposal Projects are backfilled from the exact immutable
  Proposal version recorded on the Project.
- Service, phase, option, internal, cost, profit, margin, and internal-note data
  are not copied into the deliverable register.

## Scope integrity

Proposal-derived deliverable titles and descriptions are immutable in this
batch. Project managers may assign a phase, due date, ordering, and explicit
acceptance criteria, but changing the contractual title or description is
blocked. A later Change Request batch will govern scope modification.

Manual deliverables may be added for operational outputs that are not part of
the accepted commercial scope. A manual deliverable may be deleted only while
it is still `PLANNED`. Proposal-derived deliverables are never deleted through
the operational API.

## Delivery state machine

`PLANNED → IN_PROGRESS → READY_FOR_REVIEW → ACCEPTED`

Controlled alternatives:

- `READY_FOR_REVIEW → CHANGES_REQUESTED → IN_PROGRESS`
- active work may return to `PLANNED` when it has not reached a decision;
- `PLANNED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, or `CHANGES_REQUESTED` may move
  to `CANCELLED` with a meaningful reason;
- `ACCEPTED` and `CANCELLED` are terminal in this batch.

Moving beyond planning requires an activated Project. This is enforced in the
API and database workflow rather than only through disabled controls.

## Review and acceptance evidence

- `READY_FOR_REVIEW` records the first submission timestamp.
- `CHANGES_REQUESTED` requires a meaningful review note and decision actor.
- `ACCEPTED` requires a durable external acceptance reference such as an email,
  signed handover, or meeting minutes reference.
- `CANCELLED` requires a reason and decision actor.
- Every create, detail update, status transition, and permitted removal writes a
  tenant-scoped Activity record.

This batch records acceptance evidence but does not expose a new public client
portal. Client-facing review links and document/file proof remain separate
future work.

## Permissions

| Capability | Allowed scope |
|---|---|
| View deliverables | existing scoped Project readers |
| Create or edit planning details | Project execution managers |
| Start work, submit, request changes, accept, or cancel | Project execution managers after activation |
| Delete a manual planned deliverable | Project execution managers |

Project execution managers remain Owner, Admin, Operations Manager, Project
Lead, or Project Manager according to the existing RBAC + Project scope rules.

## Operating surface

The Project execution page gains a canonical Aqua Data Panel that shows:

- accepted-Proposal versus manual origin;
- delivery state;
- phase and due date;
- description and acceptance criteria;
- review decision, actor, date, and acceptance reference;
- governed actions and responsive modals.

The panel supports planning before activation while clearly blocking execution
transitions until the Project Readiness Gate has activated the Project.

## Migration behavior

- Adds new status and source enums, the `ProjectDeliverable` model, relations,
  indexes, checks, and Activity actions.
- Backfills only explicit `DELIVERABLE` items from the Project's accepted
  Proposal version.
- Uses deterministic IDs and source references for replay safety.
- Does not drop, delete, or rewrite existing Project, Proposal, Workflow, Task,
  Invoice, or Payment records.

## Out of scope

- file uploads and versioned delivery evidence;
- public client review links;
- risks and issues register;
- Change Requests and commercial impact approval;
- automatic phase completion or opening the next phase;
- notification delivery and n8n dispatch;
- invoice generation from Proposal payment milestones;
- project closure, feedback, and follow-up.

## Verification

Run:

```bash
npm run check
```

The gate includes Prisma generation, Design System synchronization, ESLint,
TypeScript, unit tests, and a production Next.js build.
