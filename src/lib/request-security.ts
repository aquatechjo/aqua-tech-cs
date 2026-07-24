import crypto from "node:crypto"
import { ApiError } from "@/lib/api-response"

const DEFAULT_MAX_BODY_BYTES = 64 * 1024
const IDEMPOTENCY_KEY_MAX_LENGTH = 160

function configuredOrigins() {
  return [process.env.APP_ORIGIN, process.env.ALLOWED_APP_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")

  if (!origin) {
    return
  }

  if (origin === "null") {
    throw new ApiError("مصدر الطلب غير مسموح", 403, "INVALID_ORIGIN")
  }

  const allowedOrigins = new Set([
    new URL(request.url).origin,
    ...configuredOrigins(),
  ])

  if (!allowedOrigins.has(origin)) {
    throw new ApiError("مصدر الطلب غير مسموح", 403, "INVALID_ORIGIN")
  }
}

export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length"))

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError("حجم الطلب أكبر من الحد المسموح", 413, "BODY_TOO_LARGE")
  }

  const rawBody = await request.text()

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    throw new ApiError("حجم الطلب أكبر من الحد المسموح", 413, "BODY_TOO_LARGE")
  }

  if (!rawBody.trim()) {
    throw new ApiError("بيانات الطلب مطلوبة", 400, "INVALID_JSON")
  }

  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw new ApiError("صيغة JSON غير صحيحة", 400, "INVALID_JSON")
  }
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

export function safeEqualSecrets(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
}

export function hashOpaqueValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function buildIdempotencyKey(
  headerValue: string | null,
  workflowRunId: string | null | undefined
) {
  const value = headerValue?.trim() || workflowRunId?.trim()

  if (!value) {
    return null
  }

  if (value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new ApiError(
      "مفتاح منع التكرار أطول من الحد المسموح",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    )
  }

  return hashOpaqueValue(value)
}
