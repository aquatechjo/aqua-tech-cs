export const INVOICE_PUBLIC_LINK_TOKEN_BYTES = 32;
export const INVOICE_PUBLIC_LINK_DEFAULT_DAYS = 14;

export function isValidInvoicePublicLinkToken(token: string) {
  return /^[A-Za-z0-9_-]{40,80}$/u.test(token);
}

export function invoicePublicLinkPath(token: string) {
  return `/invoice-portal/${encodeURIComponent(token)}`;
}

export function invoicePublicLinkExpiry(now = new Date(), days = INVOICE_PUBLIC_LINK_DEFAULT_DAYS) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Unlike the amendment-invoice portal, a regular invoice has no separate
 * "issuance governance" step with its own reference/timestamp — issuing a
 * link only requires the invoice itself to already be ISSUED (or further
 * along) with a real issue date and due date.
 */
export function invoicePublicLinkIssues(input: {
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  hasContractAmendment: boolean;
}) {
  const issues: string[] = [];
  if (input.hasContractAmendment)
    issues.push('فواتير ملحقات العقود لها بوابة عميل مخصصة — استخدمها بدل الرابط العام');
  if (!['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(input.status))
    issues.push('الرابط العام متاح فقط لفاتورة صادرة وغير ملغاة');
  if (!input.issueDate || !input.dueDate)
    issues.push('لا يمكن إصدار رابط قبل تحديد تاريخ الإصدار والاستحقاق');
  return issues;
}

export function invoicePublicLinkIsActive(
  input: { tokenHash: string | null; expiresAt: Date | null; revokedAt: Date | null },
  now = new Date(),
) {
  return Boolean(input.tokenHash && input.expiresAt && input.expiresAt > now && !input.revokedAt);
}
