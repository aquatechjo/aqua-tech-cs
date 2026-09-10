# PORTAL-03 — Unified Client Portal (Feedback + Discovery)

## Purpose

Add the last two artifact types to the unified client portal: project
feedback and discovery sessions. With this batch all four types from the
original "unify the client portal" goal (proposal, invoice, feedback,
discovery) are represented in one place.

## Scope decision: status only, same reasoning as PORTAL-02

Both feedback and discovery are, at their core, **interactive flows**:
feedback is a scoring form the client fills out once
(`/api/public/feedback/[token]`, locked to that feedback row's own
`tokenHash`); discovery is a multi-turn conversational Q&A
(`/discovery/[token]`) with its own session state machine. Rebuilding
either interactive flow inside the portal would mean the same kind of
token-locking redesign `PORTAL-02` deliberately deferred for proposals —
so this batch applies the identical policy: **the portal shows status
only**, and links out to the existing dedicated pages for anything
requiring actual input.

- **Discovery**: shows one line per non-archived session with its status
  (in progress / needs info from you / under internal review / complete).
  No question-and-answer content, no link into the conversation itself —
  discovery sessions aren't normally re-visited by the client once
  started, so a status line is what's actually useful here, not a link.
- **Feedback**: shows one line per project with an active, non-waived
  feedback record. If a submission is still pending (token active, not
  yet submitted), it tells the client to check their email for the link
  — it does **not** embed the scoring form. If already submitted, it
  shows a simple thank-you acknowledgment instead of re-exposing the
  score or any internal follow-up detail.

## What changed

- **`src/lib/client-portal-server.ts`**: `findClientPortalByToken` now
  also loads:
  - `client.projects[].feedback` — filtered to non-`WAIVED` records only,
    since a waived feedback request was an internal decision the client
    was never meant to see in the first place.
  - `client.leads[].intakeSession` — filtered to non-`ARCHIVED` sessions.
  - Only display-safe fields are selected for feedback (no
    `followUpAction`, `followUpDueAt`, `ownerId`, or any other internal
    field) — `npsScore` / `satisfactionScore` are read from the query but
    deliberately **not rendered** on the page; keeping them in the
    returned object costs nothing and makes them available if a future
    batch wants to show the client their own past score, without a
    second query.
- **`src/app/portal/[token]/page.tsx`**: two new sections, "جلسات
  الاكتشاف" and "تقييم المشاريع", following the same list-item pattern as
  the existing proposal and invoice sections.

## Deliberately unchanged / out of scope

- No interactive feedback submission or discovery Q&A inside the portal —
  see the scope decision above. Both existing standalone flows
  (`/feedback/[token]`, `/discovery/[token]`) are completely untouched.
- No discovery _content_ shown at all, even read-only — unlike proposals
  and invoices, a discovery session's answers are working material for
  the internal team, not something with an established "client-safe
  projection" the way `clientSafeProposalProjection` exists for
  proposals. Building one is a bigger, separate decision than this batch.
- No dashboard UI changes — same deferral as every prior `PORTAL-*` and
  `FIN-01` batch.

## Migration

None — no schema changes, only new queries against existing tables and
new page sections.

## Quality gates

- `npm run check` was not run in this environment — run it locally.
- Manual verification recommended: for a client with one `WAIVED`
  feedback record and one `PENDING` (active token) record, confirm only
  the pending one appears; for a client with an `ARCHIVED` discovery
  session, confirm it does not appear in the portal.

## Where this leaves the original "unify the client portal" goal

All four artifact types are now represented in `/portal/[token]`:
proposals and invoices with full read-only content
(`PORTAL-01`/`PORTAL-02`), feedback and discovery with status only
(`PORTAL-03`). The remaining open items across all three `PORTAL-*`
batches are the same two: a dashboard UI to issue/revoke portal access,
and — as a considered, separate decision — whether proposal acceptance
and feedback submission should eventually become portal-native instead
of routing to their standalone emailed links.
