# BOA-03-PREP — Communication Layer Schema (No External Wiring)

## Purpose

Add the database models the WhatsApp foundation (`BATCH_BOA_03`) will need
— `WhatsAppContact`, `Conversation`, `Message`, `MessageTemplate` — without
any provider integration. No webhook route, no outbound send call, no
Twilio/Meta client code, no environment variables read. This batch is
schema and pure logic only, so it can ship and be reviewed while the
company's Meta Business verification and WhatsApp Business API account are
still being set up.

## Important: an anomaly was found and removed during this batch

While editing `prisma/schema.prisma`, a second, different-but-similar copy
of these same models appeared in the file — duplicate `model` and `enum`
declarations, plus stray fields injected into unrelated models (`Client`,
`User`, `ServiceRequest`) that this batch never touched. Some of the
duplicate content even referenced this batch's own internal working names
in its comments. This should not have been possible from a normal edit and
could not be fully explained; it was treated as untrusted, not merged or
reconciled, and removed in full. **The final schema was then rebuilt from a
single, deliberately written and reviewed version.**

Verification performed after cleanup, all passing:

- Every `model` and `enum` name in `prisma/schema.prisma` is declared
  exactly once (`grep -c` per name, and now also enforced by
  `tests/unit/whatsapp-communication.test.ts`'s new schema-integrity test
  — see below).
- Every named Prisma relation (`"ConversationAssignee"`, `"MessageSender"`)
  appears on exactly two sides, as Prisma requires.
- Brace, parenthesis, and bracket counts are balanced across the whole
  file.
- Every foreign-key field has a corresponding back-relation field on the
  model it points to (`Company`, `Lead`, `ClientContact`, `ServiceRequest`,
  `User` were all checked individually).

If anything unexplained like this appears again in this codebase, treat it
the same way: do not build on it or assume good intent, verify from
scratch, and tell the user plainly — which is what this section is doing.

## What changed

- **Schema — new models** (all company-scoped, all additive, no existing
  table altered):
  - `WhatsAppContact` — one row per phone number per company. Optionally
    linked to a `Lead` and/or `ClientContact`, following the same
    "nullable foreign key per possible owner" pattern already used
    elsewhere (e.g. `Task.projectId` / `Task.clientId`) rather than a
    generic polymorphic association.
  - `Conversation` — one thread per `WhatsAppContact`, optionally
    correlated to the `ServiceRequest` that started it via the reference
    code introduced in BOA-02. Has a `status`
    (`OPEN` / `PENDING_HUMAN` / `CLOSED` / `ARCHIVED`) and an optional
    assigned owner.
  - `Message` — individual messages in a conversation. `providerMessageId`
    is nullable and unique per company: BOA-03 itself will decide whether
    it becomes required once inbound webhook idempotency is built, since
    that decision depends on the chosen provider's payload shape.
  - `MessageTemplate` — tracks Meta's per-template pre-approval status
    (`DRAFT` / `PENDING_APPROVAL` / `APPROVED` / `REJECTED`) so a future
    send path can refuse to use a template that was never approved.
- **`src/lib/whatsapp-communication.ts`** (new, pure logic, no I/O):
  - `toWhatsAppPhoneE164()` — reuses the existing
    `normalizeClientContactPhone()` helper rather than introducing a
    second, slightly different phone-normalization rule.
  - `renderMessageTemplate()` — substitutes `{{1}}`, `{{2}}`, ... style
    placeholders, matching Meta's template variable convention, for
    internal preview purposes.
- **`tests/unit/whatsapp-communication.test.ts`**: covers both pure helpers,
  plus the new schema-integrity regression test described above.

## Deliberately unchanged / out of scope

- No webhook endpoint, no outbound send function, no provider SDK or
  client of any kind.
- No values decided yet that depend on which provider is chosen (Twilio
  vs. 360dialog vs. direct Meta Cloud API) — the schema is intentionally
  provider-agnostic; only `BATCH_BOA_03` itself should introduce
  provider-specific code, once an account exists to build against.
- `Message.providerMessageId` is left nullable for now — tightening it to
  required (with the idempotency guarantees that implies) is a `BATCH_BOA_03`
  decision, not this one.

## Migration

Adds four new tables and their indexes — no existing table is altered, no
backfill needed. Run locally before merging:

```
npx prisma migrate dev --name boa03_prep_communication_schema
```

## Quality gates

- `npm run check` was not run in this environment (no database or Prisma
  engine access here) — run it locally as with the prior BOA batches.
- Pay particular attention to `npx prisma validate` (part of
  `prisma generate`) succeeding cleanly given the anomaly described above —
  if it fails with a duplicate-model or missing-opposite-relation error,
  stop and compare against this document before editing further.

## Next batch

- `BATCH_BOA_03` — the actual WhatsApp foundation: provider account
  wiring, inbound webhook, outbound send, and the handler that resolves an
  inbound message to a `WhatsAppContact` and, where a reference code is
  present, a `ServiceRequest`. Blocked on Meta Business verification and a
  WhatsApp Business API account (Twilio recommended, per the
  provider comparison discussed with the user) being ready.
