# Batch 1 — Organization Structure

Batch 1 separates access permissions from an employee's actual job identity
and adds the organizational structure required by AquaFlow.

## Included

- Replaced the mixed `UserRole` enum with permission-only `AccessRole`.
- Added `EmployeeProfile`, `Department`, `JobRole`, `Team`, and
  `TeamMembership`.
- Added employment type, employment status, weekly work hours, employee
  number, and optional reporting-manager fields.
- Added department managers and team leads.
- Added per-team time allocation with a strict maximum of 100% per employee.
- Added organization APIs with tenant checks, management authorization,
  same-origin validation, bounded request bodies, and activity logging.
- Updated employee creation and editing to manage access and job identity
  separately.
- Added a Bootstrap organization dashboard for departments, job roles, teams,
  memberships, and capacity.
- Added migration backfill for all existing users.
- Updated the seed so a fresh installation creates the owner's organizational
  profile safely.

## Access roles

| Access role | Purpose |
|---|---|
| `OWNER` | Protected owner account and full management |
| `ADMIN` | Company, people, organization, and system management |
| `OPERATIONS_MANAGER` | Projects, tasks, clients, and service requests |
| `SALES_MANAGER` | Clients and service requests |
| `FINANCE_MANAGER` | Reserved for the operational-finance batch |
| `MEMBER` | Own work and standard internal access |

Job titles such as developer, designer, marketer, or support specialist now
belong in `JobRole`; they no longer grant permissions implicitly.

## Existing-user migration

The migration preserves both meaning and access:

| Old role | New access role | Backfilled job role |
|---|---|---|
| `OWNER` | `OWNER` | مالك الشركة |
| `ADMIN` | `ADMIN` | مدير النظام |
| `PROJECT_MANAGER` | `OPERATIONS_MANAGER` | مدير مشاريع |
| `SALES` | `SALES_MANAGER` | مسؤول مبيعات |
| `FINANCE` | `FINANCE_MANAGER` | مسؤول مالية |
| `DEVELOPER` | `MEMBER` | مطوّر برمجيات |
| `DESIGNER` | `MEMBER` | مصمم |
| `MARKETING` | `MEMBER` | مسؤول تسويق |
| `SUPPORT` | `MEMBER` | مسؤول دعم |

Departments and employee profiles are created automatically from the existing
roles before the old enum is removed.

## Allocation safety

- Each membership accepts an integer allocation from 1% to 100%.
- The API locks the employee profile while calculating allocations so two
  concurrent writes cannot both pass using stale totals.
- A database check also rejects an invalid percentage on an individual row.
- Re-submitting the same employee and team updates the existing membership.

## Application order

1. Keep the Neon backup branch created before Batch 0.
2. Apply the Batch 1 source files over the completed Batch 0 project.
3. Run `npm install`.
4. Run `npm run db:deploy`.
5. Run `npm run check`.
6. Test the team and organization pages locally.
7. Commit locally. Do not push until all AquaFlow batches are complete.

Do not edit the Batch 0 migration. Batch 1 is an additional forward-only
migration.
