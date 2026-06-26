import AquaPagination from "@/components/aqua/AquaPagination"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import { NotificationType } from "@/generated/prisma/enums"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import NotificationsClient from "./NotificationsClient"

const PAGE_SIZE = 12

function parsePage(value: string | undefined) {
  const page = Number(value)

  if (!Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const user = await requireAuth()
  const resolvedSearchParams = await searchParams
  const requestedPage = parsePage(resolvedSearchParams.page)

  const where = {
    companyId: user.companyId,
    OR: [{ userId: user.id }, { userId: null }],
  }

  const [totalNotifications, unreadCount, notificationsByType] =
    await Promise.all([
      prisma.notification.count({ where }),

      prisma.notification.count({
        where: {
          ...where,
          isRead: false,
        },
      }),

      prisma.notification.groupBy({
        by: ["type"],
        where,
        _count: {
          type: true,
        },
      }),
    ])

  const totalPages = Math.max(1, Math.ceil(totalNotifications / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      isRead: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      readAt: true,
    },
  })

  const typeCounts: Record<NotificationType, number> = {
    INFO: 0,
    SUCCESS: 0,
    WARNING: 0,
    ERROR: 0,
  }

  for (const item of notificationsByType) {
    typeCounts[item.type] = item._count.type
  }

  const from = totalNotifications === 0 ? 0 : skip + 1
  const to = Math.min(skip + notifications.length, totalNotifications)

  return (
    <div className="aqua-notifications-page">
      <div className="mb-3">
        <AquaPageHeader
          badge="Notifications Center"
          title="مركز التنبيهات"
          description="كل التنبيهات الداخلية الخاصة بالنظام، الفريق، والإجراءات المهمة داخل AquaFlow."
          brandValue="Alerts"
        />
      </div>

      <div className="aqua-card aqua-notifications-list-card p-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h3 className="h5 fw-black mb-1">قائمة التنبيهات</h3>
            <p className="small aqua-muted mb-0">
              عرض {from} - {to} من أصل {totalNotifications} تنبيه
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="aqua-badge">Total {totalNotifications}</span>
            <span className="aqua-badge">Unread {unreadCount}</span>
            <span className="aqua-badge">Success {typeCounts.SUCCESS}</span>
            <span className="aqua-badge">
              Warning/Error {typeCounts.WARNING + typeCounts.ERROR}
            </span>
            <span className="small aqua-soft ms-2" dir="ltr">
              Page {currentPage} / {totalPages}
            </span>
          </div>
        </div>

        <NotificationsClient notifications={notifications} />

        <div className="pt-3">
          <AquaPagination
            basePath="/dashboard/notifications"
            currentPage={currentPage}
            totalPages={totalPages}
          />
        </div>
      </div>
    </div>
  )
}