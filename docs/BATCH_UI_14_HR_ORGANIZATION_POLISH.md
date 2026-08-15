# UI-14 — HR and Organization Workspace Polish

Status: **implemented**

## Goal

Give people operations one compact desktop-first visual contract across attendance, leave, schedules, and organization structure.

## Scope

- Attendance overview, personal check-in/out, team status, and manual correction.
- Leave requests, decisions, balances, types, and company holidays.
- Work schedules and employee schedule assignment.
- Departments, job roles, teams, memberships, and time allocation.

## Visual contract

- Compact workspace tabs and 88px operational metrics.
- Unified card, editor, register, table, and progress treatment.
- Reduced form and grid spacing for dense administrative work.
- Consistent organization lists, teams, membership, and allocation cards.
- Logical properties, responsive wrapping, and reduced-motion coverage.

## Preserved behavior

- Company-timezone attendance and schedule snapshots.
- Check-in/out, remote work, lateness, overtime, and manual correction.
- Leave-day calculation, holidays, half days, balances, and approvals.
- Department, job role, team, membership, and allocation constraints.
- Tenant scope, permissions, routes, APIs, and audit evidence.

## Quality gate

- Design System synchronization check.
- Lint, typecheck, unit and closure suites.
- Production build.
- UI-14 contract assertions in the existing HR unit test.
