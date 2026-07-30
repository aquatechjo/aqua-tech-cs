# PROJ-01 — Accepted Proposal to Client, Project, and Workflow

## Outcome

PROJ-01 converts one explicitly accepted central Proposal into an operational
handoff without starting delivery prematurely.

The conversion creates or safely reuses the external Client account, preserves
the accepting customer representative as a decision-maker contact, creates a
Project in `PLANNING`, and clones one active Workflow template into a
`NOT_STARTED` project Workflow.

This batch does not assign employees, schedule work, start the Workflow, create
an invoice, confirm payment readiness, or create a contract. Those readiness
gates remain independent so customer acceptance cannot silently start delivery.

## Conversion boundary

Only a Proposal workspace in `ACCEPTED` can enter PROJ-01. The conversion
requires all of the following:

- an exact sent Proposal version;
- an immutable customer response with decision `ACCEPTED`;
- explicit confirmation that the responder is authorized;
- matching sent version, response version, and stored Proposal version;
- matching sent client projection hash, response hash, and version hash;
- a fresh server-side recalculation of both the full Proposal content hash and
  the client-safe projection hash;
- an active Workflow template selected by an authorized administrator;
- explicit confirmation of the conversion action.

A rejected, stale, altered, unmatched, or incomplete Proposal is blocked with a
conflict response before any Client, Project, or Workflow mutation.

## Permissions

| Capability | Roles |
| --- | --- |
| Read accepted Proposal state | Owner, Admin, Sales Manager, Operations Manager, Finance Manager |
| Convert accepted Proposal | Owner, Admin |
| Select Workflow template during conversion | Owner, Admin |

Sales may author, approve, and deliver Proposals but cannot create the
operational Project. Operations and Finance remain read-only at the commercial
handoff until leadership completes the conversion.

## Client resolution

The conversion resolves a Client in this order:

1. reuse the Client already linked to the Opportunity, Service Request, or Lead;
2. if no Client is linked, look for active contacts matching normalized email or
   phone identities from the Opportunity and accepting responder;
3. reuse the only unique matching Client;
4. create a new Client only when no match exists.

The conversion stops instead of guessing when:

- linked source records point to different Clients;
- more than one active Client matches;
- an archived Client matches;
- a linked Client is missing or archived.

The Opportunity contact is preserved, and the accepting responder is created or
reused as a Client contact and marked as a decision maker. An existing primary
contact is not replaced silently.

## Project provenance

The Project stores:

- Proposal workspace ID;
- customer response ID;
- accepted Proposal version;
- full Proposal content hash;
- client-safe projection hash;
- customer acceptance timestamp;
- conversion timestamp.

Database checks require the provenance fields to be either entirely absent for
legacy/manual Projects or entirely present for accepted-Proposal Projects.
Unique indexes allow only one Project per Proposal workspace and response.
Foreign keys with restricted deletion preserve the Proposal and response
records behind the Project.

The conversion is transactionally locked on both the Opportunity and Proposal
workspace. Replaying the same successful request returns the existing Project
only when every provenance value still matches.

## Project and Workflow state

The created Project starts with:

- status `PLANNING`;
- the accepted Proposal total and currency as the Project budget snapshot;
- an internal description derived only from client-visible summary, objectives,
  and approach sections;
- no start date or due date;
- no project member or leader assignment.

The selected Workflow is cloned as an independent versioned snapshot with:

- status `NOT_STARTED`;
- planned phases with no dates;
- template tasks in `TODO`;
- no assignees or participants;
- no task due dates;
- preserved dependencies, approval definitions, role expectations, and event
  rules.

The Workflow snapshot is visible from the Project execution page, which also
identifies the Project as originating from an accepted Proposal.

## Pipeline effects

After successful conversion:

- the Client is active;
- the Lead and Service Request are linked and marked converted when present;
- the Opportunity is linked to the Client and Project;
- the Opportunity value and currency match the accepted Proposal;
- the Opportunity moves to `WON`;
- the central Proposal remains `ACCEPTED`;
- durable Client, contact, Project, win, Proposal-conversion, and
  Opportunity-conversion activity records are written.

No delivery task is assigned and no readiness gate is bypassed.

## Operating surfaces

- `/dashboard/proposals` marks converted Proposals and opens their Projects.
- `/dashboard/discovery/[id]/proposal` lets Owner or Admin choose the Project
  name and active Workflow template, then uses the canonical confirmation
  dialog.
- `/dashboard/projects/[id]` shows the Proposal provenance and the
  not-started Workflow snapshot.

All UI additions remain inside the canonical application shell and use the
existing Aqua data-panel, alert, badge, input, select, button, detail-list, and
confirmation patterns.

## Deferred readiness

PROJ-01 deliberately leaves these operations for subsequent governed batches:

- contract preparation and signature state;
- required deposit or payment-readiness confirmation;
- administrative readiness override with a reason and audit record;
- Project start date and delivery schedule;
- Project lead, members, task owners, and participants;
- Workflow activation, notifications, and n8n dispatch;
- invoice generation and delivery reporting.

## Verification

- Prisma generation and additive migration validation.
- Design System package synchronization.
- ESLint with zero warnings.
- TypeScript and Next route type generation.
- Unit coverage for accepted state, version and hash binding, responder
  authority, ambiguous Client prevention, immutable provenance, permissions,
  row locks, replay safety, no automatic schedule or ownership, activity
  records, and canonical UI behavior.
- Production build.
