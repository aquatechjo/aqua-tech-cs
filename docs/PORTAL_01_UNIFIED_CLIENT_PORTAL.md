# PORTAL-01 — Unified Client Portal (Invoices)

## Purpose

The original "unify the client portal" goal was to give a client one
durable link instead of a separate one-off link per document. This batch
delivers the first, smallest working version of that: one revocable
`ClientPortalAccess` token per client, landing on a page that lists their
invoices. Proposals, feedback, and discovery are staged as `PORTAL-02` /
`PORTAL-03` because each reaches the client through a deeper, different
relation chain (proposal is four joins away from `Client`; feedback and
discovery are each their own shape) — bundling all four into one batch
would have made this too large to review or roll back safely.

## A design correction made while building this

The first draft tried to have the portal page link directly to the
existing `/invoice-portal/[token]` URLs (from `FIN-01`) using each
invoice's `publicTokenHash`. That does not work and was caught before
shipping: **only the hash of that token is ever stored — the raw token
itself is shown once at issuance and is not retrievable afterward**, by
design, the same way a password hash can't be turned back into the
password. There was no raw token to link to.

The fix: the unified portal does not reuse the per-invoice public link at
all. Instead, `ClientPortalAccess`'s own token is the only credential
needed — a portal-scoped route
(`/portal/[token]/invoices/[invoiceId]`) re-validates that token, confirms
the requested invoice actually belongs to that token's client, and renders
the invoice directly. The invoice-rendering markup itself was extracted
into a shared `InvoiceDocumentView` component so both this route and the
original `/invoice-portal/[token]` page render identically without
duplicated JSX.

## What changed

- **Schema**: new `ClientPortalAccess` model — one row per client
  (`clientId @unique`), a nullable hashed `tokenHash` (nullable so revoking
  can cleanly clear it to `null` instead of needing a placeholder value),
  `revokedAt`, and access-count/last-accessed tracking. Unlike every other
  token in this codebase, this one is durable and reusable, not single-use
  — that's the point of a portal versus a document link.
- **`src/lib/client-portal.ts`** (pure logic): token format and active-state
  check.
- **`src/lib/client-portal-server.ts`**: `createClientPortalAccess`,
  `findClientPortalByToken` (loads the client plus their ISSUED /
  PARTIALLY_PAID / PAID invoices, row-locked and `Serializable` like every
  other public lookup in this codebase), `findClientPortalInvoice` (the
  per-invoice re-validation used by the detail route).
- **`src/app/api/clients/[id]/portal-access/route.ts`**: `ISSUE` / `REVOKE`,
  same auth/role/origin pattern as every other management route.
- **`src/app/portal/[token]/page.tsx`**: the portal landing page — company
  name, greeting, invoice list.
- **`src/app/portal/[token]/invoices/[invoiceId]/page.tsx`**: renders one
  invoice, reusing `InvoiceDocumentView`.
- **`src/components/aqua/InvoiceDocumentView.tsx`** (new, extracted):
  shared invoice document markup, now used by both the standalone
  `/invoice-portal/[token]` page and the portal's invoice detail route.
- **Two new `ActivityAction` values**: `CLIENT_PORTAL_ACCESS_ISSUED`,
  `CLIENT_PORTAL_ACCESS_REVOKED` (with activity-log labels — the exact
  step missed in `FIN-01` the first time, not missed here).

## Deliberately unchanged / out of scope

- **`FIN-01`'s per-invoice public link is untouched** and still works
  standalone — a finance person can still issue a one-off invoice link
  without involving the client portal at all. The two features are
  independent; the portal simply doesn't need the per-invoice link's token
  to show the same invoice.
- **No dashboard UI button** to issue/revoke a client's portal access yet
  — same reasoning as `FIN-01`: touching the client detail page means
  respecting the Aqua Design System's visual-contract tests, deliberately
  left for a follow-up.
- **Proposals, feedback, and discovery are not in the portal yet** —
  `PORTAL-02` and `PORTAL-03`.
- **No expiry on the portal token itself**, only revocation — a document
  link expires because it's meant to be single-use; a portal is meant to
  be returned to. If this turns out to need expiry later, it's an additive
  change (add `expiresAt`, check it in `clientPortalIsActive`).

## Migration

Adds one new table (`ClientPortalAccess`) and two nullable-safe indexes —
no existing table altered. Run locally before merging:

```
npx prisma migrate dev --name portal01_unified_client_portal
```

## Quality gates

- `npm run check` was not run in this environment — run it locally.
- Manual verification recommended: issue portal access for a client with
  at least one ISSUED invoice, open `/portal/[token]`, confirm the invoice
  list appears and clicking one renders the same invoice correctly; revoke
  access and confirm the portal immediately stops working.

## Next batch

- `PORTAL-02` — add proposals to the portal (the deepest join: `Client` →
  `Lead` → `IntakeSession` → `ProposalWorkspace`).
- `PORTAL-03` — add feedback and discovery.
- Dashboard UI for issuing/revoking client portal access.
