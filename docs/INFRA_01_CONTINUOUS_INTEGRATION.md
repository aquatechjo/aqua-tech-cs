# INFRA-01 — Continuous Integration

## Purpose

The Phase 0 gap audit flagged this as the highest-priority non-WhatsApp
gap: `npm run check` (lint, typecheck, unit tests, build) existed and was
genuinely good, but ran only when a person remembered to run it locally.
Nothing stopped broken code from being pushed or merged. This batch adds a
GitHub Actions workflow that runs the same gate automatically.

## What changed

- **`.github/workflows/ci.yml`** (new): on every push to `main` and every
  pull request, spins up an ephemeral PostgreSQL 16 service container and
  runs, as separate steps (so a failure in one step doesn't hide the
  others):
  1. `npm ci`
  2. `npm run prisma:generate`
  3. `npm run db:deploy` (`prisma migrate deploy`) — applies every
     migration in `prisma/migrations/` from scratch against a brand-new
     database
  4. `npm run ds:check`
  5. `npm run lint`
  6. `npm run typecheck`
  7. `npm run test:unit`
  8. `npm run build`

This is the same set of checks `npm run check` already runs locally — CI
does not invent a stricter gate, it enforces the one the project already
defined.

## Why applying migrations from scratch matters on its own

Locally, `prisma migrate dev` has only ever been run against the same
long-lived Neon database, which already has all prior migrations applied.
That never tests whether the _full migration history_, replayed in order
from an empty database, actually succeeds — a broken migration early in
the history could go unnoticed indefinitely as long as no one ever
provisions a fresh database. CI now does this on every push, which is also
exactly what a new developer's local setup, a staging environment, or a
disaster-recovery restore would need to work.

## What this does not do yet (needs a manual step from you)

GitHub Actions cannot enable branch protection from a file in the
repository — this has to be turned on once, by a repository admin, in
GitHub itself:

1. Repository **Settings → Branches → Add branch protection rule** for
   `main`.
2. Enable **"Require status checks to pass before merging"** and select
   the `check` job from this workflow.

Until that's done, this workflow will run and report red/green on every
push and PR, but a failing run will not actually block a merge — it's
observability without enforcement. Turning on the branch protection rule
is what converts it into a real gate.

## Deliberately unchanged / out of scope

- `npm run format:check` (Prettier) is not part of `npm run check` today,
  so it was not added to CI either — CI enforces the project's existing
  definition of "passing," not a new one. Add it to both if you want
  formatting enforced going forward.
- No deployment step. This is CI (verify), not CD (ship) — deploying to
  Vercel/production on a passing `main` build is a separate, deliberate
  decision with its own secrets and rollback considerations.
- No secrets beyond the CI-local `DATABASE_URL` were added, because
  nothing in `npm run check` touches Resend, the WhatsApp/website intake
  secret, or `CRON_SECRET` at build or test time — all of those are read
  lazily inside request handlers, not at module load, so the build and
  test suite pass without them configured.

## Quality gates

This batch could not be verified end-to-end in this environment (no
GitHub Actions runner or Postgres access here). Verification is simply:
push this file and watch the **Actions** tab on GitHub run it against the
real Neon-independent CI database. If `db:deploy` fails, that is itself
useful signal — it means the migration history has an issue that the
long-lived Neon database happened to mask.
