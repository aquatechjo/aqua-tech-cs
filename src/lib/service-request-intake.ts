import { randomBytes } from 'node:crypto';

/**
 * Characters used for the human-typeable reference code. Deliberately
 * excludes visually ambiguous characters (0/O, 1/I/L) since a customer may
 * need to read this off a screen and type it into WhatsApp.
 */
const REFERENCE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const REFERENCE_CODE_LENGTH = 6;
const REFERENCE_CODE_PREFIX = 'AQ-';

/**
 * Generates a short, human-typeable reference code for a new service
 * request, e.g. "AQ-7F3K9Q". This is the correlation key the future
 * WhatsApp bridge (Phase 2) will use to link an inbound conversation back
 * to the service request that started it — phone-number matching alone is
 * not reliable, since a customer may message from a different number than
 * the one they typed into the website form.
 *
 * Not a security token: it is short and meant to be read and typed by a
 * person, not to gate access to anything. Uniqueness within a company is
 * enforced at the database level (`@@unique([companyId, referenceCode])`),
 * not by this function.
 */
export function generateServiceRequestReferenceCode(): string {
  const bytes = randomBytes(REFERENCE_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < REFERENCE_CODE_LENGTH; i += 1) {
    code += REFERENCE_CODE_ALPHABET[bytes[i] % REFERENCE_CODE_ALPHABET.length];
  }
  return `${REFERENCE_CODE_PREFIX}${code}`;
}

export function isValidServiceRequestReferenceCode(value: string): boolean {
  const pattern = new RegExp(`^AQ-[${REFERENCE_CODE_ALPHABET}]{${REFERENCE_CODE_LENGTH}}$`);
  return pattern.test(value);
}

/**
 * Builds a wa.me deep link pre-filled with the reference code, or `null`
 * when the company has not configured a WhatsApp business number yet (the
 * website should fall back to its own default contact flow in that case
 * rather than sending customers to a broken link).
 *
 * The company's WhatsApp number is the single source of truth for this
 * URL — the website never hardcodes it, matching the Business Operating
 * Architecture principle that the Core System, not the channel, owns
 * ground truth.
 */
export function buildWhatsAppRedirectUrl({
  businessNumber,
  referenceCode,
  customerName,
}: {
  businessNumber: string | null;
  referenceCode: string;
  customerName: string;
}): string | null {
  if (!businessNumber) return null;
  const digitsOnly = businessNumber.replace(/[^0-9]/g, '');
  if (digitsOnly.length < 8) return null;

  const message = `مرحباً، اسمي ${customerName} وأرسلت طلب من الموقع. رمز الطلب: ${referenceCode}`;
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
