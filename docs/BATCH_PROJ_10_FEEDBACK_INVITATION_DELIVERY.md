# PROJ-10 — Governed Feedback Invitation Delivery

Status: **implemented**

## Outcome

PROJ-10 turns the secure PROJ-09 feedback link into a governed email delivery workflow. An execution manager selects and verifies the recipient, and the server rotates a fresh 14-day token immediately before sending the invitation through the existing transactional email provider.

## Governance and safety

- Requires an authenticated project execution manager and same-origin request.
- Requires an approved project closure and an active feedback owner.
- Refuses delivery after feedback has already been received.
- Stores recipient, attempt count, prepared/sent/failed timestamps, and provider id.
- Records prepared, failed, and sent Activity events.
- Revokes and removes the token when provider delivery fails, so an orphaned failed-attempt link cannot remain active.
- Keeps manual copy/revoke controls available as a separate deliberate channel.
- Uses `APP_URL` for production public links and `FEEDBACK_FROM` for the verified sender.

## Configuration

Production requires `RESEND_API_KEY`, `FEEDBACK_FROM`, and `APP_URL`.

WhatsApp, reminder scheduling, automatic retries, and n8n dispatch remain outside this batch.
