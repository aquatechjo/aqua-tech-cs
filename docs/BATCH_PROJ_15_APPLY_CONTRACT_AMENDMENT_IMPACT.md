# PROJ-15 — Apply Contract Amendment Impact

Status: implemented

## Scope

- Apply an accepted contract amendment to the Project budget and due date only through an explicit manager action.
- Require an application reference and preserve before/after budget and due-date snapshots.
- Lock both the amendment and Project rows and reject duplicate application.
- Require an existing Project budget, matching ISO currency, and an existing due date when the schedule delta is non-zero.
- Record the actor, timestamp, reference, and Activity evidence.

## Explicitly deferred

- Invoice generation, payment records, notifications, external delivery, WhatsApp, and n8n automation.
