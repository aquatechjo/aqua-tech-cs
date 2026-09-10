import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  invoicePublicLinkExpiry,
  invoicePublicLinkIsActive,
  invoicePublicLinkIssues,
  invoicePublicLinkPath,
  isValidInvoicePublicLinkToken,
} from '../../src/lib/invoice-public-link';

test('public link tokens and paths are opaque and bounded', () => {
  const token = 'A'.repeat(43);
  assert.equal(isValidInvoicePublicLinkToken(token), true);
  assert.equal(isValidInvoicePublicLinkToken('short'), false);
  assert.equal(invoicePublicLinkPath(token), `/invoice-portal/${token}`);
  assert.equal(
    invoicePublicLinkExpiry(new Date('2026-08-13T00:00:00Z'), 14).toISOString(),
    '2026-08-27T00:00:00.000Z',
  );
});

test('public link requires an issued, non-cancelled invoice with no contract amendment', () => {
  const valid = {
    status: 'ISSUED',
    issueDate: new Date(),
    dueDate: new Date(),
    hasContractAmendment: false,
  };
  assert.deepEqual(invoicePublicLinkIssues(valid), []);
  assert.ok(invoicePublicLinkIssues({ ...valid, status: 'DRAFT' }).length);
  assert.ok(invoicePublicLinkIssues({ ...valid, status: 'CANCELLED' }).length);
  assert.ok(invoicePublicLinkIssues({ ...valid, dueDate: null }).length);
  assert.ok(
    invoicePublicLinkIssues({ ...valid, hasContractAmendment: true }).length,
    'amendment invoices must be blocked from this general link — they have their own dedicated portal',
  );
});

test('active state requires hash future expiry and no revocation', () => {
  const now = new Date('2026-08-13T00:00:00Z');
  assert.equal(
    invoicePublicLinkIsActive(
      { tokenHash: 'hash', expiresAt: new Date('2026-08-14T00:00:00Z'), revokedAt: null },
      now,
    ),
    true,
  );
  assert.equal(
    invoicePublicLinkIsActive(
      { tokenHash: 'hash', expiresAt: new Date('2026-08-12T00:00:00Z'), revokedAt: null },
      now,
    ),
    false,
  );
  assert.equal(
    invoicePublicLinkIsActive(
      { tokenHash: 'hash', expiresAt: new Date('2026-08-14T00:00:00Z'), revokedAt: now },
      now,
    ),
    false,
  );
});

test('public link route is hash-only, tenant-governed, audited, and blocks amendment invoices', () => {
  const route = readFileSync('src/app/api/finance/invoices/[id]/public-link/route.ts', 'utf8');
  const server = readFileSync('src/lib/invoice-public-link-server.ts', 'utf8');
  const page = readFileSync('src/app/invoice-portal/[token]/page.tsx', 'utf8');
  assert.match(route, /assertSameOrigin/u);
  assert.match(route, /ACCESS_ROLES\.financeManagement/u);
  assert.match(route, /companyId: user\.companyId/u);
  assert.match(route, /FOR UPDATE/u);
  assert.match(route, /hasContractAmendment: Boolean\(invoice\.contractAmendment\)/u);
  assert.match(server, /hashOpaqueValue\(token\)/u);
  assert.doesNotMatch(server, /publicTokenHash:\s*\btoken\b(?!Hash)/u);
  assert.match(page, /index: false, follow: false, nocache: true/u);
  assert.doesNotMatch(page, /dashboard/u);
});
