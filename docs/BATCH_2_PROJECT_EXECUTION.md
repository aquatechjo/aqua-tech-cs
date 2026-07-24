# Batch 2 — Project Execution

Batch 2 upgrades AquaFlow from basic projects and single-assignee tasks to a
structured delivery workspace for project teams, phases, dependencies,
blockers, progress, and personal work planning.

## Included

- Added project members with four execution roles:
  `PROJECT_LEAD`, `MANAGER`, `CONTRIBUTOR`, and `VIEWER`.
- Added ordered project phases with status, progress, dates, and optional code.
- Added task progress and start time while preserving the existing primary
  assignee for compatibility.
- Added multiple task participants with owner, contributor, reviewer, and
  observer responsibilities.
- Added four dependency types and cycle prevention before a dependency is
  saved.
- Added task blockers with severity, lifecycle, reporter, resolver, and
  resolution details.
- Added automatic task blocking when an open blocker is created and automatic
  return to `IN_PROGRESS` when the final open blocker is resolved.
- Added a project execution page at `/dashboard/projects/[id]`.
- Added a personal `/dashboard/my-day` page and `/api/tasks/my-day` endpoint.
- Added tenant-scoped APIs, same-origin checks, bounded JSON validation, and
  activity logging for every execution mutation.
- Added migration backfill so existing assignees become task owners and project
  contributors.
- Added unit tests for progress, phase codes, due-date buckets, and dependency
  cycles.

## Compatibility decisions

The original `Task.assignedToId` field remains in place. It is synchronized
with the participant whose role is `OWNER`. Existing screens and integrations
can therefore continue using the primary assignee while the execution page can
manage multiple participants.

Tasks may remain outside a phase. This is intentional so existing tasks do not
need a fabricated phase and can be classified gradually.

## Execution permissions

- `OWNER`, `ADMIN`, and `OPERATIONS_MANAGER` can manage all project execution.
- A project member with `PROJECT_LEAD` or `MANAGER` can manage that project's
  execution and phases. Only global project management or the current project
  lead can assign leadership roles; the active lead must be replaced rather
  than removed directly.
- Task managers, project leadership, the primary assignee, the creator, and
  active execution participants can update task work. `OBSERVER` participants
  are read-only.
- Participant management is limited to task ownership and project management;
  changing the primary `OWNER` requires project-management authority.
- Parent resources and employee records are tenant-scoped before nested or
  compound-key mutations are performed, preventing cross-tenant access.

## Dependency safety

- A task cannot depend on itself.
- Dependencies are limited to tasks in the same project.
- A task with dependencies cannot be moved to another project until those
  dependency links are removed.
- The API checks the existing dependency graph before saving and rejects any
  edge that would create a cycle.
- A database check also rejects direct self-references.

## Blocker behavior

- Creating a blocker changes an active task status to `BLOCKED`; closed,
  cancelled, and archived tasks reject new blockers.
- Resolving a blocker requires a written resolution.
- When the last open blocker is resolved, a blocked task returns to
  `IN_PROGRESS`.
- A task blocker does not automatically place the whole project on hold.

## Application order

1. Start from the clean Batch 1 commit `ea755b0`.
2. Extract the Batch 2 ZIP over the AquaFlow project root.
3. Run `npm install`.
4. Run `npm run db:deploy`.
5. Run `npm run check`.
6. Test `/dashboard/projects`, a project execution page, and
   `/dashboard/my-day` locally.
7. Commit locally. Do not push until all planned AquaFlow batches are complete.

Do not edit the Batch 0 or Batch 1 migrations. Batch 2 is an additional
forward-only migration.
