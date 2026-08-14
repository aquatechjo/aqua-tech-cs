# UI-11 — Projects and Project Execution Polish

Status: **implemented**

## Goal

Give project delivery one compact desktop-first operating surface from the portfolio register through closure and feedback.

## Scope

- Projects register, filters, metrics, workflow identity, and project editor.
- Project readiness, summary, members, phases, tasks, dependencies, and blockers.
- Deliverables and their governed transitions.
- Risks, issues, decisions, and change requests.
- Project closure and client feedback follow-up.

## Visual contract

- Consistent project page roots and compact 88px operational summaries.
- Unified panel radius, elevation, headers, actions, and long-form fields.
- Clear containment for deliverables, governance records, and change requests.
- Stronger separation for closure and feedback action rows.
- Logical properties, responsive wrapping, and reduced-motion coverage.

## Preserved behavior

- Role-aware project and task visibility.
- Project readiness and activation rules.
- Proposal and workflow provenance.
- Task, member, phase, dependency, blocker, and deliverable transitions.
- Change, finance, amendment, closure, feedback, and audit contracts.
- Tenant scope, routes, APIs, and permissions.

## Quality gate

- Design System synchronization check.
- Lint, typecheck, unit and closure suites.
- Production build.
- UI-11 contract assertions in the existing Projects adoption test.
