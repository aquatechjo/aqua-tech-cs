import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { renderMessageTemplate, toWhatsAppPhoneE164 } from '@/lib/whatsapp-communication';

test('phone normalization strips formatting and rejects short input', () => {
  assert.equal(toWhatsAppPhoneE164('+962 7 9012 3456'), '962790123456');
  assert.equal(toWhatsAppPhoneE164('07-9012-3456'), '0790123456');
  assert.equal(toWhatsAppPhoneE164('12345'), null);
  assert.equal(toWhatsAppPhoneE164(''), null);
});

test('template rendering substitutes numbered placeholders in order', () => {
  const rendered = renderMessageTemplate('مرحباً {{1}}، طلبك {{2}} قيد المراجعة.', [
    'سامر',
    'AQ-7F3K9Q',
  ]);
  assert.equal(rendered, 'مرحباً سامر، طلبك AQ-7F3K9Q قيد المراجعة.');
});

test('template rendering throws on a placeholder with no matching variable', () => {
  assert.throws(() => renderMessageTemplate('مرحباً {{1}} و{{2}}', ['سامر']));
});

test('every model and enum in schema.prisma is declared exactly once', () => {
  const schema = readFileSync(
    path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const declarationPattern = /^(model|enum) (\w+) \{/gm;
  const seen = new Map<string, number>();
  for (const match of schema.matchAll(declarationPattern)) {
    const name = match[2];
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
  assert.deepEqual(
    duplicates,
    [],
    `duplicate model/enum declarations found: ${duplicates.map(([name, count]) => `${name} (${count}x)`).join(', ')}`,
  );
});
