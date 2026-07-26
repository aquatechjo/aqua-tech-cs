# AD-03 — Tasks Adoption

## Outcome

The Tasks route is now the canonical Aqua tech CS employee worklist. It prioritizes what requires action and applies the same scope to server rendering and task APIs.

## Data scopes

- **Personal:** assigned work, work created by the employee, and tasks where the employee participates.
- **Team:** personal work plus tasks assigned to direct reports, active members of led teams or departments, and projects led or managed by the user.
- **Company:** all company tasks for authorized task-management roles.

Job titles remain responsibility context. They do not replace task assignment, participation, or server-enforced data scope.

## Interface

- Compact scope summary with direct links to My Day and task creation.
- Operational metrics for overdue, due today, in progress, and blocked work.
- Search and filters for status, priority, due bucket, project, and assignee when permitted.
- Responsive stacked task table with progress, blockers, due state, and the next valid action.
- Canonical create/edit modal and archive confirmation.
- Employee forms omit cross-employee assignment, client, workflow, AI, and source-reference controls.

## Security

- The Tasks page uses the same visibility predicate as the collection and detail APIs.
- Unauthorized task reads return no task data.
- Assignment and project linkage are validated against the resolved work scope on the server.
- Team managers can operate only on work assigned to people they manage or projects they lead.
- Company managers retain company-wide task access through the existing task-management role contract.

## Verification

- Access-control coverage for managed team work.
- Pure scope tests for personal, team, and company visibility.
- Design adoption checks for canonical components, server enforcement, responsive stacking, RTL logical sizing, and reduced motion.
- Full lint, typecheck, unit, package-sync, and production-build gates.
