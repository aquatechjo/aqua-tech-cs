import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { ApiError, err, handleApiError, ok } from "@/lib/api-response"
import { hashPassword, verifyPassword } from "@/lib/password"
import {
  hashPasswordResetToken,
  isPasswordResetTokenUsable,
} from "@/lib/password-reset"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  assertSameOrigin,
  getClientIp,
  readJsonBody,
} from "@/lib/request-security"

const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: z
      .string()
      .min(12, "كلمة المرور يجب أن تكون 12 حرفًا على الأقل")
      .max(128, "كلمة المرور أطول من الحد المسموح"),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmation"],
  })

type PasswordResetRow = {
  id: string
  companyId: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
  passwordHash: string
  isActive: boolean
}

const invalidTokenMessage =
  "رابط إعادة التعيين غير صالح أو منتهي. اطلب رابطًا جديدًا."

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const body = await readJsonBody(request, 12 * 1024)
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const { token, password } = parsed.data
    const tokenHash = hashPasswordResetToken(token)
    const clientIp = getClientIp(request)

    await enforceRateLimit({
      namespace: "reset-password-ip",
      identifier: clientIp,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })

    await enforceRateLimit({
      namespace: "reset-password-token",
      identifier: tokenHash,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })

    const rows = await prisma.$queryRaw<PasswordResetRow[]>`
      SELECT
        token."id",
        token."companyId",
        token."userId",
        token."expiresAt",
        token."usedAt",
        app_user."passwordHash",
        app_user."isActive"
      FROM "PasswordResetToken" AS token
      INNER JOIN "User" AS app_user
        ON app_user."id" = token."userId"
      WHERE token."tokenHash" = ${tokenHash}
      LIMIT 1
    `

    const resetToken = rows[0]

    if (
      !resetToken ||
      !resetToken.isActive ||
      !isPasswordResetTokenUsable({
        expiresAt: resetToken.expiresAt,
        usedAt: resetToken.usedAt,
      })
    ) {
      return err(invalidTokenMessage, 400)
    }

    if (await verifyPassword(password, resetToken.passwordHash)) {
      return err("اختر كلمة مرور مختلفة عن كلمة المرور الحالية", 400)
    }

    const passwordHash = await hashPassword(password)
    const now = new Date()
    const userAgent = request.headers.get("user-agent")

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = ${now}
        WHERE "id" = ${resetToken.id}
          AND "usedAt" IS NULL
          AND "expiresAt" > ${now}
      `

      if (Number(consumed) !== 1) {
        throw new ApiError(invalidTokenMessage, 400, "INVALID_RESET_TOKEN")
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      })

      await tx.session.updateMany({
        where: { userId: resetToken.userId },
        data: { isActive: false },
      })

      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = ${now}
        WHERE "userId" = ${resetToken.userId}
          AND "usedAt" IS NULL
      `

      await logActivity({
        companyId: resetToken.companyId,
        userId: resetToken.userId,
        action: ActivityAction.USER_UPDATED,
        entityType: "PasswordReset",
        entityId: resetToken.id,
        message: "تم تغيير كلمة المرور وإلغاء الجلسات القديمة",
        metadata: {
          event: "PASSWORD_RESET_COMPLETED",
          sessionsRevoked: true,
        },
        ipAddress: clientIp,
        userAgent,
        db: tx,
      })
    })

    return ok({ message: "تم تغيير كلمة المرور بنجاح" })
  } catch (error) {
    return handleApiError(
      error,
      "RESET_PASSWORD_ERROR",
      "تعذر تغيير كلمة المرور"
    )
  }
}
