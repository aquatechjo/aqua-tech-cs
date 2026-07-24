# Batch 6 — People, Attendance & Leave

Batch 6 adds the operational HR layer to AquaFlow. It deliberately excludes
payroll, deductions, benefits, biometric devices, and statutory payroll
processing; those areas require a separate implementation and legal review.

## Scope

- Reusable work schedules with ISO working days, shift start/end, break, and
  late-grace settings.
- One default schedule per company, plus optional employee-specific schedule
  assignments.
- Employee self-service check-in and check-out, including remote-work status.
- Manual attendance correction for authorized operations roles.
- Schedule snapshots on attendance records so historical reports remain stable
  when a schedule changes later.
- Configurable leave types, paid/unpaid flags, annual allowances, and carryover
  policy values.
- Annual leave balances with opening, accrued, adjustment, used, and available
  values.
- Leave requests with full-day or half-day boundaries, overlap prevention,
  approval, rejection, cancellation, notifications, and audit events.
- Leave-day calculation that excludes employee rest days and company holidays.
- Company holiday calendar.
- A unified `/dashboard/hr` workspace for today, leave, attendance history, and
  policies.

## Access model

Every active employee can:

- View their own attendance and leave records.
- Check in and check out.
- Submit and cancel eligible future leave requests.

`OWNER`, `ADMIN`, and `OPERATIONS_MANAGER` can view company HR operations and
manage attendance. Leave approval is available to the same leadership group,
with self-approval blocked except for `OWNER`.

Only `OWNER` and `ADMIN` can manage schedules, leave policies, balances, and
company holidays.

## Data integrity

- One attendance row is allowed per company, employee, and work date.
- Check-out must follow check-in.
- Attendance minutes cannot be negative.
- Work dates and holidays are stored as normalized UTC date keys.
- Leave requests cannot overlap pending or approved requests.
- Cross-year leave requests must be split to keep annual balances deterministic.
- Approved leave with a tracked allowance consumes balance transactionally.
- Cancelling an approved future leave restores the consumed balance.
- Approval is blocked when actual attendance already exists in the requested
  range.
- One partial unique index enforces a single default schedule per company.

## Migration defaults

For existing companies, the migration creates:

- A default Sunday–Thursday schedule from 09:00 to 17:00, with a 60-minute break
  and 15-minute grace period.
- Annual leave and sick leave policies, each initialized with 14 days.
- Employee profiles are assigned to the new default schedule when they do not
  already have an explicit schedule.

Review these defaults from the HR settings page before production use.

## Quality gate

Run the complete gate before applying the migration:

```bash
npm run check
```

Then apply the migration only after the gate succeeds:

```bash
npm run db:deploy
npx prisma migrate status
```
