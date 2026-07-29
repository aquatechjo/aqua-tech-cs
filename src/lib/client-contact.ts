export type ClientContactIdentity = {
  emailNormalized: string | null
  phoneNormalized: string | null
  whatsappNormalized: string | null
}

function optionalText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeClientContactEmail(value?: string | null) {
  return optionalText(value)?.toLocaleLowerCase("en-US") ?? null
}

export function normalizeClientContactPhone(value?: string | null) {
  const normalized = optionalText(value)?.replace(/\D/g, "") ?? ""
  return normalized || null
}

export function clientContactIdentity({
  email,
  phone,
  whatsapp,
}: {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
}): ClientContactIdentity {
  return {
    emailNormalized: normalizeClientContactEmail(email),
    phoneNormalized: normalizeClientContactPhone(phone),
    whatsappNormalized: normalizeClientContactPhone(whatsapp),
  }
}

export function clientContactHasReachableChannel(contact: {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
}) {
  const identity = clientContactIdentity(contact)

  return Boolean(
    identity.emailNormalized ||
      identity.phoneNormalized ||
      identity.whatsappNormalized,
  )
}

export function clientContactDuplicateMatch(
  left: ClientContactIdentity,
  right: ClientContactIdentity,
) {
  return Boolean(
    (left.emailNormalized &&
      left.emailNormalized === right.emailNormalized) ||
      (left.phoneNormalized &&
        left.phoneNormalized === right.phoneNormalized) ||
      (left.whatsappNormalized &&
        left.whatsappNormalized === right.whatsappNormalized),
  )
}
