import {
  Activity,
  ArrowUpLeft,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import {
  AquaBadge,
  AquaCard,
  AquaDataPanel,
  AquaEmptyState,
  AquaLinkButton,
  AquaMark,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"
import type { AccessRole } from "@/generated/prisma/enums"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type DashboardMetric = {
  label: string
  value: number
  hint: string
  icon: LucideIcon
  tone: "aqua" | "blue" | "success"
}

type DashboardQuickLink = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  enabled: boolean
}

const roleLabels: Record<AccessRole, string> = {
  OWNER: "مالك النظام",
  ADMIN: "مدير النظام",
  OPERATIONS_MANAGER: "مدير العمليات",
  SALES_MANAGER: "مدير المبيعات",
  FINANCE_MANAGER: "مدير المالية",
  MEMBER: "عضو الفريق",
}

function formatActivityTimestamp(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value)
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const canViewCompanyActivity = hasRole(user.role, ACCESS_ROLES.activityLog)

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
    ])

  const metrics: DashboardMetric[] = [
    {
      label: "أعضاء الفريق",
      value: teamCount,
      hint: "الحسابات المسجلة داخل الشركة",
      icon: UsersRound,
      tone: "aqua",
    },
    {
      label: "الجلسات النشطة",
      value: activeSessions,
      hint: "جلسات دخول آمنة وغير منتهية",
      icon: ShieldCheck,
      tone: "blue",
    },
    {
      label: "تنبيهات غير مقروءة",
      value: unreadNotifications,
      hint:
        unreadNotifications > 0
          ? "توجد عناصر تحتاج مراجعتك"
          : "لا توجد تنبيهات معلقة حاليًا",
      icon: BellRing,
      tone: "success",
    },
  ]

  const quickLinks: DashboardQuickLink[] = [
    {
      title: "ابدأ من يومي",
      description: "الأولوية والاستحقاق والمهام المسندة إليك.",
      href: "/dashboard/my-day",
      icon: Clock3,
      enabled: true,
    },
    {
      title: "راجع المهام",
      description: "تابع التنفيذ والمسؤوليات والمهام المتأخرة.",
      href: "/dashboard/tasks",
      icon: ListTodo,
      enabled: true,
    },
    {
      title: "تابع المشاريع",
      description: "المراحل والتقدم والفريق المسؤول عن التنفيذ.",
      href: "/dashboard/projects",
      icon: FolderKanban,
      enabled: true,
    },
    {
      title: "افتح المبيعات",
      description: "الفرص والمتابعات والعروض والتحويل التجاري.",
      href: "/dashboard/sales",
      icon: BriefcaseBusiness,
      enabled: hasRole(user.role, ACCESS_ROLES.salesRead),
    },
  ].filter((item) => item.enabled)

  const notificationStatus: {
    variant: AquaBadgeVariant
    label: string
  } =
    unreadNotifications > 0
      ? { variant: "warning", label: `${unreadNotifications} تحتاج مراجعة` }
      : { variant: "success", label: "لا توجد عناصر معلقة" }

  return (
    <div className="aqua-dashboard-overview">
      <AquaCard
        variant="surface"
        padding="lg"
        glow
        className="aqua-dashboard-hero"
      >
        <div className="aqua-dashboard-hero__copy">
          <div className="aqua-dashboard-hero__badges">
            <AquaBadge variant="aqua">Operations overview</AquaBadge>
            <AquaBadge variant="success" dot>
              النظام متصل
            </AquaBadge>
          </div>

          <span className="aqua-dashboard-hero__eyebrow" dir="ltr">
            AQUA.TECH INTERNAL OS
          </span>
          <h1>نظرة تشغيلية على {user.company.name}</h1>
          <p>
            ملخص مباشر لحالة الفريق والجلسات والتنبيهات، مع وصول سريع إلى العمل
            اليومي والمشاريع والعمليات التي تحتاج انتباهك.
          </p>

          <div className="aqua-dashboard-hero__actions">
            <AquaLinkButton
              href="/dashboard/my-day"
              variant="primary"
              trailingIcon={<ArrowUpLeft />}
            >
              افتح يومي
            </AquaLinkButton>
            <AquaLinkButton
              href="/dashboard/notifications"
              variant="secondary"
              leadingIcon={<BellRing />}
            >
              مركز التنبيهات
            </AquaLinkButton>
          </div>
        </div>

        <div className="aqua-dashboard-hero__identity">
          <AquaMark size="lg" />

          <dl className="aqua-dashboard-context-list">
            <div>
              <dt>الدور الحالي</dt>
              <dd>{roleLabels[user.role]}</dd>
            </div>
            <div>
              <dt>المنطقة الزمنية</dt>
              <dd dir="ltr">{user.company.timezone}</dd>
            </div>
            <div>
              <dt>حالة المتابعة</dt>
              <dd>
                <AquaBadge
                  variant={notificationStatus.variant}
                  size="sm"
                  dot
                >
                  {notificationStatus.label}
                </AquaBadge>
              </dd>
            </div>
          </dl>
        </div>
      </AquaCard>

      <section className="aqua-dashboard-metrics" aria-label="مؤشرات التشغيل">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon

          return (
            <AquaCard
              key={metric.label}
              variant="soft"
              padding="md"
              className="aqua-dashboard-metric"
              data-tone={metric.tone}
            >
              <div className="aqua-dashboard-metric__icon" aria-hidden="true">
                <MetricIcon />
              </div>
              <div className="aqua-dashboard-metric__copy">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </div>
            </AquaCard>
          )
        })}
      </section>

      <div className="aqua-dashboard-workspace">
        <AquaDataPanel
          eyebrow="Recent activity"
          title="آخر النشاطات"
          description={
            canViewCompanyActivity
              ? "أحدث العمليات المسجلة على مستوى الشركة."
              : "أحدث العمليات المرتبطة بحسابك."
          }
          meta={
            <AquaBadge variant="muted" size="sm">
              آخر {recentActivities.length} عمليات
            </AquaBadge>
          }
          footer={
            canViewCompanyActivity ? (
              <AquaLinkButton
                href="/dashboard/activity"
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowUpLeft />}
              >
                عرض سجل النشاط
              </AquaLinkButton>
            ) : (
              <span className="aqua-dashboard-panel-note">
                يظهر لك نشاط حسابك فقط وفق الصلاحيات الحالية.
              </span>
            )
          }
        >
          {recentActivities.length === 0 ? (
            <AquaEmptyState
              compact
              icon={<Activity />}
              title="لا توجد نشاطات بعد"
              description="ستظهر هنا أحدث العمليات بعد بدء استخدام النظام."
            />
          ) : (
            <ol className="aqua-dashboard-activity-list">
              {recentActivities.map((activity) => (
                <li key={activity.id} className="aqua-dashboard-activity-item">
                  <span
                    className="aqua-dashboard-activity-item__icon"
                    aria-hidden="true"
                  >
                    <Activity />
                  </span>

                  <div className="aqua-dashboard-activity-item__copy">
                    <strong>{activity.message || activity.action}</strong>
                    <span dir="ltr">{activity.action}</span>
                  </div>

                  <time
                    dateTime={activity.createdAt.toISOString()}
                    className="aqua-dashboard-activity-item__time"
                  >
                    {formatActivityTimestamp(
                      activity.createdAt,
                      user.company.timezone
                    )}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </AquaDataPanel>

        <AquaDataPanel
          eyebrow="Quick start"
          title="ابدأ من هنا"
          description="اختصارات لأكثر مسارات التشغيل استخدامًا."
          className="aqua-dashboard-quick-panel"
        >
          <div className="aqua-dashboard-quick-links">
            {quickLinks.map((item) => {
              const QuickLinkIcon = item.icon

              return (
                <AquaCard
                  key={item.href}
                  variant="outlined"
                  padding="sm"
                  className="aqua-dashboard-quick-link"
                >
                  <div className="aqua-dashboard-quick-link__heading">
                    <span aria-hidden="true">
                      <QuickLinkIcon />
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.description}</p>
                  <AquaLinkButton
                    href={item.href}
                    variant="ghost"
                    size="sm"
                    trailingIcon={<ArrowUpLeft />}
                    aria-label={`فتح ${item.title}`}
                  >
                    فتح
                  </AquaLinkButton>
                </AquaCard>
              )
            })}
          </div>

          <AquaCard
            variant="soft"
            padding="sm"
            className="aqua-dashboard-operational-note"
          >
            <CheckCircle2 aria-hidden="true" />
            <div>
              <strong>المرجع التشغيلي الأول</strong>
              <p>
                هذه الصفحة هي أول تطبيق Adoption كامل بعد تثبيت نظام التصميم،
                ومنها سنوحّد بقية صفحات AquaFlow تدريجيًا.
              </p>
            </div>
          </AquaCard>
        </AquaDataPanel>
      </div>
    </div>
  )
}
