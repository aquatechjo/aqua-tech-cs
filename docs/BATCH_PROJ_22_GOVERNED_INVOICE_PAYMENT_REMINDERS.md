# PROJ-22 — Governed Invoice Payment Reminders

## Goal

Add a manual and audited payment reminder for an issued amendment invoice with an outstanding balance and a successfully delivered secure client portal.

## Controls

- Finance-management authorization and same-origin enforcement.
- An active, non-revoked portal and a previous successful portal delivery are required.
- At least 72 hours between successful client contacts.
- Maximum of three successful reminders per invoice.
- Row locks, a pending token hash, and a 15-minute preparation guard prevent overlapping sends.
- A fresh opaque token is held only in memory and activated after email provider acceptance.
- Provider failure clears the pending attempt while preserving the previous active portal.

## Evidence

- Prepared, sent, and failed timestamps.
- Provider id, bounded failure reason, attempt count, and successful reminder count.
- Activity events for all lifecycle outcomes.

## Environment

- `RESEND_API_KEY`
- `INVOICE_FROM`
- `APP_URL` with an HTTPS production origin.

## Deferred

- Automatic reminder scheduling.
- Online payment collection.
- WhatsApp delivery, automatic retries, and n8n.
