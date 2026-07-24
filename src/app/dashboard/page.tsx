import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACCESS_ROLES, hasRole } from "@/lib/access-control";

export default async function DashboardPage() {
  const user = await requireAuth();
  const canViewCompanyActivity = hasRole(
    user.role,
    ACCESS_ROLES.activityLog,
  );

  const [teamCount, activeSessions, unreadNotifications, recentActivities] =
    await Promise.all([
      prisma.user.count({
        where: { companyId: user.companyId },
      }),

      prisma.session.count({
        where: {
          companyId: user.companyId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      }),

      prisma.notification.count({
        where: {
          companyId: user.companyId,
          userId: user.id,
          isRead: false,
        },
      }),

      prisma.activityLog.findMany({
        where: {
          companyId: user.companyId,
          ...(canViewCompanyActivity ? {} : { userId: user.id }),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    {
      label: "أعضاء الفريق",
      value: teamCount,
      hint: "Core team users",
    },
    {
      label: "الجلسات النشطة",
      value: activeSessions,
      hint: "Active secure sessions",
    },
    {
      label: "تنبيهات غير مقروءة",
      value: unreadNotifications,
      hint: "Pending alerts",
    },
  ];

  return (
    <div>
      <div className="aqua-card aqua-hero p-4 p-lg-5 mb-4">
        <div className="row align-items-center g-4 w-100">
          <div className="col-12 col-lg-8">
            <span className="aqua-badge">Core System Online</span>

            <h2 className="display-6 fw-black mt-4 mb-3">
              النظام الداخلي لشركة{" "}
              <span className="aqua-text-gradient" dir="ltr">
                Aqua.Tech
              </span>
            </h2>

            <p className="aqua-muted lh-lg mb-0">
              هاي أول نسخة من AquaFlow. حاليًا مفعّل: تسجيل الدخول، الجلسات،
              المستخدمين، التنبيهات، وسجل النشاطات. بعدها بنضيف العملاء،
              المشاريع، المهام، والفواتير.
            </p>
          </div>

          <div className="col-12 col-lg-4">
            <div
              className="aqua-card-soft p-4 text-lg-start text-center"
              dir="ltr"
            >
              <div className="small aqua-soft mb-2">AQUA.TECH OS</div>
              <div className="display-6 fw-black aqua-text-gradient">
                AquaFlow
              </div>
              <div className="small aqua-muted mt-2">Build. Launch. Grow.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {stats.map((stat) => (
          <div className="col-12 col-md-4" key={stat.label}>
            <div className="aqua-card aqua-stat-card p-4 h-100">
              <div className="aqua-muted small">{stat.label}</div>
              <div className="aqua-stat-number fw-black aqua-text-gradient mt-3">
                {stat.value}
              </div>
              <div className="small aqua-soft mt-3" dir="ltr">
                {stat.hint}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="aqua-card p-4">
        <div className="d-flex align-items-start justify-content-between mb-4">
          <div>
            <h2 className="aqua-section-title mb-1">آخر النشاطات</h2>
            <p className="small aqua-muted mb-0">
              أحدث العمليات التي تمت داخل النظام
            </p>
          </div>

          <span className="aqua-badge">Activity</span>
        </div>

        {recentActivities.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-soft">
            لا توجد نشاطات بعد
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="aqua-card-soft aqua-activity-row p-3 d-flex align-items-center justify-content-between gap-3"
              >
                <div>
                  <div className="fw-bold">
                    {activity.message || activity.action}
                  </div>
                  <div className="small text-info mt-1">{activity.action}</div>
                </div>

                <div className="small aqua-soft text-start" dir="ltr">
                  {activity.createdAt.toLocaleString("en-GB")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
