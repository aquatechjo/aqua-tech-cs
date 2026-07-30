import "server-only"

import crypto from "node:crypto"

import type { Prisma } from "@/generated/prisma/client"
import { ApiError } from "@/lib/api-response"
import {
  isProposalPublicAccessActive,
  isValidProposalPublicToken,
  PROPOSAL_PUBLIC_TOKEN_BYTES,
  proposalValidUntil,
} from "@/lib/proposal-delivery"
import {
  clientSafeProposalProjection,
  proposalVersionContentSchema,
} from "@/lib/proposal"
import { prisma } from "@/lib/prisma"
import { hashOpaqueValue } from "@/lib/request-security"

export function createProposalPublicAccess({
  validityDays,
  now = new Date(),
}: {
  validityDays: number
  now?: Date
}) {
  const token = crypto
    .randomBytes(PROPOSAL_PUBLIC_TOKEN_BYTES)
    .toString("base64url")

  return {
    token,
    tokenHash: hashOpaqueValue(token),
    expiresAt: proposalValidUntil({
      startedAt: now,
      validityDays,
    }),
  }
}

export function configuredAppOrigin(requestUrl?: string) {
  const configured = process.env.APP_ORIGIN?.trim()

  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production")
  }

  const value = configured || requestUrl

  if (!value) {
    throw new Error("APP_ORIGIN is required to build proposal links")
  }

  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("APP_ORIGIN must use http or https")
  }

  return url.origin
}

export const publicProposalDeliverySelect = {
  id: true,
  companyId: true,
  status: true,
  channel: true,
  version: true,
  clientContentHash: true,
  recipientName: true,
  expiresAt: true,
  revokedAt: true,
  sentAt: true,
  firstViewedAt: true,
  lastViewedAt: true,
  viewCount: true,
  workspace: {
    select: {
      id: true,
      proposalNumber: true,
      status: true,
      sentVersion: true,
      sentClientContentHash: true,
      sentAt: true,
      clientRespondedAt: true,
      clientResponseName: true,
      clientResponseNotes: true,
      opportunity: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          serviceType: true,
          probability: true,
          serviceRequestId: true,
          ownerId: true,
        },
      },
      intakeSession: {
        select: {
          lead: {
            select: {
              id: true,
              contactName: true,
              companyName: true,
              serviceType: true,
            },
          },
        },
      },
      versions: {
        select: {
          version: true,
          content: true,
          clientContentHash: true,
          createdAt: true,
        },
      },
    },
  },
  company: {
    select: {
      name: true,
      email: true,
      phone: true,
      website: true,
      currency: true,
      timezone: true,
    },
  },
} as const

export type PublicProposalDeliveryRecord =
  Prisma.ProposalDeliveryGetPayload<{
    select: typeof publicProposalDeliverySelect
  }>

function publicProposalUnavailable() {
  return new ApiError(
    "رابط العرض غير متاح أو انتهت صلاحيته",
    404,
    "PROPOSAL_PUBLIC_LINK_UNAVAILABLE",
  )
}

export function assertPublicProposalDeliveryActive(
  delivery: PublicProposalDeliveryRecord,
  now = new Date(),
) {
  if (
    !isProposalPublicAccessActive({
      deliveryStatus: delivery.status,
      revokedAt: delivery.revokedAt,
      expiresAt: delivery.expiresAt,
      workspaceStatus: delivery.workspace.status,
      deliveryVersion: delivery.version,
      sentVersion: delivery.workspace.sentVersion,
      deliveryClientContentHash: delivery.clientContentHash,
      sentClientContentHash:
        delivery.workspace.sentClientContentHash,
      now,
      timeZone: delivery.company.timezone,
    })
  ) {
    throw publicProposalUnavailable()
  }
}

export async function findPublicProposalDelivery(
  token: string,
  now = new Date(),
) {
  if (!isValidProposalPublicToken(token)) return null

  const delivery = await prisma.proposalDelivery.findUnique({
    where: {
      tokenHash: hashOpaqueValue(token),
    },
    select: publicProposalDeliverySelect,
  })

  if (!delivery) return null

  try {
    assertPublicProposalDeliveryActive(delivery, now)
  } catch {
    return null
  }

  return delivery
}

export function serializePublicProposal(
  delivery: PublicProposalDeliveryRecord,
) {
  const version = delivery.workspace.versions.find(
    (candidate) => candidate.version === delivery.version,
  )

  if (
    !version ||
    version.clientContentHash !== delivery.clientContentHash
  ) {
    throw publicProposalUnavailable()
  }

  const content = proposalVersionContentSchema.safeParse(version.content)
  if (!content.success) {
    throw publicProposalUnavailable()
  }

  const lead = delivery.workspace.intakeSession.lead
  const opportunity = delivery.workspace.opportunity

  return {
    proposalNumber: delivery.workspace.proposalNumber,
    version: delivery.version,
    status: delivery.workspace.status,
    client: {
      name:
        opportunity?.companyName ||
        lead.companyName ||
        opportunity?.contactName ||
        lead.contactName,
      contactName:
        opportunity?.contactName || lead.contactName,
      serviceType:
        opportunity?.serviceType || lead.serviceType,
    },
    issuer: {
      name: delivery.company.name,
      email: delivery.company.email,
      phone: delivery.company.phone,
      website: delivery.company.website,
    },
    currency: delivery.company.currency,
    timeZone: delivery.company.timezone,
    sentAt: delivery.sentAt?.toISOString() ?? null,
    validUntil: delivery.expiresAt.toISOString(),
    respondedAt:
      delivery.workspace.clientRespondedAt?.toISOString() ?? null,
    responderName: delivery.workspace.clientResponseName,
    responseNotes: delivery.workspace.clientResponseNotes,
    content: clientSafeProposalProjection(content.data),
  }
}

export async function loadPublicProposalForUpdate({
  db,
  tokenHash,
  now = new Date(),
}: {
  db: Prisma.TransactionClient
  tokenHash: string
  now?: Date
}) {
  await db.$queryRaw`
    SELECT "id"
    FROM "ProposalDelivery"
    WHERE "tokenHash" = ${tokenHash}
    FOR UPDATE
  `

  const delivery = await db.proposalDelivery.findUnique({
    where: { tokenHash },
    select: publicProposalDeliverySelect,
  })

  if (!delivery) throw publicProposalUnavailable()
  assertPublicProposalDeliveryActive(delivery, now)

  return delivery
}
