# PROJ-23 — Scheduled Invoice Payment Reminder Operations

## Goal

Add explicit opt-in scheduling to the governed payment reminder introduced in PROJ-22 without turning provider failures into automatic retry loops.

## Workflow

1. Finance enables scheduling from an eligible amendment invoice.
2. The next attempt is set no earlier than 72 hours after the latest successful portal delivery or reminder.
3. A `CRON_SECRET`-protected worker processes at most 20 due schedules per run.
4. Successful sends rotate the secure portal only after provider acceptance and schedule the next eligible contact.
5. Scheduling stops at three successful reminders, full payment, an inactive portal, or provider failure.

## Operations

- Invoke `GET /api/cron/invoice-payment-reminders` with `Authorization: Bearer <CRON_SECRET>`.
- Configure `APP_URL`, `RESEND_API_KEY`, `INVOICE_FROM`, and `CRON_SECRET`.
- Provider failure is recorded and disables scheduling; there is no implicit retry.

## Deferred

- Online payment collection.
- WhatsApp delivery.
- Automatic retries and n8n.
