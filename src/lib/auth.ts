import "server-only"

import { cookies, headers } from "next/headers"
import type { AccessRole } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { hashSessionToken, readSessionCookies } from "@/lib/session"

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const sessionCookies = readSessionCookies(cookieStore)

  for (const sessionCookie of sessionCookies) {
    const session = await prisma.session.findFirst({
      where: {
        tokenHash: hashSessionToken(sessionCookie.value),
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          include: {
            company: true,
          },
        },
      },
    })

    if (session) return session.user
  }

  return null
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    throw new ApiError("غير مصرح", 401, "UNAUTHORIZED")
  }

  return user
}

export function requireRoles(
  role: AccessRole,
  allowedRoles: readonly AccessRole[],
  message = "لا تملك صلاحية تنفيذ هذا الإجراء"
) {
  if (!allowedRoles.includes(role)) {
    throw new ApiError(message, 403, "FORBIDDEN")
  }
}

export async function getRequestMeta() {
  const h = await headers()

  return {
    ipAddress:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
    userAgent: h.get("user-agent"),
  }
}
