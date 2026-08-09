import "server-only"

import crypto from "node:crypto"
import type { Prisma } from "@/generated/prisma/client"
import { ApiError } from "@/lib/api-response"
import { FEEDBACK_PUBLIC_TOKEN_BYTES, feedbackPublicExpiry, isValidFeedbackPublicToken } from "@/lib/project-feedback"
import { prisma } from "@/lib/prisma"
import { hashOpaqueValue } from "@/lib/request-security"

export function createFeedbackPublicAccess(now = new Date(), validDays?: number) {
  const token = crypto.randomBytes(FEEDBACK_PUBLIC_TOKEN_BYTES).toString("base64url")
  return { token, tokenHash: hashOpaqueValue(token), expiresAt: feedbackPublicExpiry(now, validDays) }
}

export const publicFeedbackSelect = {
  id: true,
  companyId: true,
  projectId: true,
  status: true,
  ownerId: true,
  publicExpiresAt: true,
  publicRevokedAt: true,
  publicSubmittedAt: true,
  receivedAt: true,
  publicFirstViewedAt: true,
  project: { select: { name: true, clientId: true, company: { select: { name: true } } } },
} as const

export type PublicFeedbackRecord = Prisma.ProjectFeedbackGetPayload<{ select: typeof publicFeedbackSelect }>

export function assertPublicFeedbackActive(feedback: PublicFeedbackRecord, now = new Date()) {
  if (feedback.publicRevokedAt || !feedback.publicExpiresAt || feedback.publicExpiresAt <= now || feedback.publicSubmittedAt || feedback.receivedAt) {
    throw new ApiError("رابط التقييم غير متاح أو انتهت صلاحيته", 404, "FEEDBACK_PUBLIC_LINK_UNAVAILABLE")
  }
}

export async function findPublicFeedback(token: string, now = new Date()) {
  if (!isValidFeedbackPublicToken(token)) return null
  const feedback = await prisma.projectFeedback.findUnique({ where: { publicTokenHash: hashOpaqueValue(token) }, select: publicFeedbackSelect })
  if (!feedback) return null
  try { assertPublicFeedbackActive(feedback, now) } catch { return null }
  return feedback
}

export async function loadPublicFeedbackForUpdate(db: Prisma.TransactionClient, tokenHash: string, now = new Date()) {
  await db.$queryRaw`SELECT "id" FROM "ProjectFeedback" WHERE "publicTokenHash" = ${tokenHash} FOR UPDATE`
  const feedback = await db.projectFeedback.findUnique({ where: { publicTokenHash: tokenHash }, select: publicFeedbackSelect })
  if (!feedback) throw new ApiError("رابط التقييم غير متاح أو انتهت صلاحيته", 404, "FEEDBACK_PUBLIC_LINK_UNAVAILABLE")
  assertPublicFeedbackActive(feedback, now)
  return feedback
}
