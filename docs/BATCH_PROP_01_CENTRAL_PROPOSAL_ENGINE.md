# PROP-01 — Central Proposal Engine

## Outcome

PROP-01 adds the versioned proposal layer between approved pricing and future
customer delivery. Aqua Tech CS remains the source of truth for both the
complete internal proposal and the client-safe projection.

The batch does not send a proposal, record customer acceptance or rejection,
create a contract, or create a project. Those transitions remain in PROP-02
and PROJ-01.

## Operating surfaces

- `/dashboard/proposals` is the tenant-scoped queue for every Discovery journey
  with approved pricing.
- The queue shows work ready to build, in draft, under review, returned for
  changes, or approved.
- `/dashboard/discovery/[id]/proposal` is the focused authoring and review
  workspace.
- The workspace separates editing, client preview, and immutable version
  history through canonical Design System tabs and panels.
- Approved pricing links directly to the proposal workspace without silently
  creating proposal data.

## Source contract

Every proposal version stores:

- the approved Pricing version and content hash;
- the approved Discovery Report version and content hash inherited by that
  Pricing version;
- the full proposal content hash;
- a separate client-safe projection hash;
- the proposal contract version;
- author and creation timestamp.

The server derives the commercial snapshot from the currently approved Pricing
version. Browser input cannot replace or override that snapshot.

If the approved Pricing version or hash changes, the existing Proposal version
cannot enter review. An authorized user must save a new Proposal version.

## Client-safe projection

The customer projection contains:

- client-audience narrative sections only;
- client pricing lines, quantities, unit prices, and line totals;
- discount, tax, and final totals;
- payment milestones;
- client notes, validity, and estimated duration.

It excludes:

- internal-audience sections;
- unit costs and total internal cost;
- gross profit and margin;
- Pricing internal notes and item internal notes;
- raw Discovery answers, conversations, and internal notes.

The projection is generated and hashed on the server for each version.

## Authoring and review

The initial draft is seeded from the approved Discovery Report:

- executive summary;
- desired outcomes;
- recommended approach.

The author must still decide the estimated duration and payment milestones.
Payment percentages may be drafted incrementally but must total exactly 100%
before review.

State transitions:

`DRAFT → IN_REVIEW → APPROVED`

`IN_REVIEW → CHANGES_REQUESTED → DRAFT`

Rules:

- Only `DRAFT` and `CHANGES_REQUESTED` accept a new version.
- Only a saved current version can enter review.
- Review requires a duration, a positive commercial value, and payment
  milestones totaling 100%.
- Only `IN_REVIEW` can be approved or returned for changes.
- Approved content is immutable.
- A non-owner cannot approve a version they created.
- The system owner may self-approve when no higher approver exists.

## Permissions

| Capability | Roles |
| --- | --- |
| Read proposals | Owner, Admin, Sales Manager, Operations Manager, Finance Manager |
| Create versions | Owner, Admin, Sales Manager |
| Review and approve | Owner, Admin, Sales Manager |

All reads and mutations are tenant-scoped. Mutations use same-origin checks,
bounded JSON bodies, row locks, transactions, and durable activity events.

## Compatibility boundary

The legacy opportunity proposal route remains available for historical
opportunities that never entered the managed Discovery/Pricing journey.

When an opportunity has a `PricingWorkspace`, the legacy route rejects direct
proposal creation with `CENTRAL_PROPOSAL_REQUIRED`. This prevents bypassing
approved pricing, version history, client-safe projection, and human review.

## Approval side effects

Approval:

- locks the approved Proposal version;
- changes the Lead next action to proposal delivery;
- records proposal number, source versions, value, currency, and actor in the
  activity log.

Approval does not:

- create or update a legacy `SalesProposal`;
- mark the opportunity as `PROPOSAL`, won, or lost;
- send email, WhatsApp, or another channel;
- create a client-acceptance record;
- create a contract, invoice, workflow, or project.

## Verification

- Prisma generation and additive migration validation.
- Design System package synchronization.
- ESLint with zero warnings.
- TypeScript and Next route type generation.
- Unit coverage for client projection privacy, source traceability, payment
  readiness, approval separation, managed-journey bypass prevention, tenant
  scoping, row locks, and migration safety.
- Production build.
