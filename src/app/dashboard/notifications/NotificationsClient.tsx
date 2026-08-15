"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationType } from "@/generated/prisma/enums";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
  readAt: Date | null;
};

function typeBadge(type: NotificationType) {
  if (type === "SUCCESS") return "text-bg-success";
  if (type === "WARNING") return "text-bg-warning";
  if (type === "ERROR") return "text-bg-danger";

  return "text-bg-info";
}

function typeLabel(type: NotificationType) {
  const labels: Record<NotificationType, string> = {
    INFO: "معلومة",
    SUCCESS: "نجاح",
    WARNING: "تنبيه",
    ERROR: "خطأ",
  };

  return labels[type];
}

export default function NotificationsClient({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [readAllLoading, setReadAllLoading] = useState(false);

  async function markAsRead(id: string) {
    setLoadingId(id);

    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });

      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function readAll() {
    setReadAllLoading(true);

    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      router.refresh();
    } finally {
      setReadAllLoading(false);
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="aqua-card-soft aqua-notifications-empty text-center aqua-soft">
        لا توجد تنبيهات حتى الآن.
      </div>
    );
  }

  return (
    <div className="aqua-notification-feed">
      <div className="aqua-notification-toolbar">
        <button
          type="button"
          onClick={readAll}
          disabled={readAllLoading}
          className="btn aqua-btn-ghost btn-sm"
        >
          {readAllLoading ? "جاري التحديث..." : "تحديد الكل كمقروء"}
        </button>
      </div>

      <div className="aqua-notification-list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`aqua-card-soft aqua-notification-item ${
              notification.isRead ? "" : "aqua-notification-item--unread"
            }`}
          >
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className={`badge ${typeBadge(notification.type)}`}>
                    {typeLabel(notification.type)}
                  </span>

                  {!notification.isRead ? (
                    <span className="aqua-badge">غير مقروء</span>
                  ) : (
                    <span className="badge text-bg-secondary">مقروء</span>
                  )}

                  {notification.entityType ? (
                    <span className="small aqua-soft" dir="ltr">
                      {notification.entityType}
                    </span>
                  ) : null}
                </div>

                <div className="fw-black">{notification.title}</div>
                <p className="small aqua-muted mb-0 mt-2">
                  {notification.message}
                </p>

                <div className="small aqua-soft mt-2 aqua-notification-time">
                  <span>وقت الإنشاء</span>
                  <time dir="ltr" dateTime={new Date(notification.createdAt).toISOString()}>
                    {new Date(notification.createdAt).toLocaleString("en-GB")}
                  </time>
                </div>
              </div>

              {!notification.isRead ? (
                <button
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  disabled={loadingId === notification.id}
                  className="btn aqua-btn-ghost btn-sm"
                >
                  {loadingId === notification.id ? "..." : "تحديد كمقروء"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
