import crypto from "node:crypto"

export const PASSWORD_RESET_TTL_MINUTES = 20
export const PASSWORD_RESET_TTL_MS = PASSWORD_RESET_TTL_MINUTES * 60 * 1000

export function createRawPasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url")
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function getPasswordResetExpiry(now = new Date()) {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS)
}

export function isPasswordResetTokenUsable({
  expiresAt,
  usedAt,
  now = new Date(),
}: {
  expiresAt: Date
  usedAt: Date | null
  now?: Date
}) {
  return usedAt === null && expiresAt.getTime() > now.getTime()
}
