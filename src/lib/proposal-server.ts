import "server-only"

import crypto from "node:crypto"

import { ApiError } from "@/lib/api-response"
import {
  clientSafeProposalProjection,
  type ProposalVersionContent,
} from "@/lib/proposal"

function hashJson(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
}

export function proposalContentHash(content: ProposalVersionContent) {
  return hashJson(content)
}

export function proposalClientContentHash(
  content: ProposalVersionContent,
) {
  return hashJson(clientSafeProposalProjection(content))
}

export function assertProposalSourceReady({
  pricingStatus,
  pricingVersion,
}: {
  pricingStatus: string | null
  pricingVersion: number
}) {
  if (pricingStatus !== "APPROVED" || pricingVersion < 1) {
    throw new ApiError(
      "يجب اعتماد التسعير قبل إعداد العرض المركزي",
      409,
      "PROPOSAL_PRICING_NOT_APPROVED",
    )
  }
}

export function assertProposalVersionMatchesPricing({
  versionPricingVersion,
  versionPricingHash,
  pricingVersion,
  pricingHash,
}: {
  versionPricingVersion: number
  versionPricingHash: string
  pricingVersion: number
  pricingHash: string
}) {
  if (
    versionPricingVersion !== pricingVersion ||
    versionPricingHash !== pricingHash
  ) {
    throw new ApiError(
      "تغير التسعير المعتمد بعد إصدار العرض. احفظ إصدار عرض جديدًا قبل المراجعة.",
      409,
      "PROPOSAL_PRICING_SOURCE_CHANGED",
    )
  }
}
