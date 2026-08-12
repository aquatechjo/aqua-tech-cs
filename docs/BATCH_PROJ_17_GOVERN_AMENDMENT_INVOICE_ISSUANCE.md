# PROJ-17 — Govern Amendment Invoice Issuance

Status: implemented

## Scope

- Keep the approved amendment amount, currency, Project, client, and single invoice line immutable.
- Allow Finance to confirm tax, due date, notes, and terms while the linked invoice remains a draft.
- Require a documented tax decision, due date, and issuance reference before issuing the invoice.
- Lock the invoice and amendment during issuance and preserve the issuer, timestamp, reference, tax decision, and Activity evidence.
- Use the canonical accessible confirmation dialog for issuance.

## Explicitly deferred

- External invoice delivery, payment reminders, online collection, WhatsApp, and n8n automation.
