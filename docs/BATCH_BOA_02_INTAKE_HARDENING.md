# BOA-02 — Website Intake Bridge Hardening

## Purpose

The website→core intake bridge (`/api/public/service-requests`) was already
solid before this batch: secret-protected, rate-limited, idempotent with a
`P2002` race-condition fallback, and it creates the Lead transactionally.
The audit for this batch found nothing broken there — the actual gap was
narrower: **the bridge had no way to hand a customer off to WhatsApp with
enough context for Phase 2 to later correlate the conversation back to this
specific request.**

This batch adds exactly that hand-off, and nothing else. It does not touch
WhatsApp itself — no message sending, no webhook, no `Conversation` model.
That remains `BATCH_BOA_03`.

## What changed

- **Schema:**
  - `ServiceRequest.referenceCode` (nullable `String`, `@@unique([companyId, referenceCode])`) —
    a short, human-typeable code such as `AQ-7F3K9Q`, generated for every
    new service request.
  - `Company.whatsappBusinessNumber` (nullable `String`) — the company's
    WhatsApp number, so the redirect link is generated server-side from one
    source of truth instead of being hardcoded on the website.
- **`src/lib/service-request-intake.ts`** (new, pure logic, no database):
  - `generateServiceRequestReferenceCode()` — 6 characters from a 32-symbol
    alphabet that excludes visually ambiguous characters (`0/O`, `1/I/L`),
    since a customer may read this off a screen and type it into WhatsApp.
  - `isValidServiceRequestReferenceCode()` — format guard.
  - `buildWhatsAppRedirectUrl()` — builds a `wa.me` deep link with the
    reference code pre-filled in the message text. Returns `null` when the
    company has no WhatsApp number configured yet, or the configured
    number is too short to be real — callers must handle a `null` redirect
    (the website should fall back to its own contact flow) rather than
    send customers to a broken link.
- **`src/app/api/public/service-requests/route.ts`:** every response path
  (fresh creation, idempotency-key replay, and the `P2002` race-condition
  replay) now returns `referenceCode` and `whatsappRedirectUrl` alongside
  the existing `serviceRequestId` / `leadId` / `replayed` fields.

## Why a reference code instead of matching on phone number alone

A customer can message the business WhatsApp number from a different phone
than the one they typed into the website form (shared phones, business
lines, typos). The reference code is a second, more reliable correlation
key: when Phase 2 builds the inbound WhatsApp webhook, it can look up the
`ServiceRequest` by `referenceCode` parsed from the pre-filled message text,
falling back to phone matching only if the customer edited the message
before sending.

## Deliberately unchanged / out of scope

- No collision-retry logic for `referenceCode` generation. The alphabet and
  length give roughly 1 billion combinations per company; a collision would
  surface as an ordinary `P2002` error on `@@unique([companyId,
referenceCode])` and fail the request rather than silently retry. This is
  an accepted, documented trade-off to keep this batch small — revisit only
  if collisions are ever observed in practice.
- No admin UI to set `Company.whatsappBusinessNumber` yet. It must be set
  directly in the database (or via a future settings-page batch) until then
  — with it unset, `whatsappRedirectUrl` is simply `null` and existing
  website integrations are unaffected.
- No change to how the website currently uses the response — the new
  fields are additive; nothing existing was removed or renamed.

## Migration

Adds two nullable columns and one unique index — no backfill needed for
existing rows (`referenceCode` stays `null` on historical service
requests). Run locally before merging:

```
npx prisma migrate dev --name boa02_intake_reference_code
```

## Quality gates

- `npm run check` was not run in this environment (no database or Prisma
  engine access here) — run it locally as with BOA-01.
- `tests/unit/service-request-intake.test.ts` covers the pure logic
  (reference-code format and character exclusions, URL construction,
  percent-encoding of Arabic text, and the `null` fallback paths) without
  touching the database, consistent with this project's existing test
  style.
- Manual verification recommended: submit a test website intake request
  twice with the same `Idempotency-Key` header and confirm both responses
  return the same `referenceCode`; set a test
  `Company.whatsappBusinessNumber` and confirm the returned
  `whatsappRedirectUrl` opens WhatsApp with the reference code visible in
  the pre-filled message.

## Next batch

- `BATCH_BOA_03` — WhatsApp foundation: inbound webhook, outbound send,
  and the handler that looks up a `ServiceRequest` by the reference code
  parsed from an inbound message.
