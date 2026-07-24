import assert from "node:assert/strict"
import test from "node:test"
import {
  createRawPasswordResetToken,
  getPasswordResetExpiry,
  hashPasswordResetToken,
  isPasswordResetTokenUsable,
  PASSWORD_RESET_TTL_MS,
} from "../../src/lib/password-reset"

test("password reset tokens are opaque and stored as hashes", () => {
  const first = createRawPasswordResetToken()
  const second = createRawPasswordResetToken()

  assert.ok(first.length >= 40)
  assert.ok(second.length >= 40)
  assert.notEqual(first, second)
  assert.equal(hashPasswordResetToken(first).length, 64)
  assert.notEqual(hashPasswordResetToken(first), first)
})

test("password reset expiry is approximately twenty minutes", () => {
  const now = new Date()
  const expiry = getPasswordResetExpiry(now)

  assert.equal(expiry.getTime(), now.getTime() + PASSWORD_RESET_TTL_MS)
})

test("password reset token usability requires an unused future expiry", () => {
  const now = new Date("2026-07-25T00:00:00.000Z")

  assert.equal(
    isPasswordResetTokenUsable({
      expiresAt: new Date("2026-07-25T00:20:00.000Z"),
      usedAt: null,
      now,
    }),
    true
  )

  assert.equal(
    isPasswordResetTokenUsable({
      expiresAt: new Date("2026-07-24T23:59:59.000Z"),
      usedAt: null,
      now,
    }),
    false
  )

  assert.equal(
    isPasswordResetTokenUsable({
      expiresAt: new Date("2026-07-25T00:20:00.000Z"),
      usedAt: new Date("2026-07-25T00:01:00.000Z"),
      now,
    }),
    false
  )
})
