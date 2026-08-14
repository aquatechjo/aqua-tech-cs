# UI-13A — Operational Density and RTL Cleanup

Status: **implemented**

## Reason

Desktop review after UI-13 exposed cross-page density and RTL issues that should be corrected before styling more modules.

## Scope

- Dashboard hierarchy, attention rail, metrics, and empty states.
- My Day hero, date context, metrics, side rail, and empty state.
- Tasks header, metrics, filter panel, and pagination metadata.
- Operational sidebar and topbar density.
- Horizontal RTL navigation arrows and secondary text contrast.

## Changes

- Replace diagonal `ArrowUpLeft` actions with horizontal `ArrowLeft` actions.
- Reduce sidebar width to 232px and tighten navigation groups and rows.
- Reduce topbar height and remove its duplicated product-name label.
- Rebalance Dashboard and My Day main/rail columns.
- Reduce oversized hero, metric, date-context, filter, and empty-state blocks.
- Hide `1 / 1` pagination metadata when the task list has one page.
- Improve muted text contrast only inside the authenticated application shell.

## Preserved behavior

- Dashboard and My Day data, links, classifications, and role-aware visibility.
- Task filtering, pagination URLs, editing, status transitions, and permissions.
- Sidebar groups, active states, scrolling, keyboard focus, and responsive behavior.
- RTL/LTR logical layout and reduced-motion support.

## Quality gate

- Design System synchronization check.
- Lint, typecheck, unit and closure suites.
- Production build.
- UI-13A assertions in the existing compact shell and My Day test.
