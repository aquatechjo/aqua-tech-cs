# PROJ-24 — Governed Payment Receipts

## Goal

Turn every posted invoice payment into a traceable receipt that Finance can print internally and deliver safely to the invoice client.

## Controls

- The receipt page requires authenticated Finance read access and tenant scope.
- Email delivery requires Finance management authority, same-origin enforcement, and a locked posted payment.
- Reversed payments cannot be printed as active receipts or delivered.
- Recipient identity comes from the invoice client rather than arbitrary request input.
- The email contains the receipt evidence directly and never exposes a dashboard or internal receipt URL.
- Concurrent attempts are blocked for 15 minutes; retries remain manual.

## Evidence

- Stable receipt reference derived from the immutable payment id.
- Invoice, project, amount, currency, payment method, date, and payment reference.
- Recipient, provider id, prepared/sent/failed timestamps, bounded failure reason, and attempt count.
- Activity events for prepared, sent, and failed delivery outcomes.

## Environment

- `RESEND_API_KEY`
- `INVOICE_FROM`

## Deferred

- Public receipt links and binary PDF attachments.
- Online payment collection.
- WhatsApp and n8n.
