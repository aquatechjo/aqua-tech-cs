import crypto from "crypto"

export const SESSION_COOKIE_NAME = "aquaflow_session"

export function createRawSessionToken() {
  return crypto.randomBytes(32).toString("hex")
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function getSessionExpiry() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)
  return expiresAt
}