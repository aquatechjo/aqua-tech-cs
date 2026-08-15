# PROJ-21 — Secure Invoice Portal Delivery

## Goal

Deliver the secure client invoice portal created in PROJ-20 through the existing transactional invoice email channel without exposing an internal route or invalidating a working link on provider failure.

## Workflow

1. Finance enters an explicit recipient and chooses a 1–30 day validity period.
2. The server validates the issued amendment invoice, client ownership, recipient, and concurrency state.
3. A new opaque token is created in memory and a prepared audit event is stored.
4. The email provider receives the client-safe public portal URL.
5. Only after provider acceptance is the new token hash activated and the previous link invalidated.
6. Provider failure is recorded while the previous portal link remains unchanged.

## Evidence

- Recipient name and normalized email.
- Prepared, sent, and failed timestamps.
- Provider id and bounded failure reason.
- Attempt count and portal expiry.
- Activity events for prepared, sent, and failed outcomes.

## Environment

- `RESEND_API_KEY`
- `INVOICE_FROM`
- `APP_URL` with an HTTPS production origin; localhost is accepted only for development.

## Explicitly deferred

- Payment reminders.
- Online payment collection.
- WhatsApp delivery.
- Automatic retry scheduling.
- n8n dispatch.
