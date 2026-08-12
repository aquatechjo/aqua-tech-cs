# PROJ-18 — Secure Amendment Invoice Delivery

Status: implemented

## Scope

- Send only an issued amendment invoice through the configured transactional email provider.
- Require an explicit recipient name, normalized recipient email, and delivery reference.
- Send a client-safe invoice summary without exposing an internal dashboard link or creating an unprotected public route.
- Preserve prepared, sent, and failed evidence, provider id, bounded failure reason, actor, recipient, reference, timestamp, and attempt count.
- Block duplicate successful delivery and concurrent in-flight attempts while allowing a documented retry after failure.

## Environment

- `INVOICE_FROM` must be a sender on a domain verified by the transactional email provider.

## Explicitly deferred

- Downloadable PDF attachment, secure public invoice portal, payment reminders, online collection, WhatsApp, and n8n automation.
