# PROJ-19 — Governed Amendment Invoice Document

Status: implemented

## Scope

- Expose a dedicated print-ready amendment invoice document only to authenticated Finance readers in the same tenant.
- Require a linked, non-cancelled issued invoice with complete issuance, due-date, reference, and tax evidence.
- Render the frozen invoice lines, amendment reference, client, Project, totals, payment summary, notes, and terms through the canonical Aqua system-document contract.
- Keep the document no-index and separate from the internal dashboard shell, with an explicit browser print / save-PDF action.

## Explicitly deferred

- Server-generated binary PDF attachments, a public invoice portal, online collection, payment reminders, WhatsApp, and n8n automation.
