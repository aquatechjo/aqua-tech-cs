# AD-02 — My Day Adoption

## Status

Implemented as the second AquaFlow Design System adoption reference.

## Scope

- Migrate `/dashboard/my-day` from legacy Bootstrap recipes to canonical Aqua components.
- Preserve the existing Prisma query, assignment rules, bucket classification, and company timezone behavior.
- Present overdue, today, upcoming, unscheduled, and later work as an operational focus queue.
- Surface open blockers, status, priority, progress, project, phase, and due date without hiding execution context.
- Add a responsive daily-focus rail and direct links to tasks, projects, and time operations.
- Use Arabic Jordan formatting with Latin digits for operational dates.
- Add logical RTL layout, mobile behavior, and reduced-motion handling.

## Non-goals

- No database migration.
- No API contract change.
- No task mutation or inline editing.
- No change to task assignment or participant visibility.

## Quality gates

- Design System package synchronization.
- Lint and TypeScript.
- Unit contracts for canonical components and preserved business logic.
- Production build.
- Visual review at desktop and mobile widths before commit.
