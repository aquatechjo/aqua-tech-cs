# Batch 5 — Time & Capacity

Batch 5 adds controlled time tracking and weekly capacity management to
AquaFlow. It connects actual effort to employees, projects, tasks, and project
economics without introducing payroll, biometric attendance, or leave
management.

## Included

- Manual time entries with business-date validation.
- One active timer per user, enforced by both the API and a partial unique
  database index.
- Project and task targeting with company and execution-access checks.
- Billable and non-billable time.
- Weekly timesheets based on the company timezone and Monday week boundaries.
- Submission, approval, and rejection workflow.
- Immutable approved timesheets and locked submitted timesheets.
- Rejected timesheets return to an editable state only when the employee edits
  or resubmits them.
- Weekly capacity per employee using `workHoursPerWeek`.
- Hourly internal cost and billable rate settings.
- Cost and billable-rate snapshots on every time entry so historical economics
  do not change when employee rates are updated later.
- Employee utilization, billable utilization, cost, value, and margin.
- Project actual hours compared with task estimates.
- Audit-log actions and employee notifications for submission, approval, and
  rejection.
- Unit tests for week boundaries, duration controls, timesheet transitions,
  utilization, economics, and approval permissions.

## Permissions

- Every active user can record and edit their own open or rejected time entries.
- Users can record time only against tasks they can edit or projects in which
  they actively participate.
- `OWNER`, `ADMIN`, `OPERATIONS_MANAGER`, and `FINANCE_MANAGER` can view
  company-wide time and utilization.
- `OWNER`, `ADMIN`, and `OPERATIONS_MANAGER` can approve or reject submitted
  timesheets.
- Non-owner approvers cannot approve their own timesheets.
- `OWNER`, `ADMIN`, and `FINANCE_MANAGER` can update hourly cost and billable
  rate.
- `OWNER`, `ADMIN`, and `OPERATIONS_MANAGER` can update weekly capacity.
- Cost, value, rates, and margin are redacted by the server unless the role has
  time-cost access.

Access roles remain the authorization boundary. Departments and job titles are
organizational metadata.

## Data controls

- Work dates are stored as normalized business dates.
- Future manual time entries are rejected.
- Manual entries are limited to 24 hours.
- Timers may run up to seven days; an active timer can also be cancelled without
  recording time so a stale timer never traps the user.
- A timesheet cannot be submitted while it contains an active timer.
- A timesheet cannot be submitted when it is empty.
- Submitted and approved entries cannot be modified or deleted.
- Approved timesheets cannot be reopened through the application.
- Project, task, user, timesheet, and entry references are tenant-scoped.
- A task linked to a project cannot be logged under a different project.
- The database validates timesheet state timestamps, entry timer state, rates,
  durations, Monday week starts, and one running timer per user.

## Metrics

- **Tracked time:** all completed minutes in the selected week.
- **Billable time:** completed minutes marked billable.
- **Utilization:** tracked minutes divided by weekly capacity.
- **Billable utilization:** billable minutes divided by weekly capacity.
- **Effort cost:** tracked minutes multiplied by the saved hourly-cost snapshot.
- **Time value:** billable minutes multiplied by the saved billable-rate
  snapshot.
- **Time margin:** time value minus effort cost.
- **Project variance:** actual tracked hours minus the sum of active task
  estimates.

These are operational effort metrics. They are not payroll calculations or
recognized accounting revenue.

## Application order

1. Start from the clean Batch 4 commit `bfb6c67`.
2. Extract the Batch 5 ZIP over the AquaFlow project root.
3. Run `npm ci`.
4. Run `npm run check` before changing the database.
5. Run `npm run db:deploy` after the complete code gate passes.
6. Test `/dashboard/time`, manual entry, timer start/stop, submission,
   rejection, correction, approval, capacity updates, and rate snapshots.
7. Commit locally. Do not push until all planned AquaFlow batches are complete.

Do not edit migrations from Batches 0–4. Batch 5 is an additional forward-only
migration.
