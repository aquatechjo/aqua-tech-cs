# AD-02.6 — Employee Dashboard Polish

## Goal

Make the Aqua tech CS dashboard useful to an employee at the start of the workday without repeating navigation or notification surfaces.

## Employee-first hierarchy

1. A compact operating summary with the company-local date and one direct action to My Day.
2. Four work indicators:
   - overdue tasks;
   - tasks due today;
   - tasks currently in progress;
   - active projects relevant to the employee.
3. A five-item daily focus list ordered by urgency, blockers, priority, and due date.
4. A role-aware action queue that shows only non-zero operational items.
5. The latest five activity records as a compact accountability reference.

## Visibility rules

- Task metrics follow the existing task-management role boundary.
- Project managers see company active projects.
- Other employees see projects where they are members or have assigned/participating tasks.
- Company activity is limited to roles with activity-log access.
- Other employees see only activity attached to their own account.
- Sales, finance, service-request, time, leave, and expense approval items continue to use their existing permission contracts.

## Removed

- The attention-path status badge in the summary.
- The notifications button in the summary.
- The notifications metric card.
- English panel kickers.
- Oversized metric, empty-state, activity, and summary spacing.

## Activity contract

- Query order: newest first.
- Maximum result count: five.
- Each row shows the readable activity message, actor, and company-timezone timestamp.
- Raw database action identifiers are not exposed on the overview.

## Validation

- `npm run ds:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- RTL/LTR and logical-property review
- Laptop and mobile density review
- Reduced-motion review
