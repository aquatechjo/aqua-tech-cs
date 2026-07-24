import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { hashOpaqueValue } from "@/lib/request-security"

type RateLimitRow = {
  count: number
  expiresAt: Date
}

export async function enforceRateLimit({
  namespace,
  identifier,
  limit,
  windowMs,
}: {
  namespace: string
  identifier: string
  limit: number
  windowMs: number
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + windowMs)
  const key = hashOpaqueValue(`${namespace}:${identifier}`)

  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "RateLimitBucket" (
      "key",
      "count",
      "windowStart",
      "expiresAt",
      "updatedAt"
    )
    VALUES (
      ${key},
      1,
      ${now},
      ${expiresAt},
      ${now}
    )
    ON CONFLICT ("key")
    DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now}
        ELSE "RateLimitBucket"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "RateLimitBucket"."expiresAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `

  const result = rows[0]

  if (!result) {
    throw new Error("RATE_LIMIT_RESULT_MISSING")
  }

  if (result.count > limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.expiresAt.getTime() - now.getTime()) / 1000)
    )

    throw new ApiError(
      "تم تجاوز عدد المحاولات المسموح، حاول لاحقًا",
      429,
      "RATE_LIMITED",
      {
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    )
  }
}
