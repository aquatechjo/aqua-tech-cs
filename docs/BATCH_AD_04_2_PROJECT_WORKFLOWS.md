# AD-04.2 — Project Workflow Foundation

## Outcome

Every project is linked to an internal workflow. The workflow is not an external automation substitute: Aqua tech CS owns project state, phases, tasks, dependencies, approvals, and role expectations. External tools such as n8n consume durable workflow events.

## Creation contract

- Manual project creation requires an active company workflow template.
- Converting a service request or won sales opportunity resolves a template from the service hint and falls back to the active default.
- Template definitions are validated for unique stage, task, approval, and rule codes.
- Invalid stage references, task references, self-dependencies, and dependency cycles are rejected.
- Project creation, workflow snapshotting, phase/task/dependency cloning, approval/rule cloning, and the initial event are one database transaction.

## Independence

- `WorkflowTemplate` is the reusable company definition.
- `ProjectWorkflow` stores the selected template name, code, version, and a full immutable-at-creation definition snapshot.
- Generated `ProjectPhase` and `Task` records remain the operational execution engine.
- Changing a template later does not rewrite running projects.
- Existing projects are linked to the general template during migration without replacing their established execution records.

## Included templates

- Website delivery.
- SaaS product or internal system.
- Growth campaign.
- Custom delivery as the company default.

## Execution and integration

- Workflow-created tasks use `TaskSource.WORKFLOW`.
- Stages and tasks retain stable workflow codes so the snapshot can be traced after users edit labels.
- Unassigned generated tasks retain the expected project-member role.
- Project status updates synchronize `ProjectWorkflow.status`.
- Project creation, start, and completion write durable `WorkflowEvent` records.
- Notification, email, and n8n rules are cloned per project.
- Publishing pending n8n events is deliberately a later integration worker; the database outbox is the source of truth.

## Security

- Workflow templates are filtered by the authenticated company.
- Template identifiers are validated server-side before project creation.
- Workflow summaries inherit the same company/team/personal project visibility as the project.
- Workflow linkage does not widen project metadata, budget, execution, employee assignment, or task permissions.

## Verification

- Prisma schema validation and client generation.
- Workflow definition and cycle-validation unit tests.
- Adoption contract tests across schema, migration, APIs, conversions, and UI.
- ESLint, TypeScript, complete unit suite, and production build.
