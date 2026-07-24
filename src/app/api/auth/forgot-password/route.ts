import crypto from "node:crypto"
import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { err, handleApiError, ok } from "@/lib/api-response"
import { sendPasswordResetEmail } from "@/lib/email"
import {
  createRawPasswordResetToken,
  getPasswordResetExpiry,
  hashPasswordResetToken,
} from "@/lib/password-reset"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  assertSameOrigin,
  getClientIp,
  readJsonBody,
} from "@/lib/request-security"

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
})

const genericResponse = {
  message:
    "إذا كان البريد مسجلًا وفعّالًا، ستصلك رسالة تحتوي على رابط إعادة التعيين.",
}

function getPublicOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN?.trim()

  if (!configuredOrigin && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production")
  }

  const origin = configuredOrigin || new URL(request.url).origin
  const parsed = new URL(origin)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use http or https")
  }

  return parsed.origin
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const body = await readJsonBody(request, 8 * 1024)
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return err("البريد الإلكتروني غير صحيح", 400, parsed.error.flatten())
    }

    const { email } = parsed.data
    const clientIp = getClientIp(request)
    const publicOrigin = getPublicOrigin(request)

    await enforceRateLimit({
      namespace: "forgot-password-ip",
      identifier: clientIp,
      limit: 8,
      windowMs: 60 * 60 * 1000,
    })

    await enforceRateLimit({
      namespace: "forgot-password-account",
      identifier: email,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        isActive: true,
      },
    })

    if (!user?.isActive) {
      return ok(genericResponse)
    }

    const rawToken = createRawPasswordResetToken()
    const tokenHash = hashPasswordResetToken(rawToken)
    const expiresAt = getPasswordResetExpiry()
    const resetTokenId = crypto.randomUUID()
    const userAgent = request.headers.get("user-agent")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = NOW()
        WHERE "userId" = ${user.id}
          AND "usedAt" IS NULL
      `

      await tx.$executeRaw`
        INSERT INTO "PasswordResetToken" (
          "id",
          "companyId",
          "userId",
          "tokenHash",
          "expiresAt",
          "requestIp",
          "userAgent"
        )
        VALUES (
          ${resetTokenId},
          ${user.companyId},
          ${user.id},
          ${tokenHash},
          ${expiresAt},
          ${clientIp},
          ${userAgent}
        )
      `

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.USER_UPDATED,
        entityType: "PasswordReset",
        entityId: resetTokenId,
        message: "تم طلب إعادة تعيين كلمة المرور",
        metadata: {
          event: "PASSWORD_RESET_REQUESTED",
          expiresAt: expiresAt.toISOString(),
        },
        ipAddress: clientIp,
        userAgent,
        db: tx,
      })
    })

    const resetUrl = `${publicOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`

    try {
      await sendPasswordResetEmail({
        to: user.email,
        recipientName: user.name,
        resetUrl,
      })
    } catch (emailError) {
      await prisma.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = NOW()
        WHERE "id" = ${resetTokenId}
          AND "usedAt" IS NULL
      `
      console.error("[PASSWORD_RESET_EMAIL_ERROR]", emailError)
    }

    return ok(genericResponse)
  } catch (error) {
    return handleApiError(
      error,
      "FORGOT_PASSWORD_ERROR",
      "تعذر معالجة طلب استعادة كلمة المرور"
    )
  }
}
