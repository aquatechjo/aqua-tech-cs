import { NextResponse } from "next/server"
import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  SESSION_COOKIE_NAME,
  createRawSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from "@/lib/session"
import { verifyPassword } from "@/lib/password"

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return err("البيانات المدخلة غير صحيحة", 400, parsed.error.flatten())
    }

    const { email, password } = parsed.data
    const meta = await getRequestMeta()

    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      include: {
        company: true,
      },
    })

    if (!user) {
      return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401)
    }

    if (!user.isActive) {
      return err("هذا الحساب غير مفعّل", 403)
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return err("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401)
    }

    const rawToken = createRawSessionToken()
    const tokenHash = hashSessionToken(rawToken)
    const expiresAt = getSessionExpiry()

    await prisma.session.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    })

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    })

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.LOGIN,
      message: "تم تسجيل الدخول",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
        },
      },
    })

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: rawToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    })

    return response
  } catch (error) {
    console.error("[LOGIN_ERROR]", error)
    return err("حدث خطأ أثناء تسجيل الدخول", 500)
  }
}