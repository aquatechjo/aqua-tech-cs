import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_SESSION_COOKIE_NAMES,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAMES,
  createRawSessionToken,
  getSessionExpiry,
  hashSessionToken,
  readSessionCookies,
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

test("session cookie migration prefers the Aqua Tech CS identity and accepts legacy sessions", () => {
  assert.equal(SESSION_COOKIE_NAME, "aqua-tech-cs_session");
  assert.deepEqual(LEGACY_SESSION_COOKIE_NAMES, ["aquaflow_session"]);
  assert.deepEqual(SESSION_COOKIE_NAMES, [
    "aqua-tech-cs_session",
    "aquaflow_session",
  ]);

  const values = new Map([
    ["aqua-tech-cs_session", { value: "current-token" }],
    ["aquaflow_session", { value: "legacy-token" }],
  ]);

  assert.deepEqual(readSessionCookies(values), [
    { name: "aqua-tech-cs_session", value: "current-token" },
    { name: "aquaflow_session", value: "legacy-token" },
  ]);

  values.delete("aqua-tech-cs_session");
  assert.deepEqual(readSessionCookies(values), [
    { name: "aquaflow_session", value: "legacy-token" },
  ]);
});
