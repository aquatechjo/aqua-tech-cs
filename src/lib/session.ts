import crypto from "crypto"
import {
  AQUA_TECH_CS_TECHNICAL_ID,
  LEGACY_AQUAFLOW_TECHNICAL_ID,
} from "@/lib/technical-identity"

export const SESSION_COOKIE_NAME = `${AQUA_TECH_CS_TECHNICAL_ID}_session`
export const LEGACY_SESSION_COOKIE_NAMES = [
  `${LEGACY_AQUAFLOW_TECHNICAL_ID}_session`,
] as const
export const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE_NAME,
  ...LEGACY_SESSION_COOKIE_NAMES,
] as const

type SessionCookieReader = {
  get(name: string): { value: string } | undefined
}

export function readSessionCookies(cookieStore: SessionCookieReader) {
  return SESSION_COOKIE_NAMES.flatMap((name) => {
    const value = cookieStore.get(name)?.value
    return value ? [{ name, value }] : []
  })
}

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
