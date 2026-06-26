import { NextResponse } from "next/server"
import { ActivityAction } from "@/generated/prisma/enums"
import { logActivity } from "@/lib/activity"
import { getCurrentUser, getRequestMeta } from "@/lib/auth"
import { err, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/session"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    const user = await getCurrentUser()
    const meta = await getRequestMeta()

    if (token) {
      await prisma.session.updateMany({
        where: {
          tokenHash: hashSessionToken(token),
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
      })
    }

    const response = ok({ message: "تم تسجيل الخروج بنجاح" })

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("[LOGOUT_ERROR]", error)
    return err("حدث خطأ أثناء تسجيل الخروج", 500)
  }
}