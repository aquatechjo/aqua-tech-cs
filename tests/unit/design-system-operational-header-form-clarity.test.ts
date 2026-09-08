import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shell = readFileSync('src/components/layout/AquaDashboardShell.tsx', 'utf8');
const densityCss = readFileSync('src/styles/aqua-density-cleanup.css', 'utf8');
const invoiceClient = readFileSync('src/app/dashboard/finance/invoices/InvoicesClient.tsx', 'utf8');
const financeCss = readFileSync('src/styles/aqua-finance.css', 'utf8');
const batch = readFileSync('docs/BATCH_UI_21_OPERATIONAL_HEADER_AND_FORM_CLARITY.md', 'utf8');

test('UI-21 keeps operational page headers compact and scoped', () => {
  assert.match(densityCss, /\.aqua-shell:not\(\.aqua-shell--showcase\) \.aqua-page-header/u);
  assert.match(densityCss, /padding: var\(--at-space-4\) !important/u);
  assert.match(densityCss, /font-size: var\(--at-text-xl\)/u);
});

test('UI-21 resets route scroll and keeps invoice totals semantic', () => {
  assert.match(shell, /window\.scrollTo\(\{ top: 0, left: 0, behavior: (?:("|')auto\1) \}\)/u);
  assert.match(invoiceClient, /<output/u);
  assert.doesNotMatch(invoiceClient, /bg-dark-subtle/u);
  assert.match(financeCss, /\.aqua-finance-total/u);
  assert.match(financeCss, /var\(--at-product-surface-soft\)/u);
});

test('UI-21 is recorded in batch governance', () => {
  assert.match(batch, /BATCH UI-21/u);
  assert.match(batch, /No permission, data, API, or database behavior changes/u);
});
