# AD-04 — Projects Adoption

## Outcome

Projects is now an employee-safe operational surface. The list, project detail, execution API, task summaries, and employee pickers all use the same server-resolved access scope.

## Access model

- Company project-management roles can view all projects and create or edit project metadata.
- Project leads and project managers can manage execution inside projects they lead without gaining company-wide project or financial access.
- Team and department managers see projects and tasks connected to the people they manage.
- Employees see projects they belong to or have visible work in, and only their visible task execution is included in progress and blocker totals.
- Project budgets are returned only to roles with finance-read access.
- New project members and task participants must be inside the actor’s assignment scope; the API rejects out-of-scope identifiers even when called directly.

## Interface

- Compact project summary and four operational metrics.
- Canonical filter bar, stacked responsive table, pagination, empty states, modal forms, date pickers, and archive confirmation.
- Project execution overview with scoped tasks, phases, members, dependencies, blockers, and progress controls.
- Mandatory workflow template selection for manual projects, with automatic template resolution for service-request and won-opportunity conversion paths.
- Each new project receives an independent workflow snapshot plus cloned phases, tasks, dependencies, approval definitions, role expectations, notification rules, and n8n event rules.
- Existing projects receive a safe generic workflow link without replacing their current phases or tasks.
- Arabic Jordan dates use Latin digits and the company timezone.
- CSS Modules use logical sizing, responsive breakpoints, focus-safe canonical components, and reduced-motion coverage.

## Verification

- `npm run ds:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`

See `BATCH_AD_04_2_PROJECT_WORKFLOWS.md` for the workflow data and execution contract.
