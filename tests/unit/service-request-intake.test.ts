import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWhatsAppRedirectUrl,
  generateServiceRequestReferenceCode,
  isValidServiceRequestReferenceCode,
} from '@/lib/service-request-intake';

test('reference codes are prefixed, fixed-length, and avoid ambiguous characters', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateServiceRequestReferenceCode();
    assert.match(code, /^AQ-[A-Z0-9]{6}$/);
    assert.ok(!/[01OIL]/.test(code.slice(3)), `code "${code}" contains an ambiguous character`);
    assert.ok(isValidServiceRequestReferenceCode(code));
  }
});

test('reference code validation rejects malformed input', () => {
  assert.equal(isValidServiceRequestReferenceCode('AQ-1O2I3L'), false);
  assert.equal(isValidServiceRequestReferenceCode('aq-7f3k9q'), false);
  assert.equal(isValidServiceRequestReferenceCode('AQ-7F3K9'), false);
  assert.equal(isValidServiceRequestReferenceCode('7F3K9Q'), false);
  assert.equal(isValidServiceRequestReferenceCode(''), false);
});

test('WhatsApp redirect URL is null without a configured business number', () => {
  const url = buildWhatsAppRedirectUrl({
    businessNumber: null,
    referenceCode: 'AQ-7F3K9Q',
    customerName: 'سامر',
  });
  assert.equal(url, null);
});

test('WhatsApp redirect URL is null for an unusably short business number', () => {
  const url = buildWhatsAppRedirectUrl({
    businessNumber: '12345',
    referenceCode: 'AQ-7F3K9Q',
    customerName: 'سامر',
  });
  assert.equal(url, null);
});

test('WhatsApp redirect URL strips formatting from the business number and embeds the reference code', () => {
  const url = buildWhatsAppRedirectUrl({
    businessNumber: '+962 7 9012 3456',
    referenceCode: 'AQ-7F3K9Q',
    customerName: 'سامر',
  });
  assert.ok(url);
  assert.ok(url!.startsWith('https://wa.me/962790123456'));
  assert.ok(url!.includes(encodeURIComponent('AQ-7F3K9Q')));
  assert.ok(url!.includes('text='));
});

test('WhatsApp redirect URL text is percent-encoded, not raw Arabic in the query string', () => {
  const url = buildWhatsAppRedirectUrl({
    businessNumber: '962790123456',
    referenceCode: 'AQ-7F3K9Q',
    customerName: 'سامر',
  });
  assert.ok(url);
  assert.ok(!url!.includes('سامر'), 'raw Arabic text must not appear unescaped in the URL');
});
