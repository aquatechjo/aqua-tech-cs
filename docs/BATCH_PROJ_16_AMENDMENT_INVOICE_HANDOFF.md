# PROJ-16 — Amendment Invoice Handoff

Status: implemented

## Scope

- Create one finance-owned draft invoice from an accepted amendment only after its budget and schedule impact is applied.
- Link the invoice immutably to the amendment, Project, and Project client.
- Freeze the approved amendment amount and currency into one invoice line.
- Require operational, Project, and amendment currencies to match.
- Preserve the finance actor, timestamp, invoice number, and Activity evidence under a serializable row lock.

## Explicitly deferred

- Invoice issuance, due-date and tax confirmation, external delivery, payment recording, automatic collection, WhatsApp, and n8n automation.
