import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the general invoice public link UI only shows for non-amendment invoices', () => {
  const client = readFileSync(
    'src/app/dashboard/finance/invoices/[id]/InvoiceDetailClient.tsx',
    'utf8',
  ).replace(/\s+/gu, ' ');
  assert.match(client, /!invoice\.contractAmendment.*public-link|manageLink/u);
  assert.match(client, /\/api\/finance\/invoices\/\$\{invoice\.id\}\/public-link/u);
});

test('client portal access UI is management-gated and reuses the shared active-state check', () => {
  const server = readFileSync('src/app/dashboard/clients/[id]/page.tsx', 'utf8').replace(
    /\s+/gu,
    ' ',
  );
  const client = readFileSync(
    'src/app/dashboard/clients/[id]/ClientContactsClient.tsx',
    'utf8',
  ).replace(/\s+/gu, ' ');
  assert.match(
    server,
    /clientPortalIsActive\(/u,
    'the dashboard must reuse the same active-state logic as the public portal lookup, not a second copy',
  );
  assert.match(client, /canManage \? \(/u);
  assert.match(client, /\/api\/clients\/\$\{client\.id\}\/portal-access/u);
});
