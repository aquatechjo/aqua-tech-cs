import "server-only"

import { cookies, headers } from "next/headers"
import type { AccessRole } from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/lib/session"

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  const tokenHash = hashSessionToken(token)

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
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

  if (!session) return null

  return session.user
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
