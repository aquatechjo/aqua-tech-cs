import { z } from "zod"

import { localDateKey } from "@/lib/finance"

export const PROPOSAL_PUBLIC_TOKEN_BYTES = 32
export const PROPOSAL_RESPONSE_STATEMENT_VERSION =
  "PROPOSAL_RESPONSE_V1"

export const proposalRecipientSchema = z.object({
  recipientName: z.string().trim().min(2).max(200),
  recipientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("البريد الإلكتروني غير صحيح")
    .max(320)
    .optional()
    .nullable(),
  recipientPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable(),
})

const responderIdentitySchema = z.object({
  responderName: z.string().trim().min(2).max(200),
  responderEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("البريد الإلكتروني غير صحيح")
    .max(320),
  responderTitle: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable(),
  authorityConfirmed: z.literal(true),
})

export const proposalClientResponseSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("VIEW"),
    }),
    responderIdentitySchema.extend({
      action: z.literal("ACCEPT"),
      notes: z.string().trim().max(2000).optional().nullable(),
    }),
    responderIdentitySchema.extend({
      action: z.literal("REQUEST_CHANGES"),
      notes: z.string().trim().min(10).max(4000),
    }),
    responderIdentitySchema.extend({
      action: z.literal("REJECT"),
      notes: z.string().trim().min(10).max(4000),
    }),
  ],
)

export type ProposalClientResponseInput = z.infer<
  typeof proposalClientResponseSchema
>

export type ProposalLifecycleStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SENT"
  | "CLIENT_CHANGES_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"

export type DisplayProposalLifecycleStatus =
  | ProposalLifecycleStatus
  | "EXPIRED"

export function isValidProposalPublicToken(token: string) {
  return /^[A-Za-z0-9_-]{40,80}$/.test(token)
}

export function publicProposalPath(token: string) {
  if (!isValidProposalPublicToken(token)) {
    throw new Error("INVALID_PROPOSAL_PUBLIC_TOKEN")
  }

  return `/proposal/${encodeURIComponent(token)}`
}

export function proposalValidUntil({
  startedAt = new Date(),
  validityDays,
}: {
  startedAt?: Date
  validityDays: number
}) {
  if (
    !Number.isInteger(validityDays) ||
    validityDays < 1 ||
    validityDays > 365
  ) {
    throw new Error("INVALID_PROPOSAL_VALIDITY")
  }

  return new Date(
    startedAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
  )
}

export function displayProposalLifecycleStatus({
  status,
  validUntil,
  now = new Date(),
  timeZone = "Asia/Amman",
}: {
  status: ProposalLifecycleStatus
  validUntil: Date | string | null
  now?: Date
  timeZone?: string
}): DisplayProposalLifecycleStatus {
  if (
    status === "SENT" &&
    validUntil &&
    localDateKey(new Date(validUntil), timeZone) <
      localDateKey(now, timeZone)
  ) {
    return "EXPIRED"
  }

  return status
}

export function isProposalPublicAccessActive({
  deliveryStatus,
  revokedAt,
  expiresAt,
  workspaceStatus,
  deliveryVersion,
  sentVersion,
  deliveryClientContentHash,
  sentClientContentHash,
  now = new Date(),
  timeZone = "Asia/Amman",
}: {
  deliveryStatus: string
  revokedAt: Date | null
  expiresAt: Date
  workspaceStatus: ProposalLifecycleStatus
  deliveryVersion: number
  sentVersion: number | null
  deliveryClientContentHash: string
  sentClientContentHash: string | null
  now?: Date
  timeZone?: string
}) {
  const visibleStatuses: ProposalLifecycleStatus[] = [
    "SENT",
    "CLIENT_CHANGES_REQUESTED",
    "ACCEPTED",
    "REJECTED",
  ]

  return (
    deliveryStatus === "SENT" &&
    revokedAt === null &&
    visibleStatuses.includes(workspaceStatus) &&
    deliveryVersion === sentVersion &&
    deliveryClientContentHash === sentClientContentHash &&
    localDateKey(expiresAt, timeZone) >= localDateKey(now, timeZone)
  )
}

export function proposalDecisionForAction(
  action: Exclude<ProposalClientResponseInput["action"], "VIEW">,
) {
  if (action === "ACCEPT") return "ACCEPTED" as const
  if (action === "REQUEST_CHANGES") {
    return "CHANGES_REQUESTED" as const
  }
  return "REJECTED" as const
}

export function proposalWorkspaceStatusForDecision(
  decision: ReturnType<typeof proposalDecisionForAction>,
) {
  if (decision === "ACCEPTED") return "ACCEPTED" as const
  if (decision === "CHANGES_REQUESTED") {
    return "CLIENT_CHANGES_REQUESTED" as const
  }
  return "REJECTED" as const
}

export function normalizedWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "")

  if (digits.length < 8 || digits.length > 15) {
    throw new Error("INVALID_WHATSAPP_NUMBER")
  }

  return digits
}

export function proposalWhatsappUrl({
  phone,
  proposalUrl,
  proposalNumber,
  recipientName,
}: {
  phone: string
  proposalUrl: string
  proposalNumber: string
  recipientName: string
}) {
  const number = normalizedWhatsappNumber(phone)
  const message = [
    `مرحبًا ${recipientName}،`,
    `نشارك معك العرض ${proposalNumber} من Aqua Tech.`,
    proposalUrl,
    "يمكنك مراجعة العرض والرد من الرابط الآمن.",
  ].join("\n")

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
