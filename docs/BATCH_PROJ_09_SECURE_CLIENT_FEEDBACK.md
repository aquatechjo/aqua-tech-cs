# PROJ-09 — Secure Client Feedback Collection

Status: **implemented**

## Outcome

- Authorized project managers can issue, rotate, copy, and revoke a 14-day client-feedback link after governed project closure.
- Only a SHA-256 token hash is persisted; raw tokens appear only in the newly issued URL.
- The public page exposes project and issuer names only, is no-index/no-referrer, validates bounded input, and never reveals internal execution data.
- Opening and submission are rate-limited and audited. Submission is single-use and serialized with a database row lock.
- Low scores create the governed PROJ-08 follow-up task automatically for the active project lead or manager.
- Delivery by email or WhatsApp remains explicitly out of scope; the operator copies the link into an approved channel.

## Security contract

- 256-bit random token, hash-at-rest, finite expiry, rotation, revocation, and single submission.
- Same-origin mutation checks, 12 KiB request limit, per-token/IP rate limit, transactional locking, and generic unavailable responses.
- Testimonial publication consent is explicit and cannot be stored without testimonial text.
