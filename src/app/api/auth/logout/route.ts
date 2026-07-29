import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { getCurrentUser, getRequestMeta } from "@/lib/auth"
import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"
import {
  SESSION_COOKIE_NAMES,
  hashSessionToken,
  readSessionCookies,
} from "@/lib/session"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const cookieStore = await cookies()
    const sessionCookies = readSessionCookies(cookieStore)
    const user = await getCurrentUser()
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      if (sessionCookies.length > 0) {
        await tx.session.updateMany({
          where: {
            tokenHash: {
              in: sessionCookies.map((cookie) =>
                hashSessionToken(cookie.value)
              ),
            },
          },
          data: {
            isActive: false,
          },
        })
      }

      if (user) {
        await logActivity({
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.LOGOUT,
          message: "تم تسجيل الخروج",
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          db: tx,
        })
      }
    })

    const response = ok({ message: "تم تسجيل الخروج بنجاح" })

    for (const cookieName of SESSION_COOKIE_NAMES) {
      response.cookies.set({
        name: cookieName,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
        priority: "high",
      })
    }

    return response
  } catch (error) {
    return handleApiError(
      error,
      "LOGOUT_ERROR",
      "حدث خطأ أثناء تسجيل الخروج"
    )
  }
}
