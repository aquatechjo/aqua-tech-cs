# PORTAL-02 — Unified Client Portal (Proposals)

## Purpose

Add proposals to the unified client portal from `PORTAL-01`, which
previously only listed invoices. This is the join `PORTAL-01`'s
documentation flagged as the deepest and most complex:
`Client → Lead → IntakeSession → ProposalWorkspace → ProposalDelivery`.

## Scope decision: read-only in this batch

Proposal responses (accept / request changes / reject) are recorded
through a write path that locks the specific `ProposalDelivery` row by
its own `tokenHash` (`loadPublicProposalForUpdate`, a raw `FOR UPDATE`
query keyed to that hash). The unified portal authenticates with a
_different_ token (`ClientPortalAccess`, not `ProposalDelivery`'s own),
so routing a formal accept/reject decision through the portal safely
would mean changing how that locking and audit trail works — a real
design decision, not something to fold into a "just add proposals to the
list" batch.

**`PORTAL-02` is read-only**: the client can open a proposal from the
portal and read its full content (sections, payment milestones, total),
but the page explicitly tells them to use the emailed
`/proposal/[token]` link to formally respond. That existing flow is
completely unchanged. Making the response itself portal-native is left
as an explicit follow-up once the locking question above has been
thought through on its own.

## What changed

- **`src/lib/client-portal-server.ts`**:
  - `findClientPortalByToken` now also loads each of the client's leads →
    intake session → proposal workspace → latest delivery, and filters to
    the ones that are actually active using the **existing**
    `isProposalPublicAccessActive` pure-logic check from
    `proposal-delivery.ts` — the exact same rule the standalone
    `/proposal/[token]` page uses, not a second, slightly different one.
  - `findClientPortalProposal(token, workspaceId)`: given a portal token
    and a workspace id, re-derives the client from the token, then looks
    up that workspace's latest `ProposalDelivery` **scoped to
    `intakeSession.lead.clientId` matching the token's own client** — a
    portal token can only ever reach proposals belonging to its own
    client, never another one by guessing an id. Reuses the existing
    `publicProposalDeliverySelect` and `serializePublicProposal` so the
    content shown is identical to what the standalone page would show,
    not a re-derived approximation.
- **`src/app/portal/[token]/page.tsx`**: now lists active proposals above
  the invoice list.
- **`src/app/portal/[token]/proposals/[workspaceId]/page.tsx`** (new):
  read-only proposal view — title, sections, payment milestones, total,
  validity date, and a clear note pointing to the emailed link for a
  formal response.

## Deliberately unchanged / out of scope

- **No accept/reject/change-request action in the portal** — see the
  scope decision above.
- **The standalone `/proposal/[token]` flow is completely untouched** —
  same page, same API routes, same locking. The portal is a second way to
  _read_ the same data, not a replacement.
- **Feedback and discovery are still not in the portal** — `PORTAL-03`.
- No dashboard UI to preview which proposals will show up in a client's
  portal before issuing access — same UI deferral as `PORTAL-01`/`FIN-01`.

## Migration

None — this batch adds no schema changes, only new queries and pages
against existing tables.

## Quality gates

- `npm run check` was not run in this environment — run it locally.
- Manual verification recommended: for a client with an actively
  delivered proposal (status `SENT`, not expired/revoked, matching
  content hash), confirm it appears in `/portal/[token]` and opens with
  full content at `/portal/[token]/proposals/[workspaceId]`; confirm a
  proposal belonging to a _different_ client's workspace id returns "not
  available" rather than leaking content.

## Next batch

- `PORTAL-03` — feedback and discovery.
- Revisit making proposal responses portal-native once the
  `ProposalDelivery`-token-locking question has its own design pass.
