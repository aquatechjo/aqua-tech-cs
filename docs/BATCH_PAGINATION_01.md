# PAGINATION-01 — Bounding the Riskiest Unbounded List Endpoints

## Purpose

An earlier gap audit flagged ~22 `findMany` call sites in `src/app/api` with no
`take`, as a growth risk. This batch re-audited every one of them by hand
before touching any code, then fixed the highest-risk true positives.

## Audit result: most of the ~22 were not real gaps

Grepping `src/app/api` for `findMany` turned up 31 files. Sorting them:

- **9 files already had a `take` cap** (`leads`, `sales/opportunities`,
  `finance/invoices`, `finance/expenses`, `hr/leave-requests`,
  `tasks/my-day`, `finance/summary` ×2, both cron reminder routes) — false
  positives from the original count, left untouched.
- **7 call sites are deliberate internal lookups**, not lists returned to a
  caller: one invoice's line items, a role-filtered approver list for a
  notification, one employee's other allocations (capacity check), one
  project's dependency graph (cycle detection), duplicate-contact matching
  during opportunity conversion, role-filtered notification recipients, and
  two summary endpoints (`sales/summary`, `time/summary`) that fetch rows
  only to compute an aggregate object, not to return them raw. Each of these
  is naturally bounded by something other than total record count (one
  invoice, one project, one role's headcount). Left untouched on purpose,
  per the same reasoning PROJ-STATE-01 used for scoping decisions.
- **~14 files are true positives** — real, unbounded `findMany` calls. Of
  those, most (`team`, `organization/teams`, `hr/work-schedules`,
  `organization/departments`, `organization/job-roles`, `hr/leave-types`,
  `hr/leave-balances`, `hr/holidays`) return org-structure or reference data
  that grows with headcount or calendar, not with transaction volume — lower
  urgency, not addressed in this batch.

## What this batch fixes

The three genuinely unbounded, transaction-volume list endpoints, plus the
one endpoint named explicitly as a priority:

- **`GET /api/tasks`** — returned every task the company has ever created.
- **`GET /api/projects`** — returned every project the company has ever
  created.
- **`GET /api/service-requests`** — returned every service request ever
  submitted, with no status filter at all.
- **`GET /api/time/entries`** — already scoped to one week, but had no upper
  bound on how many rows a single week could return across the whole
  company.

A useful discovery from checking the actual frontend callers (`TasksClient`,
`ProjectsClient`, `ServiceRequestsClient`, `TimeCapacityClient`): **none of
these four `GET` list endpoints are currently called by the web UI.** The
dashboard pages (`dashboard/tasks/page.tsx`, `dashboard/projects/page.tsx`,
`dashboard/service-requests/page.tsx`, `dashboard/time/page.tsx`) query
Prisma directly as React Server Components, and the three project/task/
service-request pages already had their own `skip`/`take` pagination with a
`PAGE_SIZE` constant. That made these four the safest possible place to
start: fixing them carries zero risk of breaking an existing screen, since
nothing in the web app currently reads their response shape.

## `src/lib/pagination.ts`

No shared pagination helper existed. Added one, generalizing the
`PAGE_SIZE`/`skip`/`take`/`totalPages` shape already used in
`dashboard/projects/page.tsx`, but reading `page`/`limit` from
`URLSearchParams` instead of a server-component prop:

- `parsePagination(searchParams, { defaultLimit?, maxLimit? })` → `{ page,
limit, skip, take }`. Default limit 20, hard ceiling 100 — a caller asking
  for `limit=99999` is clamped to 100, not honored.
- `buildPaginationMeta(total, params)` → `{ page, limit, total, totalPages }`
  for the response body.

## What changed

- **`src/app/api/tasks/route.ts`** — `getTasks` now takes the request, reads
  `page`/`limit`, runs `findMany` (with `skip`/`take`) and `count` in
  parallel, returns `{ tasks, pagination }`.
- **`src/app/api/projects/route.ts`** — same shape; `GET` now takes a
  `Request` (it took none before).
- **`src/app/api/service-requests/route.ts`** — same shape.
- **`src/app/api/time/entries/route.ts`** — different treatment: this is a
  single-week view meant to render as a whole, not something a caller should
  page through. Added a flat `take: 1000` safety cap instead of full paging,
  so a pathologically large single week can't return unboundedly — normal
  week-sized responses are unaffected.

## Frontend impact

Checked, not assumed: no `fetch` call to any of these four `GET` endpoints
exists anywhere in `src/` today. Adding `page`/`limit` params and a
`pagination` field to the response is additive and required no frontend
changes. If a future consumer (mobile client, integration) calls these
endpoints expecting the full array, `data.tasks` / `data.projects` /
`data.serviceRequests` still exist and behave the same up to the new default
page size — this is a behavior change (defaults to page 1 of 20/50 instead
of "everything") that only matters once something starts calling these
routes as lists.

Confirmed further: a repo-wide text search (scripts, `middleware.ts`,
`next.config`, `package.json` scripts, `.env.example`, and `requireAuth`'s
session-only auth path — no API-key/bearer route exists) found no webhook,
external integration, or script calling these three list endpoints. This
reads as leftover/unused surface rather than a planned future consumer.

## Deliberately not done in this batch

- The 8 lower-urgency, org-structure-shaped endpoints (`team`,
  `organization/*`, `hr/work-schedules`, `hr/leave-types`,
  `hr/leave-balances`, `hr/holidays`) — real `findMany` calls without
  `take`, but bounded by headcount/org size rather than growing
  transactional volume. Left for a follow-up batch.
- `hr/attendance` — bounded by a user-supplied date range, not by count; a
  large requested range is a real but different problem (range validation,
  not pagination) and was left out of this batch.
- The 7 internal-lookup call sites and 9 already-capped endpoints listed
  above were confirmed correct and intentionally left untouched.

## Quality gates

- `npm run check` passes end-to-end: `ds:check`, lint, typecheck, 355/355
  unit tests, build.
