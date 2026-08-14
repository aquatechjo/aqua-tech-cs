# UI-12 — Tasks, Time, and Team Workspace Polish

Status: **implemented**

## Goal

Give day-to-day workforce operations one compact desktop-first visual contract across work assignment, time capture, capacity, and people access.

## Scope

- Task register, scope summary, filters, progress, and task editor.
- Operational week navigation and workforce metrics.
- Live timer and manual time-entry forms.
- Capacity, utilization, project effort, and weekly timesheets.
- Employee account editor and staff directory.

## Visual contract

- Compact 88px task and time summaries.
- Unified week navigation, cards, entry forms, and table containment.
- Consistent employee editor and directory spacing.
- Compact table action groups and readable timer numerals.
- Logical properties, responsive wrapping, and reduced-motion coverage.

## Preserved behavior

- Personal, team, department, project, and company task scopes.
- Task assignment, status, review, participation, and blocker rules.
- Timer lifecycle, manual entries, billability, costs, and margins.
- Weekly submission, approval, rejection, and capacity configuration.
- Employee identity, access roles, organization mapping, and activation.
- Tenant scope, routes, APIs, and permissions.

## Quality gate

- Design System synchronization check.
- Lint, typecheck, unit and closure suites.
- Production build.
- UI-12 contract assertions in the existing Tasks adoption test.
