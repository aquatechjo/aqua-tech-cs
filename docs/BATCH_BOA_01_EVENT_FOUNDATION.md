# BOA-01 — Domain Event Foundation

## Purpose

Introduce a general-purpose, company-wide domain event pipe (transactional
outbox) as the foundation the Business Operating Architecture v1.0 roadmap
requires before Phase 2 (WhatsApp) and the AI Orchestrator can be built
without every new subsystem coupling directly into existing request
handlers.

This batch migrates exactly one existing side effect onto the new pipe —
the follow-up task created when a client marks project feedback as
`ACTION_REQUIRED` — as the pilot. No other behavior changes.

## Finding that reshaped this batch

The audit for this batch found that a transactional-outbox table already
exists: `WorkflowEvent` (`status: PENDING/PUBLISHED/FAILED`, `attempts`,
`lastError`, `payload: Json`). It is written by
`src/lib/project-workflow-server.ts` and two project routes, but **nothing
in the codebase ever reads a `WorkflowEvent` row** — there is no dispatcher,
worker, or cron job that processes `PENDING` rows. It is a write-only audit
trail today, not an active outbox.

Decision: do not extend `WorkflowEvent` in this batch. It is a
`ProjectWorkflow`-scoped concept (every row requires a `workflowId`) and is
not a fit for company-wide events with no workflow instance behind them
(e.g. a feedback submission). A new `DomainEvent` model was added instead,
reusing the same field shape for consistency. `WorkflowEvent` is left
exactly as-is — migrating its existing rows and producers into `DomainEvent`
is future work and is deliberately **out of scope** here, to keep this
batch small and reversible.

## What changed

- **Schema:** added `DomainEvent` model and `DomainEventStatus` enum
  (`PENDING`, `PROCESSED`, `FAILED`), company-scoped like every other model.
- **`src/lib/domain-events.ts`:** `emitDomainEvent` (writes inside the
  caller's transaction), `processDomainEvent` (runs the registered handler,
  marks the row processed or failed with an incremented attempt count),
  `dispatchPendingDomainEvents` (sweeps pending/retryable rows — the cron
  entry point), `dispatchDomainEventNow` (synchronous drain for producers
  that need the side effect to happen before the request returns).
- **`src/lib/domain-event-handlers.ts`:** first handler,
  `handleProjectFeedbackActionRequired`, which creates the follow-up task.
  It re-reads `followUpTaskId` from the database before creating anything,
  so re-processing the same event never creates a duplicate task.
- **`src/app/api/public/feedback/[token]/route.ts`:** the inline
  `tx.task.create(...)` for `ACTION_REQUIRED` was replaced with
  `emitDomainEvent(tx, ...)` inside the same transaction, followed by
  `dispatchDomainEventNow(...)` immediately after the transaction commits.
  User-facing behavior and latency are unchanged — the task is still
  created before the response is returned.
- **`src/app/api/cron/dispatch-events/route.ts`:** new cron endpoint,
  secret-protected with the same `CRON_SECRET` / `safeEqualSecrets` pattern
  as the existing feedback and invoice reminder cron routes. This is the
  safety net for any event that fails synchronous dispatch (crash, deploy
  restart between commit and dispatch, etc.) — it retries `FAILED` events
  up to 5 attempts.

## Deliberately unchanged / out of scope

- `WorkflowEvent` and its producers — untouched.
- No async worker/queue — dispatch is synchronous-after-commit today, with
  the cron sweeper as the retry path, not a message queue. Revisit if event
  volume or handler latency ever makes synchronous dispatch unacceptable on
  the request path.
- No `N8N_EVENT` publishing — `WorkflowActionChannel.N8N_EVENT` already
  exists in the schema for a future external-publish step (relevant once
  WhatsApp/n8n automation is wired in Phase 2), but this batch only
  dispatches to in-process handlers.
- Only one event type (`project_feedback.action_required`) is migrated.
  Additional producers should be added as separate, small batches so each
  migration can be reviewed and rolled back independently.

## Known test-coverage limitation

This project's unit test suite (`tests/unit/*.test.ts`, run via
`node --test` over `tsx`) does not connect to a database — none of the
existing 60 test files exercise Prisma against a real database, and this
batch follows that same constraint rather than introducing a new,
inconsistent test style on its own. `tests/unit/domain-events.test.ts` adds
structural regression guards only:

- every `emitDomainEvent` call site's event type has a matching entry in
  the handler registry (catches a typo'd event-type string at test time
  instead of at runtime),
- the `DomainEventStatus` enum has exactly the three states the dispatcher
  relies on,
- the feedback route's inline task-creation code was actually removed
  (guards against silently reverting this migration later).

**The dispatcher's actual database behavior — idempotency under
re-dispatch, the attempt-count retry cap, the PENDING/PROCESSED/FAILED
transitions — has not been exercised against a real database and should be
verified manually (or via a follow-up batch that adds a database-backed
integration test harness) before this pattern is relied on for
higher-stakes events such as invoicing or contracts.**

## Migration

This batch only edits `prisma/schema.prisma` — it does not include a
generated migration file, because generating one correctly requires running
against the project's actual development database to capture the true
current migration state (47 prior migrations), which was not available in
this environment. Run locally before merging:

```
npx prisma migrate dev --name boa01_domain_events
```

Review the generated SQL before applying it to any shared or production
database, per the project's existing migration review practice.

## Quality gates

- `npm run check` (lint, typecheck, unit tests, build) must be run locally
  — it was not run in this environment (no network access to the Prisma
  engine binaries or a database).
- Manual verification recommended: submit a test `ACTION_REQUIRED` feedback
  through the public link and confirm exactly one follow-up task is
  created, `DomainEvent.status` reaches `PROCESSED`, and re-running
  `dispatchPendingDomainEvents` against the same (now processed) event id
  is a no-op.

## Next batches

- `BATCH_BOA_02` — Website→Core intake hardening.
- `BATCH_BOA_03` — WhatsApp foundation (first new event producer on this
  pipe: inbound message received, outbound message sent).
