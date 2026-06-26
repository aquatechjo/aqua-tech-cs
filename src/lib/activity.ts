import { ActivityAction } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function logActivity({
  companyId,
  userId,
  action,
  entityType,
  entityId,
  message,
  metadata,
  ipAddress,
  userAgent,
}: {
  companyId: string
  userId?: string | null
  action: ActivityAction
  entityType?: string
  entityId?: string
  message?: string
  metadata?: unknown
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await prisma.activityLog.create({
    data: {
      companyId,
      userId,
      action,
      entityType,
      entityId,
      message,
      metadata: metadata === undefined ? undefined : (metadata as object),
      ipAddress,
      userAgent,
    },
  })
}