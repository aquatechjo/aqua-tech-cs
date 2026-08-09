# PROJ-08 — Feedback Action Handoff

## Purpose

Turn a governed client-feedback promise into accountable daily work. When PROJ-07 classifies feedback as `ACTION_REQUIRED`, the same serializable transaction creates or updates one Project Task assigned to the documented owner and due date.

## Contract

- Low scores and explicit promises require an action, active Project member owner, and due date.
- The generated Task is linked uniquely from `ProjectFeedback`, uses source `PROJECT_FEEDBACK`, and stores the feedback id as `sourceRef`.
- Re-recording feedback updates the active linked Task and never duplicates it.
- A terminal Task may be replaced by a new Task only when a new required action is recorded.
- Feedback cannot move to `RESOLVED` while its linked Task remains active.
- A documented waiver cancels an active linked Task in the same transaction.
- Task creation and feedback lifecycle changes remain tenant-scoped, project-scoped, role-scoped, row-locked, serializable, and auditable.

## Operating surface

The feedback panel displays the linked Task and its current state. Because the Task uses the existing Task model and assignee, it appears automatically in the owner's Tasks and My Day surfaces under their normal visibility rules.

## Out of scope

- public or anonymous survey links;
- email, WhatsApp, notification, or n8n dispatch;
- testimonial publishing;
- aggregate customer-success dashboards.

## Verification

Run `npm run check`, deploy with `npm run db:deploy`, and confirm `npx prisma migrate status` is up to date.
