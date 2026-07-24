import assert from "node:assert/strict";
import test from "node:test";
import {
  createRawSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "../../src/lib/session";

test("session tokens are random, opaque, and stored as hashes", () => {
  const first = createRawSessionToken();
  const second = createRawSessionToken();

  assert.equal(first.length, 64);
  assert.equal(second.length, 64);
  assert.notEqual(first, second);
  assert.equal(hashSessionToken(first).length, 64);
  assert.notEqual(hashSessionToken(first), first);
});

test("session expiry is approximately seven days", () => {
  const now = Date.now();
  const expiry = getSessionExpiry().getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  assert.ok(expiry >= now + sevenDays - 2_000);
  assert.ok(expiry <= now + sevenDays + 2_000);
});
