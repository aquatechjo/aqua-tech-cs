export const CLIENT_PORTAL_TOKEN_BYTES = 32;

export function isValidClientPortalToken(token: string) {
  return /^[A-Za-z0-9_-]{40,80}$/u.test(token);
}

export function clientPortalPath(token: string) {
  return `/portal/${encodeURIComponent(token)}`;
}

export function clientPortalIsActive(input: { tokenHash: string | null; revokedAt: Date | null }) {
  return Boolean(input.tokenHash && !input.revokedAt);
}
