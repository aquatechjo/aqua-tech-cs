import "server-only"

import crypto from "node:crypto"

import { ApiError } from "@/lib/api-response"
import type { PricingVersionContent } from "@/lib/pricing"

export function pricingContentHash(content: PricingVersionContent) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex")
}

export function assertPricingSourceReady({
  sessionStatus,
  reportStatus,
  reportVersion,
}: {
  sessionStatus: string
  reportStatus: string | null
  reportVersion: number
}) {
  if (
    sessionStatus !== "COMPLETED" ||
    reportStatus !== "APPROVED" ||
    reportVersion < 1
  ) {
    throw new ApiError(
      "يجب اعتماد تقرير الاكتشاف قبل إعداد التسعير",
      409,
      "PRICING_DISCOVERY_REPORT_NOT_APPROVED",
    )
  }
}

export function assertPricingVersionMatchesReport({
  versionReportVersion,
  versionContentHash,
  reportVersion,
  reportContentHash,
}: {
  versionReportVersion: number
  versionContentHash: string
  reportVersion: number
  reportContentHash: string
}) {
  if (
    versionReportVersion !== reportVersion ||
    versionContentHash !== reportContentHash
  ) {
    throw new ApiError(
      "تغير تقرير الاكتشاف المعتمد بعد إصدار التسعير. احفظ إصدار تسعير جديدًا قبل المراجعة.",
      409,
      "PRICING_DISCOVERY_SOURCE_CHANGED",
    )
  }
}
