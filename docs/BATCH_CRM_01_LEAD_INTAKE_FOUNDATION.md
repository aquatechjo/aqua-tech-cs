# CRM-01 — Lead Intake Foundation

## Goal

Create one canonical lead qualification record for every service request while
preserving the existing intake snapshot and sales opportunity history.

## Included

- Adds a dedicated `Lead` model and controlled `LeadStatus` lifecycle.
- Links each lead one-to-one with its originating `ServiceRequest`.
- Links sales opportunities to their originating lead.
- Captures source, campaign, owner, priority, completion score, contact consent,
  next action, qualification milestones, and normalized identity fields.
- Assigns new website leads to the oldest active Sales Manager, then falls back
  to the System Owner when no Sales Manager exists.
- Records a possible duplicate candidate when email or phone matches an active
  lead. This is a review hint only; CRM-01 does not auto-merge or auto-reject.
- Creates the lead in the same database transaction as manual or website
  intake, so partial intake records cannot be left behind.
- Synchronizes lead identity, ownership, status, and completion when the
  originating request is edited or converted.
- Keeps lead, request, client, project, and opportunity links consistent when
  either service-request conversion or opportunity conversion is used.
- Keeps website idempotency behavior and returns the stable `leadId` on both new
  and replayed requests.
- Backfills one lead for every existing service request and connects historical
  sales opportunities.

## Deliberate boundaries

- `ServiceRequest` remains the immutable intake snapshot.
- `Lead` owns qualification, ownership, completeness, consent, and duplicate
  review.
- `SalesOpportunity` remains the commercial pipeline after handoff.
- CRM-01 does not add a new Lead screen or change the current navigation.
- CRM-01 does not merge people automatically. Human review is required.
- Company and contact master records are not introduced in this batch.

## Data migration

Migration:

`20260729190000_crm_01_lead_intake_foundation`

The migration is additive. Existing service requests, clients, opportunities,
projects, and proposals remain in place.

## Intake additions

Both internal and website intake accept optional:

- `campaign`
- `contactConsent`

The public response additionally returns:

- `leadId`

Existing callers remain compatible because existing response keys are
unchanged.

## Acceptance criteria

- Every new manual or website request creates exactly one lead transactionally.
- Idempotent website retries return the original request and lead identifiers.
- Existing service requests receive a lead during migration.
- Existing opportunities are linked to the backfilled lead.
- Normalized email and phone can support duplicate-candidate review without
  silently merging records.
- Completion score is deterministic and constrained to `0..100`.
- Prisma generation, lint, typecheck, unit tests, and production build pass.

## Deployment order

1. Apply the CRM-01 source files.
2. Run `npm install`.
3. Run `npm run check`.
4. Run `npm run db:deploy`.
5. Run `npx prisma migrate status`.
6. Commit only after every step succeeds.
