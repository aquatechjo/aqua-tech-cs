# PROJ-02 — Project Readiness Gate

## Purpose

Prevent project delivery from starting until the commercial and operational
readiness conditions are explicitly verified. This batch turns the accepted
Proposal conversion from a planning record into a governed start decision.

## Readiness contract

- Every Project has exactly one tenant-scoped `ProjectReadiness` record.
- Projects created from accepted Proposals require both a signed contract and
  a positive required payment amount.
- Manual Projects begin in `PLANNING`; administrators decide which commercial
  gates apply before activation.
- The paid amount is calculated from `POSTED` Payments on Invoices linked to
  the same Project, Company, and currency.
- Contract status requires a reference, signing date, verification actor, and
  verification timestamp.
- Only Owner and Admin may grant or revoke an override, and every override
  requires a meaningful reason.
- An override bypasses contract and payment gates only. It cannot bypass a
  missing Workflow or invalid Project/Workflow state.
- Activation is explicit, row-locked, transactionally rechecked, and replay
  safe.

## Activation result

Activation performs one governed start:

- Project: `PLANNING` → `IN_PROGRESS`
- Workflow: `NOT_STARTED` → `ACTIVE`
- first Workflow phase: `ACTIVE`
- later Workflow phases: `PLANNED`
- Workflow tasks: `TODO`
- phase and task dates: derived from the immutable Workflow snapshot and the
  selected start date
- Project lead: the explicitly selected active employee
- activity and Workflow event: durable `PROJECT_STARTED` records

No task owner, participant, or broader delivery team is assigned
automatically.

## Server-side enforcement

Before activation, the API blocks execution mutations that would otherwise
bypass a disabled interface:

- Project member assignment
- task owner or participant assignment
- active task or phase status
- progress updates
- blockers

Planning-only phase and task arrangement remains available.

## Permissions

| Action | Allowed roles |
|---|---|
| View readiness | existing scoped Project readers |
| Verify contract | Owner, Admin, Operations Manager |
| Configure required payment | Owner, Admin, Finance Manager |
| Grant or revoke override | Owner, Admin |
| Activate Project | Owner, Admin, Operations Manager |
| View exact payment values | finance-read roles |

## Migration behavior

- Adds the new readiness model, actor relations, constraints, indexes, and
  activity actions.
- Backfills accepted-Proposal planning Projects with both commercial gates.
- Backfills manual planning Projects without assuming commercial gates.
- Marks existing non-planning Projects as already activated so current
  delivery work is not interrupted.
- Does not drop or delete existing records.

## Out of scope

- contract file storage or e-signature
- automatic invoice generation
- kickoff minutes
- broad team staffing
- deliverables, risks, and change requests
- email, WhatsApp, notifications, and n8n dispatch

## Verification

Run:

```bash
npm run check
```

The gate includes Prisma generation, Design System synchronization, ESLint,
TypeScript, unit tests, and a production Next.js build.
