# UI-01 — Dashboard Triggers for Invoice Links and Client Portal Access

## Purpose

`FIN-01` and every `PORTAL-*` batch deliberately shipped without a
dashboard button, each time for the same reason: touching this
codebase's UI means respecting the Aqua Design System's governed
conventions, and that needed its own careful pass rather than being
folded into a backend-focused batch. This batch is that pass — it adds
no new backend behavior, only UI triggers for APIs that already existed
and were already fully tested.

## What changed

- **`src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx`**
  (+ `page.tsx`): a new "رابط الفاتورة العام" panel, shown only for
  regular invoices (`!invoice.contractAmendment`) that are `ISSUED` /
  `PARTIALLY_PAID` / `PAID`, with issue/rotate and revoke buttons. Built
  by copying the existing amendment-invoice portal panel's exact markup
  and interaction pattern (same `aqua-card`/`AquaAlert`/button classes,
  same fetch-then-`router.refresh()` flow), then pointed at the `FIN-01`
  `public-link` endpoint instead of the amendment `portal` endpoint. The
  two panels are mutually exclusive per invoice — an amendment invoice
  never sees the new panel and vice versa, so there is no way to issue
  two competing links for the same invoice from the dashboard.
- **`src/app/dashboard/clients/[id]/ClientContactsClient.tsx`** (+
  `page.tsx`): a new "بوابة العميل" panel on the client detail page —
  status (active/inactive, issued date, access count, last access) plus
  issue/rotate and revoke buttons, calling the `PORTAL-01`
  `portal-access` endpoint. Built using this file's actual component
  library (`AquaDataPanel`, `AquaButton`, `AquaAlert`) rather than the
  raw Bootstrap classes used in the finance area, because that is the
  established convention in this specific file — the two areas of the
  app use different conventions and this batch matched each one rather
  than picking one style for both.
- **Both server `page.tsx` files** now select and serialize the
  additional fields their client component needs. The client portal's
  "active" flag is computed with the **existing** `clientPortalIsActive`
  pure function from `client-portal.ts` — the same one the public portal
  lookup itself uses — rather than a second, independently-written check
  that could drift from it over time.

## Deliberately unchanged / out of scope

- No delivery-by-email or reminder scheduling in either new panel — this
  matches `FIN-01`'s and `PORTAL-01`'s own scope decision: issue a link,
  let staff copy and send it themselves. The amendment invoice panel's
  email delivery section is a separate, older feature this batch does
  not extend to the new panels.
- No preview of _what_ will appear in a client's portal before issuing
  access (which invoices, proposals, etc.) — the panel only manages the
  access token itself. A preview would need its own aggregation query
  and is better scoped as its own small addition later if it turns out
  to be needed.
- No change to either underlying API route (`FIN-01`'s `public-link`,
  `PORTAL-01`'s `portal-access`) — both were already complete and tested;
  this batch only gives staff a way to call them without a raw HTTP
  client.

## Migration

None — no schema changes. Both server pages now select a few additional
already-existing columns.

## Quality gates

- `npm run check` was not run in this environment — run it locally. Pay
  particular attention to `ds:check`, since this is the first batch in
  this session to edit files the Aqua Design System governs directly
  (`ClientContactsClient.tsx` uses governed `Aqua*` components).
- `tests/unit/dashboard-portal-triggers.test.ts` guards two things
  structurally: that the invoice link panel is gated to non-amendment
  invoices, and that the client portal panel reuses
  `clientPortalIsActive` instead of a second copy of that logic.
- Manual verification recommended: on a regular (non-amendment) issued
  invoice, issue a link and confirm it opens at `/invoice-portal/[token]`;
  on a client, issue portal access and confirm `/portal/[token]` shows
  their data; revoke both and confirm the "issue" button reappears in
  place of "revoke".
