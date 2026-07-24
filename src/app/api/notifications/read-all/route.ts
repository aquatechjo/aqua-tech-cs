import { ActivityAction } from "@/generated/prisma/enums"
import { handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.notification.updateMany({
        where: {
          companyId: user.companyId,
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.NOTIFICATIONS_READ_ALL,
        entityType: "Notification",
        message: `تم قراءة كل التنبيهات غير المقروءة (${updated.count})`,
        metadata: {
          count: updated.count,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updated
    })

    return ok({
      count: result.count,
    })
  } catch (error) {
    return handleApiError(
      error,
      "NOTIFICATIONS_READ_ALL_ERROR",
      "حدث خطأ أثناء قراءة كل التنبيهات"
    )
  }
}
