import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test("client portal proposal lookup scopes strictly to the token's own client", () => {
  const server = readFileSync('src/lib/client-portal-server.ts', 'utf8');
  assert.match(
    server,
    /intakeSession: \{ lead: \{ clientId: access\.clientId \} \}/u,
    "a portal token must never be able to view another client's proposal by guessing a workspace id",
  );
  assert.match(
    server,
    /isProposalPublicAccessActive\(/u,
    'the portal must reuse the existing proposal validity check, not a new one',
  );
  assert.match(
    server,
    /serializePublicProposal\(/u,
    'the portal must reuse the existing client-safe content projection, not build its own',
  );
});

test('the portal proposal page is read-only and does not expose an accept/reject action', () => {
  const page = readFileSync('src/app/portal/[token]/proposals/[workspaceId]/page.tsx', 'utf8');
  assert.doesNotMatch(
    page,
    /ACCEPT|REJECT|CHANGES_REQUESTED/u,
    'PORTAL-02 is view-only by design — formal responses still go through the emailed proposal link',
  );
  assert.match(
    page,
    /الرابط المرسل إليك عبر البريد الإلكتروني/u,
    'the page must tell the client where to formally respond',
  );
});
