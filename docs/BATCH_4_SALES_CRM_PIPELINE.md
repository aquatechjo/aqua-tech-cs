# Batch 4 — Sales CRM & Pipeline

Batch 4 turns AquaFlow's service-request intake into a controlled internal sales
pipeline. It covers the commercial handoff from first contact through proposals,
follow-ups, win/loss recording, and conversion into an operational client and
project.

It is an internal CRM layer. It does not send email or WhatsApp messages by
itself, generate legal contracts, or replace external marketing automation.
Those channels can integrate with the APIs in later batches.

## Included

- Added tenant-scoped sales opportunities linked to service requests, clients,
  projects, owners, activities, and commercial proposals.
- Added pipeline stages: new, discovery, qualified, proposal, negotiation,
  on-hold, won, and lost.
- Added expected value, probability, weighted value, expected close date,
  next follow-up, last contact, and loss reason.
- Added planned and completed sales activities for calls, WhatsApp, email,
  meetings, follow-ups, and notes.
- Added versioned proposal records with stable yearly numbers such as
  `PROP-2026-0001`.
- Locked commercial proposal fields after sending. A changed commercial offer
  must be recorded as a new version instead of silently rewriting history.
- Added sales dashboard cards for open pipeline, weighted pipeline, follow-ups,
  stale opportunities, wins, losses, and win rate.
- Added a stage-based pipeline board and a detailed opportunity workspace.
- Added idempotent creation of an opportunity from a service request.
- Added controlled opportunity conversion that creates or links the client and
  project in one transaction and records the win.
- Updated direct service-request conversion so it also creates or closes the
  corresponding opportunity, preserving CRM consistency.
- Backfilled existing service requests into opportunities during migration.
- Added sales activity actions to the audit log and unit coverage for stage,
  proposal, follow-up, stale, timezone, and permission rules.

## Permissions

- `OWNER`, `ADMIN`, `SALES_MANAGER`, and `OPERATIONS_MANAGER` can read the sales
  pipeline.
- `OWNER`, `ADMIN`, and `SALES_MANAGER` can create and update opportunities,
  activities, proposals, losses, and conversions.
- `OPERATIONS_MANAGER` receives read access for project-handoff visibility but
  cannot mutate the commercial pipeline.
- `FINANCE_MANAGER` and `MEMBER` do not receive company-wide sales access.

Job titles and departments remain organizational metadata. Access roles are the
security boundary.

## Sales controls

- All opportunity, activity, proposal, service-request, client, project, and
  owner references are checked within the authenticated company.
- Pipeline values use the company currency so dashboard totals remain valid.
- Probability must be a whole percentage between 0 and 100.
- A lost opportunity requires a reason, records the loss timestamp once, and
  clears obsolete follow-up reminders.
- A won opportunity cannot be set through a normal stage edit. It must use the
  conversion endpoint so a client and project are created or linked atomically.
- Opportunity conversion is lock-protected and replay-safe. Won commercial
  fields remain locked after the client/project handoff.
- Planned activities require a schedule; completed contact activities update
  the opportunity's last-contact timestamp.
- The next follow-up is recalculated from the earliest planned activity.
- Proposal status follows a controlled lifecycle: draft, sent, accepted,
  rejected, or cancelled.
- Sent proposals cannot have their commercial amount, title, validity, or URL
  rewritten. Create a new version for a changed offer. Proposal status also
  cannot be changed after the opportunity itself is closed.
- Proposal expiry is derived from the company business timezone without a cron
  mutation.

## Metrics

- **Pipeline value:** total expected value of open opportunities.
- **Weighted value:** each open opportunity value multiplied by its probability.
- **Win rate:** won opportunities divided by won plus lost opportunities.
- **Stale opportunity:** an open opportunity with no contact or update for at
  least seven days.
- **Follow-up buckets:** overdue, today, upcoming, or none, calculated using the
  company timezone.

## Application order

1. Start from the clean Batch 3 commit `cfe87db`.
2. Extract the Batch 4 ZIP over the AquaFlow project root.
3. Run `npm install`.
4. Run `npm run check` before changing the database.
5. Run `npm run db:deploy` after the complete code gate passes.
6. Test `/dashboard/sales`, creation from a service request, proposal sending,
   follow-up completion, loss recording, and won conversion locally.
7. Commit locally. Do not push until all planned AquaFlow batches are complete.

Do not edit migrations from Batches 0–3. Batch 4 is an additional forward-only
migration.
