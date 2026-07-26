# AD-02.5 — Dashboard Operations

## Purpose

Turn `/dashboard` from a large welcome surface into a compact desktop-first decision center. The page should answer what needs attention now before showing historical activity or navigation shortcuts.

## Removed

- The duplicated company identity card and logo.
- The visual-only `system connected` state.
- Team and active-session counts from the primary metric row.
- The large quick-start panel, because the canonical sidebar already provides navigation.
- Internal Design System adoption copy that is not operational content.

## Added

- A compact daily summary with the company timezone and active action-queue state.
- Four primary metrics: overdue tasks, tasks due today, projects in progress, and unread notifications.
- A role-aware focus list for overdue, due-today, and blocked tasks.
- A role-aware action queue for blockers, unscheduled tasks, new service requests, overdue sales follow-ups, overdue invoices, submitted timesheets, pending leave requests, and submitted expenses.
- Direct links from every metric and queue item to its operational destination.

## Access and data rules

- Owners, admins, and operations managers receive company task counts.
- Other roles receive task counts limited to assignments and task participation.
- Service-request, sales, finance, and activity data remains protected by the existing role contracts.
- Approval queues exclude self-approval items for non-owner reviewers.
- Dates use the company timezone with Latin digits.
- No schema, migration, or new API route is required.

## Acceptance gates

- `npm run ds:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- Desktop visual review with realistic zero and non-zero states.
- Keyboard, focus-visible, RTL/LTR, and reduced-motion review.
