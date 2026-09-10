import { normalizeClientContactPhone } from '@/lib/client-contact';

/**
 * Reuses the same digits-only normalization already applied to
 * `ClientContact.phoneNormalized` / `whatsappNormalized`, so a WhatsApp
 * contact's phone number is comparable against existing contacts without a
 * second, slightly-different normalization rule living in the codebase.
 *
 * Returns `null` for anything that does not look like a real phone number
 * (too short after stripping formatting) rather than storing a clearly
 * invalid value.
 */
export function toWhatsAppPhoneE164(rawPhone: string): string | null {
  const normalized = normalizeClientContactPhone(rawPhone);
  if (!normalized || normalized.length < 8) return null;
  return normalized;
}

/**
 * Substitutes `{{1}}`, `{{2}}`, ... placeholders in a WhatsApp template
 * body with the given variables, in order. This mirrors how Meta's message
 * templates declare numbered placeholders, so the same `bodyPreview` stored
 * on `MessageTemplate` can be rendered for internal preview purposes before
 * any provider integration exists.
 *
 * Throws if the template references a placeholder index with no matching
 * variable, rather than silently leaving `{{n}}` in the rendered text.
 */
export function renderMessageTemplate(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, indexText: string) => {
    const index = Number.parseInt(indexText, 10) - 1;
    if (index < 0 || index >= variables.length) {
      throw new Error(
        `Template references {{${indexText}}} but only ${variables.length} variable(s) were provided`,
      );
    }
    return variables[index];
  });
}
