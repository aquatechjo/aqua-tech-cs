# PROJ-05 — Project Risks, Issues, and Decisions

## Purpose

Add a governed execution register after the delivery baseline and Change
Request workflow. Project teams can now distinguish uncertain future risks,
current issues, and binding decisions without mixing them with task blockers or
overwriting historical records.

## One register, three contracts

`ProjectGovernanceItem` is tenant- and Project-scoped, while database checks
enforce the fields and statuses valid for each kind:

- **Risk** — probability, impact, response plan, optional contingency plan,
  trigger, owner, and review date.
- **Issue** — severity, current owner, due date, resolution, and optional source
  Risk.
- **Decision** — immutable decision text, rationale, alternatives, impact,
  deciding actor, and decision time.

Each record receives an annual company sequence:

- `RSK-YYYY-NNNN`
- `ISS-YYYY-NNNN`
- `DEC-YYYY-NNNN`

## Risk lifecycle

`OPEN → MONITORING → MITIGATED → CLOSED`

A Risk may instead move to `MATERIALIZED` by atomically creating one linked
Issue. A materialized Risk cannot create a second Issue. Closed Risks can be
reopened with durable audit evidence.

The UI derives a deterministic exposure score from probability and impact:

`LOW=1`, `MEDIUM=2`, `HIGH=3`, `CRITICAL=4`

The displayed score is the product of both values, from `1/16` through `16/16`.
This score supports prioritization but does not replace human judgment.

## Issue lifecycle

`OPEN → IN_PROGRESS → RESOLVED → CLOSED`

- Resolution requires a meaningful resolution record.
- Closing is allowed only after resolution and requires an explicit closure
  note.
- Resolved or closed Issues may be reopened with a documented reason.
- A Risk-generated Issue keeps its immutable source relation.

## Decision integrity

Recorded decisions are not edited in place. When the team changes direction,
it creates a new Decision that points to the previous one. The previous record
moves to `SUPERSEDED`; the replacement remains `RECORDED`. This preserves what
was decided, why, by whom, and which later decision replaced it.

## Scope and permissions

- Existing Project readers see the register through the already scoped Project
  execution page.
- Owner, Admin, Operations Manager, Project Lead, and Project Manager follow the
  existing Project execution-management contract for mutations.
- Risk and Issue owners must be active members of the same Project.
- Completed, cancelled, and archived Projects reject all new or updated
  governance records.
- APIs enforce same-origin requests, bounded JSON bodies, tenant ownership,
  Project membership, row locks, and serializable transactions.

## Audit behavior

Twelve Activity actions cover creation, updates, materialization, resolution,
closure, reopening, decision recording, and decision supersession. Lifecycle
notes and related record IDs remain in Activity metadata.

## Operating surface

The Project page receives one canonical Aqua Data Panel with:

- tabs for risks, issues, and decisions;
- active counts and semantic status badges;
- exposure, severity, owner, due-date, and lineage details;
- focused create/edit modals;
- explicit risk-to-issue and decision-supersession workflows;
- accessible confirmation for lifecycle changes;
- logical RTL/LTR layout, responsive cards, keyboard focus, and reduced-motion
  behavior.

## Migration behavior

- Adds three enums and one tenant-scoped governance model.
- Adds self-relations for Risk materialization and Decision supersession.
- Adds field- and lifecycle-level database checks.
- Adds twelve Activity actions.
- Does not rewrite or delete existing Projects, Tasks, blockers, Deliverables,
  Change Requests, Proposals, Invoices, or Payments.

## Out of scope

- automated risk inference or AI scoring;
- notifications and n8n dispatch;
- client-visible governance records;
- financial contingency reserves;
- delivery file versions;
- automatic Project closure and post-project review.

## Verification

Run:

```bash
npm run check
```

The gate includes Prisma generation, Design System synchronization, ESLint,
TypeScript, unit tests, and a production Next.js build.
