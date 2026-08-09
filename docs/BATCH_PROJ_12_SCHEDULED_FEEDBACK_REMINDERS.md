# PROJ-12 — Scheduled Feedback Reminder Operations

## Outcome

Adds explicit, per-project scheduling for the governed email reminder created in PROJ-11. Scheduling never starts implicitly: an execution manager enables it only after a successful invitation, and may stop it from the project feedback panel.

## Governance

- The next reminder is due no earlier than 72 hours after the last successful invitation or reminder.
- The existing maximum of three successful reminders remains authoritative.
- The worker reuses the PROJ-11 acceptance-gated token rotation and concurrency lock.
- Every run processes at most 20 due records and requires a constant-time verified `CRON_SECRET` bearer token.
- Receipt of feedback, manual recording, link revocation, a new invitation, or reaching the cap stops scheduling.
- A scheduled provider failure preserves the active link, records the failure, and stops the schedule for explicit human review.
- There are no automatic retries, WhatsApp messages, or n8n dispatches in this batch.

## Operations

Configure `APP_URL`, `RESEND_API_KEY`, `FEEDBACK_FROM`, and `CRON_SECRET`. Invoke `GET /api/cron/feedback-reminders` from the deployment scheduler with `Authorization: Bearer <CRON_SECRET>` on an appropriate recurring cadence. Eligibility remains database-driven, so a frequent worker run does not bypass the 72-hour contact rule.

## Verification

- Prisma generation and migration validation.
- Design System synchronization.
- ESLint and TypeScript.
- Existing core and PROJ-06 through PROJ-11 tests.
- PROJ-12 schedule, worker security, lifecycle, and stop-condition tests.
- Production build.
