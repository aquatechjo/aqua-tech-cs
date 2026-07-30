# PROP-02 — Secure Proposal Delivery and Client Decisions

## Outcome

PROP-02 delivers an explicitly approved central Proposal to the customer and
records the customer's response against the exact immutable Proposal version
they received.

The batch supports email, a manually shared secure link, and a prepared
WhatsApp message. It records views, requested changes, acceptance, rejection,
the responder identity, and the authority confirmation required for a binding
commercial response.

PROP-02 does not create a contract, invoice, workflow, or project. An accepted
Proposal becomes eligible for the independently governed PROJ-01 handoff.

## Operating surfaces

- `/dashboard/proposals` is the tenant-scoped operational queue.
- `/dashboard/discovery/[id]/proposal` adds a dedicated delivery and response
  tab to the authoring and review workspace.
- `/proposal/[token]` is the client-safe, no-index, no-referrer review page.
- The public page presents the exact client projection already hashed by
  PROP-01; it never rebuilds commercial data from browser input.

## Delivery contract

Only an `APPROVED` Proposal version can be prepared for delivery. Each delivery
stores:

- company and Proposal workspace;
- exact Proposal version;
- exact client projection hash;
- delivery channel and recipient snapshot;
- SHA-256 hash of a 256-bit opaque access token;
- preparation, send, expiry, revocation, and view timestamps;
- provider message identifier or bounded failure details.

The raw token is never stored in the database, activity log, or legacy
proposal snapshot. It is returned once when a manual link or WhatsApp message
is prepared.

Email is finalized as sent only after the provider accepts the message.
Secure-link and WhatsApp delivery use two explicit steps:

1. prepare the channel and receive the one-time URL;
2. share it outside the system, then confirm delivery.

Confirming a new delivery revokes earlier active and prepared links for the
same Proposal workspace.

## Public access controls

- Tokens use 32 cryptographically random bytes and a URL-safe encoding.
- Database lookup uses only the token hash.
- Access requires a `SENT`, non-revoked, non-expired delivery.
- Delivery version and client hash must equal the workspace's sent version and
  sent client hash.
- Expiry is evaluated using the company's local calendar date.
- Public response requests use same-origin checks, bounded bodies, a
  token-and-IP rate limit, row locks, and transactions.
- The page sets `noindex`, `nofollow`, `nocache`, and `no-referrer`.
- Saving a later human version makes the previous public link inactive until
  the new version completes review and delivery.

## Client-safe boundary

The customer sees:

- approved client narrative sections;
- approved client commercial lines and totals;
- payment milestones;
- estimated duration, validity, and client notes;
- the issuing company contact details.

The customer never receives:

- unit cost or internal cost;
- gross profit or margin;
- internal sections or notes;
- raw Discovery answers or conversations;
- internal Pricing data;
- activity, reviewer, or employee data.

## Client decisions

Available decisions:

- `ACCEPTED`
- `CHANGES_REQUESTED`
- `REJECTED`

Every decision stores the exact Proposal version and client hash plus responder
name, email, optional title, notes, IP address, user agent, timestamp, and the
confirmed-authority statement version.

Requesting changes and rejecting require meaningful notes. Acceptance,
requesting changes, and rejection all require an explicit confirmation that
the responder is authorized to act for the customer.

One immutable response is accepted per Proposal version. Replayed requests
return the recorded result instead of creating a second decision.

## State transitions

Internal review remains:

`DRAFT → IN_REVIEW → APPROVED`

Delivery and customer response add:

`APPROVED → SENT`

`SENT → CLIENT_CHANGES_REQUESTED`

`SENT → ACCEPTED`

`SENT → REJECTED`

After customer-requested changes, an authorized author saves a new immutable
version, returning the workspace to `DRAFT` and restarting human review.

Revoking the active sent link before a response returns the workspace to
`APPROVED`. Revoking a separate prepared link does not alter an already sent
Proposal.

## Pipeline effects

Confirmed delivery:

- creates or updates the compatible `SalesProposal` snapshot;
- moves an eligible opportunity to `PROPOSAL`;
- updates value, last contact, and follow-up;
- keeps the managed central Proposal as the source of truth.

Client acceptance:

- records the central response;
- marks the compatible snapshot accepted;
- moves the opportunity to `NEGOTIATION` at 90%;
- prepares the Lead and Service Request for PROJ-01.

Client change request:

- returns the Proposal to authoring;
- keeps the opportunity in negotiation;
- creates an immediate internal follow-up.

Client rejection:

- requires and stores a reason;
- marks the compatible snapshot rejected;
- closes the opportunity as `LOST` with the reason.

No decision creates a project. The existing opportunity conversion route
explicitly blocks managed central Proposals, including accepted ones, until
PROJ-01 implements the governed client/project/workflow handoff.

## Permissions

| Capability | Roles |
| --- | --- |
| Read Proposals | Owner, Admin, Sales Manager, Operations Manager, Finance Manager |
| Create and revise versions | Owner, Admin, Sales Manager |
| Review and approve | Owner, Admin, Sales Manager |
| Prepare, send, confirm, and revoke delivery | Owner, Admin, Sales Manager |

Finance and Operations can inspect Proposal state without receiving delivery
mutation rights or raw Discovery access.

## Configuration

Secure-link and WhatsApp preparation require:

- `APP_ORIGIN`, mandatory in production and used to build the public URL.

Direct email also requires:

- `RESEND_API_KEY`;
- `PROPOSAL_FROM`, configured with a verified sender.

Email configuration is independent of `PASSWORD_RESET_FROM`.

## Verification

- Prisma generation and additive migration validation.
- Design System package synchronization.
- ESLint with zero warnings.
- TypeScript and Next route type generation.
- Unit coverage for token shape, exact-version and hash binding, local-date
  expiry, response authority, required reasons, WhatsApp normalization,
  tenant scoping, row locks, audit events, public privacy, no raw token
  persistence, and the PROJ-01 conversion boundary.
- Production build.
