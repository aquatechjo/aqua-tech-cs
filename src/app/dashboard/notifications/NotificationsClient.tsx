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
      <div className="aqua-card-soft p-5 text-center aqua-soft">
        لا توجد تنبيهات حتى الآن.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-end mb-3">
        <button
          type="button"
          onClick={readAll}
          disabled={readAllLoading}
          className="btn aqua-btn-ghost btn-sm"
        >
          {readAllLoading ? "جاري التحديث..." : "تحديد الكل كمقروء"}
        </button>
      </div>

      <div className="d-flex flex-column gap-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`aqua-card-soft p-3 ${
              notification.isRead ? "opacity-75" : ""
            }`}
          >
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div className="flex-grow-1">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className={`badge ${typeBadge(notification.type)}`}>
                    {notification.type}
                  </span>

                  {!notification.isRead ? (
                    <span className="aqua-badge">Unread</span>
                  ) : (
                    <span className="badge text-bg-secondary">Read</span>
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

                <div className="small aqua-soft mt-2" dir="ltr">
                  Created:{" "}
                  {new Date(notification.createdAt).toLocaleString("en-GB")}
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
