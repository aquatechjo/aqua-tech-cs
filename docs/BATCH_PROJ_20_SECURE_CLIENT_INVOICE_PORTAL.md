# PROJ-20 — Secure Client Invoice Portal

Status: implemented

- Issue, rotate, or revoke a 1–30 day opaque invoice link under Finance authority and tenant-scoped row locks.
- Store only the token hash and preserve issue, expiry, revocation, first-view, last-view, count, actor, and Activity evidence.
- Expose only a non-cancelled issued amendment invoice, frozen lines, totals, payment summary, notes, and terms on a no-index, no-referrer client page.
- Return the plaintext token once at issue time; issuing a new link invalidates the previous one.

## Explicitly deferred

- Automatic email delivery of the portal link, online collection, payment reminders, WhatsApp, and n8n automation.
