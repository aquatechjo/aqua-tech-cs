import { ActivityAction } from "@/generated/prisma/enums"
import type { Prisma } from "@/generated/prisma/client"
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
  db = prisma,
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
  db?: Prisma.TransactionClient | typeof prisma
}) {
  await db.activityLog.create({
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
