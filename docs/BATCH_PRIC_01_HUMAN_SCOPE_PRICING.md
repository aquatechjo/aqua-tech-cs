# PRIC-01 — Human Scope and Pricing

## Outcome

PRIC-01 adds the controlled commercial step between an approved Discovery
Report and the future central Proposal Engine.

The approved Discovery Report remains the scope source. The team converts that
scope into a manual pricing version, reviews it, and explicitly approves it.
Approval prepares the opportunity for proposal creation but does not create or
send a proposal.

## Operating surfaces

- `/dashboard/pricing` is the tenant-scoped central queue for every completed
  Discovery session with an approved report.
- The queue shows work that is ready to start, in draft, under review, returned
  for changes, or approved.
- Search covers the customer, service, and linked opportunity while status
  filtering and pagination stay server-side.
- `/dashboard/discovery/[id]/pricing` is the focused workspace for versions,
  calculations, review notes, and approval.
- Finance reviewers can reach pricing directly without receiving access to raw
  Discovery answers or internal Discovery report editing.

## State machine

`DRAFT → IN_REVIEW → APPROVED`

`IN_REVIEW → CHANGES_REQUESTED → DRAFT`

Rules:

- Only `DRAFT` and `CHANGES_REQUESTED` workspaces accept a new version.
- Only a saved current version can enter review.
- Only `IN_REVIEW` can be approved or returned for changes.
- Approved pricing is immutable.
- A non-owner cannot approve a version they created.
- The system owner may self-approve when no higher approver exists.

## Version contract

Every saved version preserves:

- Approved Discovery Report version and content hash.
- Pricing contract version.
- Currency.
- Service, deliverable, phase, and optional lines.
- Client or internal audience for every line.
- Quantity, client unit price, and internal unit cost.
- Client notes and internal notes.
- Discount and tax method and value.
- Server-calculated totals, profit, and margin.
- Creator and creation timestamp.

The server rejects review when the saved version no longer points to the
currently approved Discovery Report version.

## Financial rules

- Client subtotal includes `CLIENT` lines only.
- Internal cost includes the cost of every line.
- `INTERNAL` lines never add client revenue.
- Discount applies to client subtotal.
- Percentage tax applies after discount.
- Fixed tax is added as entered.
- Tax does not increase gross profit or margin.
- Discount cannot exceed client subtotal.
- No tax percentage is assumed by the system.
- Approval requires positive client value.

## Permissions

| Capability | Roles |
| --- | --- |
| Read pricing | Owner, Admin, Sales Manager, Operations Manager, Finance Manager |
| Create versions | Owner, Admin, Sales Manager, Finance Manager |
| Review and approve | Owner, Admin, Finance Manager |

All reads and mutations remain tenant-scoped. Mutations use same-origin checks,
bounded JSON bodies, row locks, transactions, and durable activity events.

## Approval side effects

Approval:

- locks the approved pricing version;
- updates the linked opportunity amount and currency when an opportunity exists;
- changes the Lead next action to central proposal creation;
- records the approved amount, profit, margin, source report, and actor in the
  activity log.

Approval does not:

- create a `SalesProposal`;
- expose internal lines, costs, profit, margin, or notes;
- send email, WhatsApp, or another channel;
- mark the opportunity as won;
- create a project.

Those operations remain in PROP-01, PROP-02, and PROJ-01.

## Verification

- Prisma generation and migration validation.
- Design System package synchronization.
- ESLint with zero warnings.
- TypeScript and Next route type generation.
- Unit coverage for decimal totals, visibility separation, adjustments,
  discount limits, initial scope seeding, approval separation, central-queue
  access, tenant scoping, and safe version parsing.
- Production build.
