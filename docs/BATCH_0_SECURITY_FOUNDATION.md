# Batch 0 — Security and Stability Foundation

Batch 0 hardens the existing AquaFlow project without redesigning it or
starting again. Bootstrap and the current product structure remain unchanged.

## Included

- Updated Next.js, React, Prisma, and security-sensitive transitive packages.
- Added strict response security headers and disabled the framework signature.
- Standardized API errors for `401`, `403`, `404`, `409`, `413`, `429`, and
  unexpected server failures.
- Added same-origin validation and bounded JSON request bodies.
- Added a PostgreSQL-backed rate limiter for login and website intake.
- Added constant-time comparison for the website intake secret.
- Added retry-safe website intake using `Idempotency-Key` or `workflowRunId`.
- Wrapped related data writes and activity records in database transactions.
- Protected `OWNER` from creation, assignment, or modification by an admin.
- Removed fixed seed credentials, prefilled login credentials, and the visible
  default employee password.
- Limited activity logs and service requests to their temporary management
  roles.
- Limited task edits to management, the assignee, or the task creator.
- Fixed user-specific notification reads so one user cannot mark a shared
  notification as read for everyone.
- Added the missing service-request conversion endpoint. Conversion to a client
  and project is transactional and safe to repeat.
- Added unit tests and a complete `npm run check` quality gate.

## Historical role policy

This was the temporary policy used by Batch 0. Batch 1 replaces `UserRole`
with a permission-only `AccessRole` and moves job identity into the
organizational models.

| Operation | Allowed roles |
|---|---|
| Company settings and team management | `OWNER`, `ADMIN` |
| Full activity log | `OWNER`, `ADMIN` |
| Client management | `OWNER`, `ADMIN`, `SALES`, `PROJECT_MANAGER` |
| Project management | `OWNER`, `ADMIN`, `PROJECT_MANAGER` |
| Service-request access and management | `OWNER`, `ADMIN`, `SALES`, `PROJECT_MANAGER` |
| Any task | `OWNER`, `ADMIN`, `PROJECT_MANAGER` |
| Own task | Assignee or creator |

## Required production variables

```text
DATABASE_URL
APP_ORIGIN
WEBSITE_INTAKE_SECRET
AQUA_COMPANY_SLUG
```

`APP_ORIGIN` must be the exact deployed AquaFlow origin, for example
`https://flow.example.com`. Use a long random value for
`WEBSITE_INTAKE_SECRET`.

The `SEED_*` variables are required only when intentionally running the seed.
They are not application runtime credentials.

## Website intake contract

Send the secret in one of:

```text
X-AquaFlow-Intake-Secret: <secret>
Authorization: Bearer <secret>
```

Every retryable request should also send a stable unique key:

```text
Idempotency-Key: <request-id>
```

If `Idempotency-Key` is missing, `workflowRunId` is used. A repeated key returns
the original `serviceRequestId` with `replayed: true`.

## Deployment order

1. Create a Neon restore point or database backup.
2. Apply the source changes.
3. Run `npm install`.
4. Confirm `.env` and deployment environment variables.
5. Run `npm run db:deploy`.
6. Run `npm run check`.
7. Commit and push only after every check succeeds.

Do not deploy the API code before applying the Batch 0 migration. The login and
website-intake rate limiter requires the new `RateLimitBucket` table.
