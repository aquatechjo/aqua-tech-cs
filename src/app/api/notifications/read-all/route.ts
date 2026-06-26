import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const user = await requireAuth()

    const result = await prisma.notification.updateMany({
      where: {
        companyId: user.companyId,
        isRead: false,
        OR: [{ userId: user.id }, { userId: null }],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    const meta = await getRequestMeta()

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.NOTIFICATIONS_READ_ALL,
      entityType: "Notification",
      message: `تم قراءة كل التنبيهات غير المقروءة (${result.count})`,
      metadata: {
        count: result.count,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({
      count: result.count,
    })
  } catch (error) {
    console.error("[NOTIFICATIONS_READ_ALL_ERROR]", error)
    return err("حدث خطأ أثناء قراءة كل التنبيهات", 500)
  }
}