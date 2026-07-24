import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../src/lib/api-response";
import {
  assertSameOrigin,
  buildIdempotencyKey,
  readJsonBody,
  safeEqualSecrets,
} from "../../src/lib/request-security";

test("constant-time secret comparison accepts only exact values", () => {
  assert.equal(safeEqualSecrets("correct-secret", "correct-secret"), true);
  assert.equal(safeEqualSecrets("wrong-secret", "correct-secret"), false);
  assert.equal(safeEqualSecrets("short", "much-longer"), false);
});

test("idempotency keys are deterministic and bounded", () => {
  const first = buildIdempotencyKey("request-123", null);
  const second = buildIdempotencyKey("request-123", null);

  assert.equal(first, second);
  assert.equal(first?.length, 64);
  assert.equal(buildIdempotencyKey(null, null), null);

  assert.throws(
    () => buildIdempotencyKey("x".repeat(161), null),
    (error) =>
      error instanceof ApiError && error.code === "INVALID_IDEMPOTENCY_KEY",
  );
});

test("same-origin validation rejects cross-site mutation requests", () => {
  const allowedRequest = new Request("https://flow.aquatech.test/api/tasks", {
    headers: {
      origin: "https://flow.aquatech.test",
    },
  });

  assert.doesNotThrow(() => assertSameOrigin(allowedRequest));

  const blockedRequest = new Request("https://flow.aquatech.test/api/tasks", {
    headers: {
      origin: "https://attacker.test",
    },
  });

  assert.throws(
    () => assertSameOrigin(blockedRequest),
    (error) => error instanceof ApiError && error.code === "INVALID_ORIGIN",
  );
});

test("JSON body parsing rejects invalid and oversized payloads", async () => {
  const validRequest = new Request("https://flow.aquatech.test/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "Task" }),
    headers: {
      "content-type": "application/json",
    },
  });

  assert.deepEqual(await readJsonBody(validRequest), { title: "Task" });

  const invalidRequest = new Request("https://flow.aquatech.test/api/tasks", {
    method: "POST",
    body: "{invalid",
  });

  await assert.rejects(
    () => readJsonBody(invalidRequest),
    (error) => error instanceof ApiError && error.code === "INVALID_JSON",
  );

  const oversizedRequest = new Request(
    "https://flow.aquatech.test/api/tasks",
    {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(100) }),
    },
  );

  await assert.rejects(
    () => readJsonBody(oversizedRequest, 32),
    (error) => error instanceof ApiError && error.code === "BODY_TOO_LARGE",
  );
});
