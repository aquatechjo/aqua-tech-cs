export type LeadSourceValue =
  | "WEBSITE"
  | "CHATBOT"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "WHATSAPP"
  | "EMAIL"
  | "CALL"
  | "MEETING"
  | "REFERRAL"
  | "CAMPAIGN"
  | "MANUAL"
  | "DIRECT"
  | "OTHER"

export type LeadStatusValue =
  | "NEW"
  | "CONTACTED"
  | "DISCOVERY"
  | "NEEDS_INFO"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "NURTURE"
  | "DUPLICATE"
  | "SPAM"
  | "CONVERTED"
  | "ARCHIVED"

export type ServiceRequestSourceValue =
  | "WEBSITE"
  | "MANUAL"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "REFERRAL"
  | "OTHER"

export type ServiceRequestStatusValue =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED"
  | "ARCHIVED"

export type LeadActionBucket =
  | "OVERDUE"
  | "UPCOMING"
  | "MISSING"
  | "CLOSED"

export const OPEN_LEAD_STATUSES: readonly LeadStatusValue[] = [
  "NEW",
  "CONTACTED",
  "DISCOVERY",
  "NEEDS_INFO",
  "QUALIFIED",
  "NURTURE",
]

function optionalText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeLeadEmail(value?: string | null) {
  return optionalText(value)?.toLocaleLowerCase("en-US") ?? null
}

export function normalizeLeadPhone(value?: string | null) {
  const normalized = optionalText(value)?.replace(/\D/g, "") ?? ""
  return normalized || null
}

export function normalizeLeadCompany(value?: string | null) {
  return (
    optionalText(value)
      ?.replace(/\s+/g, " ")
      .toLocaleLowerCase("ar-JO") ?? null
  )
}

export function leadSourceFromServiceRequest(
  source: ServiceRequestSourceValue,
): LeadSourceValue {
  return source
}

export function leadStatusFromServiceRequest(
  status: ServiceRequestStatusValue,
): LeadStatusValue {
  switch (status) {
    case "CONTACTED":
      return "CONTACTED"
    case "QUALIFIED":
    case "PROPOSAL_SENT":
    case "APPROVED":
      return "QUALIFIED"
    case "REJECTED":
      return "DISQUALIFIED"
    case "CONVERTED":
      return "CONVERTED"
    case "ARCHIVED":
      return "ARCHIVED"
    case "NEW":
    default:
      return "NEW"
  }
}

export function serviceRequestStatusFromLead(
  status: LeadStatusValue,
): ServiceRequestStatusValue {
  switch (status) {
    case "CONTACTED":
    case "DISCOVERY":
    case "NEEDS_INFO":
    case "NURTURE":
      return "CONTACTED"
    case "QUALIFIED":
      return "QUALIFIED"
    case "DISQUALIFIED":
    case "SPAM":
      return "REJECTED"
    case "DUPLICATE":
    case "ARCHIVED":
      return "ARCHIVED"
    case "CONVERTED":
      return "CONVERTED"
    case "NEW":
    default:
      return "NEW"
  }
}

export function leadSourceToOpportunitySource(
  source: LeadSourceValue,
): ServiceRequestSourceValue {
  switch (source) {
    case "WEBSITE":
    case "FACEBOOK":
    case "INSTAGRAM":
    case "WHATSAPP":
    case "REFERRAL":
    case "MANUAL":
      return source
    default:
      return "OTHER"
  }
}

export function isOpenLeadStatus(status: LeadStatusValue) {
  return OPEN_LEAD_STATUSES.includes(status)
}

export function leadActionBucket({
  status,
  nextActionAt,
  now = new Date(),
}: {
  status: LeadStatusValue
  nextActionAt: Date | string | null
  now?: Date
}): LeadActionBucket {
  if (!isOpenLeadStatus(status)) return "CLOSED"
  if (!nextActionAt) return "MISSING"

  return new Date(nextActionAt).getTime() < now.getTime()
    ? "OVERDUE"
    : "UPCOMING"
}

export function canConvertLeadToOpportunity({
  status,
  hasOpportunity,
}: {
  status: LeadStatusValue
  hasOpportunity: boolean
}) {
  return status === "QUALIFIED" && !hasOpportunity
}

export function leadCompletionScore({
  contactName,
  email,
  phone,
  companyName,
  serviceType,
  message,
  budgetRange,
  timeline,
  contactConsent,
}: {
  contactName?: string | null
  email?: string | null
  phone?: string | null
  companyName?: string | null
  serviceType?: string | null
  message?: string | null
  budgetRange?: string | null
  timeline?: string | null
  contactConsent?: boolean | null
}) {
  let score = 0

  if (optionalText(contactName)) score += 15
  if (normalizeLeadEmail(email) || normalizeLeadPhone(phone)) score += 20
  if (optionalText(companyName)) score += 10
  if (optionalText(serviceType)) score += 20
  if (optionalText(message)) score += 15
  if (optionalText(budgetRange)) score += 10
  if (optionalText(timeline)) score += 5
  if (contactConsent !== null && contactConsent !== undefined) score += 5

  return score
}

export function leadIdentity({
  email,
  phone,
  companyName,
}: {
  email?: string | null
  phone?: string | null
  companyName?: string | null
}) {
  return {
    emailNormalized: normalizeLeadEmail(email),
    phoneNormalized: normalizeLeadPhone(phone),
    companyNormalized: normalizeLeadCompany(companyName),
  }
}

export function leadLifecycleDates(
  status: LeadStatusValue,
  now = new Date(),
) {
  return {
    qualifiedAt: status === "QUALIFIED" ? now : null,
    disqualifiedAt: status === "DISQUALIFIED" ? now : null,
    convertedAt: status === "CONVERTED" ? now : null,
    archivedAt: status === "ARCHIVED" ? now : null,
  }
}
