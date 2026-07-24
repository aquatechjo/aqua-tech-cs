import { ActivityAction } from "@/generated/prisma/enums"
import { err, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin } from "@/lib/request-security"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)

    const user = await requireAuth()
    const { id } = await params

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        companyId: user.companyId,
        userId: user.id,
      },
    })

    if (!notification) {
      return err("التنبيه غير موجود", 404)
    }

    const meta = await getRequestMeta()

    const updatedNotification = await prisma.$transaction(async (tx) => {
      const updated = await tx.notification.update({
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

      await logActivity({
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.NOTIFICATION_READ,
        entityType: "Notification",
        entityId: id,
        message: `تم قراءة التنبيه: ${notification.title}`,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        db: tx,
      })

      return updated
    })

    return ok({ notification: updatedNotification })
  } catch (error) {
    return handleApiError(
      error,
      "NOTIFICATION_READ_ERROR",
      "حدث خطأ أثناء قراءة التنبيه"
    )
  }
}
