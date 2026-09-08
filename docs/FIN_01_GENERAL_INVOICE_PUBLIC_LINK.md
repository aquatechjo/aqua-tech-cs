# FIN-01 — General Invoice Public Link

## Purpose

While preparing to "unify the client portal," the audit found the actual
gap was bigger than expected: **regular invoices had no client-facing
delivery mechanism at all.** Every invoice-related public page
(`/invoice/[token]`), API route (`/api/finance/invoices/[id]/portal`,
`.../delivery`, `.../reminder`), and email template
(`sendAmendmentInvoiceDeliveryEmail` and siblings) existed only for
invoices tied to a `ProjectContractAmendment` — a narrower case (contract
change-order invoices) than the everyday case (a normal project invoice).
A regular invoice could only be viewed internally by an authenticated
staff member; there was no way to hand a client a link to it.

This batch closes that gap for regular invoices, reusing the amendment
portal's proven security pattern rather than inventing a new one.

## What changed

- **Schema — `Invoice` model**: added `publicTokenHash` (unique),
  `publicExpiresAt`, `publicIssuedAt`, `publicRevokedAt`,
  `publicFirstViewedAt`, `publicLastViewedAt`, `publicViewCount`. These
  live directly on `Invoice`, not on `ProjectContractAmendment` — this
  path is for invoices that do **not** have a linked amendment.
- **`src/lib/invoice-public-link.ts`** (pure logic): token format,
  expiry, link path (`/invoice-portal/[token]`, deliberately a different
  path from the amendment invoice's `/invoice/[token]` so the two features
  stay fully independent), and the issuance guard
  (`invoicePublicLinkIssues`) — which explicitly **blocks** any invoice
  that already has a `ProjectContractAmendment`, so the two portal systems
  never compete for the same invoice.
- **`src/lib/invoice-public-link-server.ts`**: token creation and lookup,
  copying the amendment portal's transaction shape exactly — row lock via
  `FOR UPDATE`, `Serializable` isolation, hash-only storage, first-view
  activity logging.
- **`src/app/api/finance/invoices/[id]/public-link/route.ts`**: `ISSUE` /
  `REVOKE` actions, same auth/role/origin checks as every other finance
  mutation route in this codebase.
- **`src/app/invoice-portal/[token]/page.tsx`** + `PublicInvoiceLinkActions.tsx`:
  the public-facing invoice document, reusing `AquaSystemDocument` the
  same way the amendment invoice page does.
- **Three new `ActivityAction` values**: `INVOICE_PUBLIC_LINK_ISSUED`,
  `INVOICE_PUBLIC_LINK_REVOKED`, `INVOICE_PUBLIC_LINK_VIEWED`.

## Deliberately unchanged / out of scope

- **No dashboard button yet.** Issuing a link today means calling
  `POST /api/finance/invoices/[id]/public-link` directly (e.g. from an
  API client) — there is no UI trigger on the invoice detail page. Adding
  one means touching `InvoiceDetailClient.tsx` under this project's Aqua
  Design System governance, which has its own visual-contract tests
  (`UI-13`, `DS-04`, etc.) that a change made without reading the design
  system rules could break. That UI addition is intentionally left as a
  fast-follow, not bundled into this batch.
- **No email delivery, no payment reminders** for the general link —
  the amendment invoice portal has both (`sendAmendmentInvoicePortalDeliveryEmail`,
  scheduled reminders); this batch only issues a link finance can copy and
  send manually (WhatsApp, email, however they reach the client today).
  Matches the same scope boundary BOA-02 used for the website→WhatsApp
  handoff: return something usable, let a human decide how to send it,
  automate the sending itself later if it proves worth it.
- **The amendment invoice portal is untouched.** Nothing about
  `/invoice/[token]`, `ProjectContractAmendment`'s portal fields, or its
  email/reminder flow changed. The two systems are intentionally
  independent so this batch carries zero regression risk to the
  well-tested amendment flow.
- **The two client-facing invoice URLs will look inconsistent** to
  someone comparing them side by side (`/invoice/[token]` for amendments,
  `/invoice-portal/[token]` for everything else) until a later batch
  unifies them — which is now a smaller, better-informed version of the
  original "unify the client portal" task this one grew out of.

## Migration

Adds nullable columns and one unique index to `Invoice` — no backfill,
no existing behavior altered. Run locally before merging:

```
npx prisma migrate dev --name fin01_invoice_public_link
```

## Quality gates

- `npm run check` was not run in this environment — run it locally.
- CI (`INFRA-01`) will now also verify this on every push once merged.
- Manual verification recommended: issue a public link for a normal
  ISSUED invoice via the API, confirm the page renders at
  `/invoice-portal/[token]`, confirm issuing a link for an invoice that
  **does** have a `contractAmendment` is rejected with
  `INVOICE_PUBLIC_LINK_BLOCKED`.

## Next batch

- Add the dashboard UI trigger for this feature (issue/revoke buttons,
  copyable link, view count) on the invoice detail page, following the
  Aqua Design System's existing finance-workspace contract.
- Revisit the original Client Portal unification goal now that all four
  artifact types (proposal, feedback, discovery, invoice) have a working
  general-purpose public link.
