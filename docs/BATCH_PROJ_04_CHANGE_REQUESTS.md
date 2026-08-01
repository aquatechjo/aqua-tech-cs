# PROJ-04 — Change Requests and Scope Control

## Purpose

Protect the accepted delivery baseline after PROJ-03. Contractual and governed
scope may no longer be changed through ordinary deliverable editing. Every
addition, modification, or cancellation now moves through a reviewable Change
Request with immutable target snapshots, approval evidence, and one atomic
application transaction.

## Request lifecycle

`DRAFT → IN_REVIEW → APPROVED → APPLIED`

Controlled alternatives:

- `IN_REVIEW → CHANGES_REQUESTED → DRAFT` after the author revises the request;
- `IN_REVIEW → REJECTED` with a reason;
- `DRAFT`, `CHANGES_REQUESTED`, or `IN_REVIEW → CANCELLED` with a reason;
- `REJECTED`, `APPLIED`, and `CANCELLED` are terminal in this batch.

A Project Lead or Project Manager may author, revise, submit, and apply a
request. Approval is separated from authoring and is limited to Owner, Admin,
or Operations Manager. Admin and Operations Manager cannot approve a request
they created; the Owner retains an explicit small-company override.

## Change items

One request may contain up to fifty ordered items:

- `ADD_DELIVERABLE` creates a new `ProjectDeliverable` with source
  `CHANGE_REQUEST` and a deterministic source reference;
- `MODIFY_DELIVERABLE` changes the approved after-state of a non-terminal
  deliverable;
- `CANCEL_DELIVERABLE` closes a non-terminal deliverable with a documented
  reason.

Every targeted deliverable stores its `updatedAt` snapshot when the request is
saved. Application re-locks the target and compares that snapshot. If the
record changed after the request was prepared, the entire transaction stops and
the request must be returned to draft. This prevents a stale approval from
overwriting newer work.

## Scope integrity

- Proposal-derived and Change-Request-derived details remain immutable in the
  ordinary deliverable API, including title, description, acceptance criteria,
  phase, due date, and ordering.
- Governed deliverables cannot be cancelled through the ordinary status route;
  cancellation must be an approved Change Request item.
- Manual planned deliverables keep their existing operational editing rules,
  unless a Change Request already references them.
- Applied Change Request items store the resulting deliverable relation.
- The request number uses the shared annual document sequence as
  `CR-YYYY-NNNN`.
- A request cannot target an accepted or cancelled deliverable.
- Target deliverables and phases are protected from deletion while referenced
  by a Change Request.
- A project that is completed, cancelled, or archived rejects new requests,
  draft edits, and application.

## Review evidence

Each request records:

- business reason;
- schedule impact in signed days;
- commercial impact state: none, requires quotation, or approved;
- commercial quotation or amendment reference when approved;
- whether client approval is required;
- durable client approval reference before approval;
- reviewer, review notes, timestamps, and applying actor.

The batch intentionally records commercial impact without automatically
changing Project budget, contracts, invoices, or payment schedules. Those
mutations require a later commercial-amendment and milestone-billing workflow.

## Application transaction

Application runs under a serializable transaction and row locks:

1. lock the Change Request;
2. recheck Project state and request status;
3. lock and validate every targeted deliverable;
4. reject stale or terminal targets;
5. create, modify, or cancel all deliverables, resetting modified work to a
   fresh execution/review state;
6. connect each item to its result;
7. mark the request `APPLIED`;
8. write request-level and deliverable-level Activity records.

Any failure rolls back every item, so partial scope application is impossible.

## Operating surface

The Project execution page gains a canonical Aqua panel that provides:

- request cards, statuses, impact summary, author, reviewer, and result links;
- a responsive multi-item draft editor;
- separate submit, review, approval, rejection, cancellation, and application
  actions;
- client approval and commercial references;
- Arabic-first responsive behavior with logical CSS and reduced-motion support.

## Migration behavior

- Adds three enums, two tenant-scoped models, relations, indexes, and database
  checks.
- Adds `CHANGE_REQUEST` to `ProjectDeliverableSource`.
- Adds eight durable Activity actions.
- Does not rewrite, delete, or backfill existing Projects, Deliverables,
  Proposals, Tasks, Invoices, or Payments.

## Out of scope

- contract amendment documents and signatures;
- automatic Project budget mutation;
- invoice or payment milestone generation;
- public client approval links;
- delivery file versions and proof uploads;
- project risks and issues register;
- notifications and n8n dispatch;
- automatic phase progression;
- project closure, feedback, and follow-up.

## Verification

Run:

```bash
npm run check
```

The gate includes Prisma generation, Design System synchronization, ESLint,
TypeScript, unit tests, and a production Next.js build.
