export const INVOICE_PORTAL_TOKEN_BYTES = 32
export const INVOICE_PORTAL_DEFAULT_DAYS = 14

export function isValidInvoicePortalToken(token: string) {
  return /^[A-Za-z0-9_-]{40,80}$/u.test(token)
}

export function invoicePortalPath(token: string) {
  return `/invoice/${encodeURIComponent(token)}`
}

export function invoicePortalExpiry(now = new Date(), days = INVOICE_PORTAL_DEFAULT_DAYS) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function invoicePortalIssues(input: { invoiceStatus: string; invoiceIssuedAt: Date | null; issueDate: Date | null; dueDate: Date | null; issueReference: string | null }) {
  const issues: string[] = []
  if (!["ISSUED", "PARTIALLY_PAID", "PAID"].includes(input.invoiceStatus)) issues.push("بوابة العميل متاحة فقط لفاتورة ملحق صادرة وغير ملغاة")
  if (!input.invoiceIssuedAt || !input.issueDate || !input.dueDate) issues.push("أدلة إصدار فاتورة الملحق غير مكتملة")
  if (!input.issueReference?.trim()) issues.push("مرجع إصدار فاتورة الملحق مفقود")
  return issues
}

export function invoicePortalIsActive(input: { tokenHash: string | null; expiresAt: Date | null; revokedAt: Date | null }, now = new Date()) {
  return Boolean(input.tokenHash && input.expiresAt && input.expiresAt > now && !input.revokedAt)
}
