# PROJ-STATE-01 — Project State Machine Expansion

## Purpose

Extend `ProjectStatus` with three states the original Business Operating
Architecture gap audit flagged as missing: `AT_RISK`, `IN_REVIEW`,
`READY_FOR_DELIVERY`. The target architecture's full proposal also
included `REVISION` and `CLOSED` — those are deliberately **not** added
in this batch (see below).

## Why only three of the five proposed states

- **`REVISION`** would overlap in meaning with the existing
  `ProjectChangeRequest` model, which already governs client-requested
  scope changes with its own lifecycle. Adding a project-level `REVISION`
  status risks two competing ideas of "the client asked for changes" —
  one on the project record, one on the change-request record — without
  a clear rule for which wins. That needs its own design decision, not a
  side effect of this batch.
- **`CLOSED`** would overlap with the existing `ARCHIVED` status, which
  already has real behavior around it in this codebase (an audit trail
  distinguishes `PROJECT_ARCHIVED` from `PROJECT_RESTORED`, and archived
  projects are excluded from the "active" counts touched below).
  Introducing a second terminal-ish state needs to first answer "what is
  the difference from `ARCHIVED`, and can you restore from it the same
  way" — again a product decision, not something to bundle in here.

`AT_RISK`, `IN_REVIEW`, and `READY_FOR_DELIVERY` had no such conflict —
each describes something the existing model has no way to say at all.

## What changed — the schema

Added the three values to `ProjectStatus`. Nothing existing was renamed,
reordered, or removed.

## What this batch does **not** do: gate the new transitions

This batch makes the new states valid and visible everywhere the
existing ones are — it does **not** add new business rules about when a
project is _allowed_ to enter `AT_RISK` / `IN_REVIEW` /
`READY_FOR_DELIVERY` beyond the one rule already reused from the
existing states (see below). Deciding, for example, whether
`READY_FOR_DELIVERY` should require every deliverable to be `ACCEPTED`
first is a real product/process decision that deserves its own scoped
follow-up, not something to guess at while doing a schema-and-plumbing
pass.

## What this batch does do: wire the new states into every place status already mattered

An audit across ~30 files that reference `ProjectStatus` found these
specific places needed updating, and updated all of them:

- **`src/app/api/projects/[id]/route.ts`** — the zod schema now accepts
  the three new values, and — this is the one rule that _was_ reused, not
  invented — the existing readiness-activation gate (you cannot jump
  straight from `PLANNING` into `IN_PROGRESS` / `ON_HOLD` / `COMPLETED`
  without passing the readiness checklist first) now also covers
  `AT_RISK`, `IN_REVIEW`, and `READY_FOR_DELIVERY`. A project cannot reach
  any of the new states directly from `PLANNING` any more than it could
  reach `IN_PROGRESS` that way.
- **`src/lib/project-workflow-server.ts`** — `projectStatusToWorkflowStatus`
  explicitly maps all three new states to the internal `ACTIVE` workflow
  status (work is genuinely still active during all three), rather than
  falling through to its `NOT_STARTED` default, which would have been
  wrong.
- **`src/app/dashboard/projects/page.tsx`** — **the audit's most concrete
  finding**: `activeProjectStatuses`, the array driving the "active
  projects" and "overdue active projects" summary counts on the projects
  list page, was hardcoded to `["PLANNING", "IN_PROGRESS", "ON_HOLD"]`. A
  project flagged `AT_RISK` would have silently vanished from both counts
  the moment someone used the new status — arguably the single case a
  status called "at risk" most needs to keep showing up in an active-work
  count. Fixed by including the three new states.
- **`src/app/dashboard/page.tsx`** — the same class of bug on the main
  dashboard's own "active projects" count, which was scoped to
  `status: "IN_PROGRESS"` alone. Same fix, same reasoning.
- **`src/app/dashboard/projects/ProjectsClient.tsx`** — the
  `projectStatuses` array (drives the filter dropdown and the edit
  modal's status options), the `projectStatusLabel` map (Arabic labels;
  this one is `satisfies Record<ProjectStatus, string>`, so TypeScript
  itself would have refused to compile without adding these — a real
  safety net that caught this automatically), and `statusVariant` (badge
  colors: `AT_RISK` → danger/red, `IN_REVIEW` → warning/amber,
  `READY_FOR_DELIVERY` → aqua).
- **`src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx`** — the
  same two label/color maps, matched to this file's own (non-exhaustive,
  string-keyed) style.

## Deliberately unchanged / out of scope

- No UI button to _set_ a project to one of the new states beyond the
  existing generic status dropdown on the projects list page (the same
  dropdown that already handles `ON_HOLD` / `COMPLETED` / etc. today) —
  no dedicated "flag as at risk" quick action was added.
- No automatic detection of "at risk" (e.g., auto-flagging a project
  whose due date has passed with open blockers). This batch only adds
  the state as something a person can set; automatic detection is a
  substantially different, separate feature.
- No new transition-gating rules beyond reusing the existing
  readiness-activation gate — see above.

## Migration

Adds three enum values only — no new columns, no backfill, no existing
row is affected until someone manually sets a project to one of the new
statuses. Run locally before merging:

```
npx prisma migrate dev --name proj_state_01_expand_project_status
```

## Quality gates

- `npm run check` was not run in this environment — run it locally.
- `tests/unit/project-status-expansion.test.ts` was written and then
  **verified by hand against the actual file contents** (not just
  written and assumed correct) before this batch was packaged, given
  today's earlier lesson about assertions that looked right but didn't
  actually match after a formatter touched the file.

## Next batch candidates

- Decide and design `REVISION` vs. the existing `ProjectChangeRequest`
  model, and `CLOSED` vs. the existing `ARCHIVED` semantics — both need a
  product decision before an engineering one.
- Formal transition rules for the three states added here (e.g., should
  `READY_FOR_DELIVERY` require every deliverable `ACCEPTED`?).
- A dedicated "flag as at risk" UI action, if the generic status dropdown
  proves too buried for how often this needs to happen in practice.
