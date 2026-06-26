import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        companyId: user.companyId,
        OR: [{ userId: user.id }, { userId: null }],
      },
    })

    if (!notification) {
      return err("التنبيه غير موجود", 404)
    }

    const updatedNotification = await prisma.notification.update({
      where: {
        id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    })

    const meta = await getRequestMeta()

    await logActivity({
      companyId: user.companyId,
      userId: user.id,
      action: ActivityAction.NOTIFICATION_READ,
      entityType: "Notification",
      entityId: id,
      message: `تم قراءة التنبيه: ${notification.title}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ notification: updatedNotification })
  } catch (error) {
    console.error("[NOTIFICATION_READ_ERROR]", error)
    return err("حدث خطأ أثناء قراءة التنبيه", 500)
  }
}