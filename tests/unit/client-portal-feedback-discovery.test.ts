import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('portal feedback and discovery sections exclude waived and archived items', () => {
  const server = readFileSync('src/lib/client-portal-server.ts', 'utf8').replace(/\s+/gu, ' ');
  assert.match(
    server,
    /feedback\.status !== "WAIVED"/u,
    'waived feedback is an internal decision, not something to show the client',
  );
  assert.match(
    server,
    /session\.status !== "ARCHIVED"/u,
    'archived discovery sessions should not appear in the portal',
  );
});

test('portal feedback never exposes internal follow-up fields', () => {
  const server = readFileSync('src/lib/client-portal-server.ts', 'utf8');
  assert.doesNotMatch(
    server,
    /followUpAction|followUpDueAt|ownerId/u,
    'internal follow-up fields must not be selected into the client-facing portal query',
  );
});

test('the portal does not embed an interactive feedback or discovery form', () => {
  const page = readFileSync('src/app/portal/[token]/page.tsx', 'utf8');
  assert.doesNotMatch(
    page,
    /npsScore|satisfactionScore|<form/iu,
    'PORTAL-03 shows status only — the scoring form and discovery Q&A stay on their own dedicated links',
  );
});
