import {
  Activity,
  AlertTriangle,
  ArrowUpLeft,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  Inbox,
  ListTodo,
  PhoneCall,
  ReceiptText,
  type LucideIcon,
} from "lucide-react"

import {
  AquaBadge,
  AquaCard,
  AquaDataPanel,
  AquaEmptyState,
  AquaLinkButton,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"
import type { Prisma } from "@/generated/prisma/client"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { businessDate } from "@/lib/finance"
import {
  classifyMyDayDueDate,
  type MyDayBucket,
} from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"
import { followUpBucket, OPEN_SALES_STAGES } from "@/lib/sales"

type DashboardMetric = {
  label: string
  value: number
  hint: string
  href: string
  icon: LucideIcon
  tone: "aqua" | "blue" | "success" | "warning" | "danger"
}

type DashboardAttentionItem = {
  label: string
  value: number
  hint: string
  href: string
  icon: LucideIcon
  variant: AquaBadgeVariant
}

const priorityRank: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const bucketRank: Record<MyDayBucket, number> = {
  OVERDUE: 0,
  TODAY: 1,
  UPCOMING: 3,
  NO_DUE_DATE: 4,
  LATER: 5,
}

function formatActivityTimestamp(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value)
}

function formatOperationalDay(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(value)
}

function formatTaskDueDate(value: Date | null, timeZone: string) {
  if (!value) return "دون موعد"

  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(value)
}

function taskDueLabel(bucket: MyDayBucket, dueDate: Date | null) {
  if (!dueDate) return "دون موعد"

  return (
    {
      OVERDUE: "متأخرة",
      TODAY: "اليوم",
      UPCOMING: "قادمة",
      LATER: "لاحقًا",
      NO_DUE_DATE: "دون موعد",
    } satisfies Record<MyDayBucket, string>
  )[bucket]
}

function taskDueVariant(bucket: MyDayBucket): AquaBadgeVariant {
  return (
    {
      OVERDUE: "danger",
      TODAY: "warning",
      UPCOMING: "aqua",
      LATER: "blue",
      NO_DUE_DATE: "muted",
    } satisfies Record<MyDayBucket, AquaBadgeVariant>
  )[bucket]
}

function taskStatusLabel(status: string) {
  return (
    {
      TODO: "للعمل",
      IN_PROGRESS: "قيد التنفيذ",
      BLOCKED: "متعطلة",
      REVIEW: "للمراجعة",
    }[status] ?? status
  )
}

function taskStatusVariant(status: string): AquaBadgeVariant {
  return (
    {
      TODO: "muted",
      IN_PROGRESS: "aqua",
      BLOCKED: "danger",
      REVIEW: "warning",
    }[status] as AquaBadgeVariant | undefined
  ) ?? "muted"
}

export default async function DashboardPage() {
  const user = await requireAuth()
  const now = new Date()
  const timeZone = user.company.timezone || "Asia/Amman"
  const today = businessDate(now, timeZone)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  const canViewCompanyActivity = hasRole(user.role, ACCESS_ROLES.activityLog)
  const canViewCompanyTasks = hasRole(user.role, ACCESS_ROLES.taskManagement)
  const canViewCompanyProjects = hasRole(
    user.role,
    ACCESS_ROLES.projectManagement
  )
  const canViewServiceRequests = hasRole(
    user.role,
    ACCESS_ROLES.serviceRequestManagement
  )
  const canViewSales = hasRole(user.role, ACCESS_ROLES.salesRead)
  const canViewFinance = hasRole(user.role, ACCESS_ROLES.financeRead)
  const canApproveTime = hasRole(user.role, ACCESS_ROLES.timeApproval)
  const canApproveLeave = hasRole(user.role, ACCESS_ROLES.leaveApproval)
  const canApproveExpenses = hasRole(
    user.role,
    ACCESS_ROLES.financeManagement
  )

  const taskVisibility: Prisma.TaskWhereInput = canViewCompanyTasks
    ? {}
    : {
        OR: [
          { assignedToId: user.id },
          {
            participants: {
              some: {
                employeeProfile: {
                  userId: user.id,
                },
              },
            },
          },
        ],
      }

  const activeTaskWhere: Prisma.TaskWhereInput = {
    companyId: user.companyId,
    status: {
      notIn: ["DONE", "CANCELLED", "ARCHIVED"],
    },
    ...taskVisibility,
  }

  const projectVisibility: Prisma.ProjectWhereInput = canViewCompanyProjects
    ? {}
    : {
        OR: [
          {
            members: {
              some: {
                employeeProfile: {
                  userId: user.id,
                },
              },
            },
          },
          {
            tasks: {
              some: {
                OR: [
                  { assignedToId: user.id },
                  {
                    participants: {
                      some: {
                        employeeProfile: {
                          userId: user.id,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      }

  const [
    overdueTaskCount,
    todayTaskCount,
    inProgressTaskCount,
    blockedTaskCount,
    unscheduledTaskCount,
    activeProjectCount,
    rawFocusTasks,
    recentActivities,
    newServiceRequestCount,
    salesFollowUps,
    overdueInvoiceCount,
    submittedTimesheetCount,
    pendingLeaveRequestCount,
    submittedExpenseCount,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        ...activeTaskWhere,
        dueDate: { lt: today },
      },
    }),
    prisma.task.count({
      where: {
        ...activeTaskWhere,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...activeTaskWhere,
        status: "IN_PROGRESS",
      },
    }),
    prisma.task.count({
      where: {
        ...activeTaskWhere,
        AND: [
          {
            OR: [
              { status: "BLOCKED" },
              {
                blockers: {
                  some: { status: "OPEN" },
                },
              },
            ],
          },
        ],
      },
    }),
    prisma.task.count({
      where: {
        ...activeTaskWhere,
        dueDate: null,
      },
    }),
    prisma.project.count({
      where: {
        companyId: user.companyId,
        status: "IN_PROGRESS",
        ...projectVisibility,
      },
    }),
    prisma.task.findMany({
      where: {
        ...activeTaskWhere,
        AND: [
          {
            OR: [
              { dueDate: { lt: tomorrow } },
              { status: "BLOCKED" },
              {
                blockers: {
                  some: { status: "OPEN" },
                },
              },
            ],
          },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        blockers: {
          where: { status: "OPEN" },
          select: { id: true },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: {
        companyId: user.companyId,
        ...(canViewCompanyActivity ? {} : { userId: user.id }),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    }),
    canViewServiceRequests
      ? prisma.serviceRequest.count({
          where: {
            companyId: user.companyId,
            status: "NEW",
          },
        })
      : Promise.resolve(null),
    canViewSales
      ? prisma.salesOpportunity.findMany({
          where: {
            companyId: user.companyId,
            stage: { in: [...OPEN_SALES_STAGES] },
            nextFollowUpAt: { not: null },
          },
          select: {
            nextFollowUpAt: true,
          },
        })
      : Promise.resolve([]),
    canViewFinance
      ? prisma.invoice.count({
          where: {
            companyId: user.companyId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
            dueDate: { lt: today },
          },
        })
      : Promise.resolve(null),
    canApproveTime
      ? prisma.timesheet.count({
          where: {
            companyId: user.companyId,
            status: "SUBMITTED",
            ...(user.role === "OWNER"
              ? {}
              : { userId: { not: user.id } }),
          },
        })
      : Promise.resolve(null),
    canApproveLeave
      ? prisma.leaveRequest.count({
          where: {
            companyId: user.companyId,
            status: "PENDING",
            ...(user.role === "OWNER"
              ? {}
              : { userId: { not: user.id } }),
          },
        })
      : Promise.resolve(null),
    canApproveExpenses
      ? prisma.expense.count({
          where: {
            companyId: user.companyId,
            status: "SUBMITTED",
            ...(user.role === "OWNER"
              ? {}
              : { createdById: { not: user.id } }),
          },
        })
      : Promise.resolve(null),
  ])

  const overdueSalesFollowUps = salesFollowUps.filter(
    (item) =>
      followUpBucket({
        followUpAt: item.nextFollowUpAt,
        now,
        timeZone,
      }) === "OVERDUE"
  ).length

  const focusTasks = rawFocusTasks
    .map((task) => ({
      ...task,
      bucket: classifyMyDayDueDate(task.dueDate, now, timeZone),
    }))
    .sort((first, second) => {
      const firstBlocked =
        first.status === "BLOCKED" || first.blockers.length > 0
      const secondBlocked =
        second.status === "BLOCKED" || second.blockers.length > 0
      const firstRank = firstBlocked
        ? Math.min(bucketRank[first.bucket], 2)
        : bucketRank[first.bucket]
      const secondRank = secondBlocked
        ? Math.min(bucketRank[second.bucket], 2)
        : bucketRank[second.bucket]

      if (firstRank !== secondRank) return firstRank - secondRank

      const priorityDifference =
        (priorityRank[first.priority] ?? 4) -
        (priorityRank[second.priority] ?? 4)
      if (priorityDifference !== 0) return priorityDifference

      return (
        (first.dueDate?.getTime() ?? Number.POSITIVE_INFINITY) -
        (second.dueDate?.getTime() ?? Number.POSITIVE_INFINITY)
      )
    })
    .slice(0, 5)

  const metrics: DashboardMetric[] = [
    {
      label: canViewCompanyTasks ? "مهام متأخرة" : "مهامي المتأخرة",
      value: overdueTaskCount,
      hint:
        overdueTaskCount > 0
          ? "تحتاج تحديثًا أو إغلاقًا"
          : "لا يوجد تأخير حاليًا",
      href: "/dashboard/tasks",
      icon: AlertTriangle,
      tone: overdueTaskCount > 0 ? "danger" : "success",
    },
    {
      label: canViewCompanyTasks ? "مستحقة اليوم" : "مستحقة لي اليوم",
      value: todayTaskCount,
      hint:
        todayTaskCount > 0
          ? "ضمن تركيز يوم العمل"
          : "لا توجد استحقاقات اليوم",
      href: "/dashboard/my-day",
      icon: CalendarClock,
      tone: todayTaskCount > 0 ? "warning" : "success",
    },
    {
      label: canViewCompanyTasks ? "مهام قيد التنفيذ" : "مهامي قيد التنفيذ",
      value: inProgressTaskCount,
      hint:
        inProgressTaskCount > 0
          ? "عمل جارٍ يحتاج متابعة"
          : "لا توجد مهام قيد التنفيذ",
      href: "/dashboard/tasks",
      icon: ListTodo,
      tone: "aqua",
    },
    {
      label: canViewCompanyProjects
        ? "مشاريع قيد التنفيذ"
        : "مشاريعي الجارية",
      value: activeProjectCount,
      hint:
        activeProjectCount > 0
          ? "مشاريع تتحرك حاليًا"
          : "لا توجد مشاريع جارية",
      href: "/dashboard/projects",
      icon: FolderKanban,
      tone: "blue",
    },
  ]

  const attentionItems = ([
    {
      label: "مهام متعطلة",
      value: blockedTaskCount,
      hint: "عوائق مفتوحة أو حالة تنفيذ متعطلة",
      href: "/dashboard/tasks",
      icon: Ban,
      variant: blockedTaskCount > 0 ? "danger" : "success",
    },
    {
      label: "مهام دون موعد",
      value: unscheduledTaskCount,
      hint: "تحتاج تاريخًا واضحًا أو قرارًا",
      href: "/dashboard/tasks",
      icon: CalendarOff,
      variant: unscheduledTaskCount > 0 ? "warning" : "success",
    },
    ...(newServiceRequestCount === null
      ? []
      : [
          {
            label: "طلبات خدمة جديدة",
            value: newServiceRequestCount,
            hint: "لم يبدأ التواصل معها بعد",
            href: "/dashboard/service-requests",
            icon: Inbox,
            variant:
              newServiceRequestCount > 0
                ? ("aqua" as const)
                : ("success" as const),
          },
        ]),
    ...(canViewSales
      ? [
          {
            label: "متابعات مبيعات متأخرة",
            value: overdueSalesFollowUps,
            hint: "فرص مفتوحة تجاوزت موعد المتابعة",
            href: "/dashboard/sales",
            icon: PhoneCall,
            variant:
              overdueSalesFollowUps > 0
                ? ("warning" as const)
                : ("success" as const),
          },
        ]
      : []),
    ...(overdueInvoiceCount === null
      ? []
      : [
          {
            label: "فواتير متأخرة",
            value: overdueInvoiceCount,
            hint: "صادرة أو مدفوعة جزئيًا بعد الاستحقاق",
            href: "/dashboard/finance/invoices",
            icon: CircleDollarSign,
            variant:
              overdueInvoiceCount > 0
                ? ("danger" as const)
                : ("success" as const),
          },
        ]),
    ...(submittedTimesheetCount === null
      ? []
      : [
          {
            label: "سجلات ساعات معلقة",
            value: submittedTimesheetCount,
            hint: "بانتظار الاعتماد أو الإرجاع",
            href: "/dashboard/time",
            icon: ClipboardCheck,
            variant: "warning" as const,
          },
        ]),
    ...(pendingLeaveRequestCount === null
      ? []
      : [
          {
            label: "طلبات إجازة معلقة",
            value: pendingLeaveRequestCount,
            hint: "بانتظار قرار الإدارة",
            href: "/dashboard/hr",
            icon: CalendarCheck,
            variant: "warning" as const,
          },
        ]),
    ...(submittedExpenseCount === null
      ? []
      : [
          {
            label: "مصروفات معلقة",
            value: submittedExpenseCount,
            hint: "مرسلة للاعتماد المالي",
            href: "/dashboard/finance/expenses",
            icon: ReceiptText,
            variant: "warning" as const,
          },
        ]),
  ] satisfies DashboardAttentionItem[]).filter((item) => item.value > 0)

  const activeAttentionPaths = attentionItems.filter(
    (item) => item.value > 0
  ).length

  return (
    <div className="aqua-dashboard-overview">
      <AquaCard
        variant="surface"
        padding="md"
        glow
        className="aqua-dashboard-summary"
      >
        <div className="aqua-dashboard-summary__copy">
          <span className="aqua-dashboard-summary__eyebrow">ملخص التشغيل</span>
          <h1>ما يحتاج انتباهك اليوم</h1>
          <p>
            المهام والاستحقاقات والطوابير التي تحتاج قرارًا، مرتبة قبل التفاصيل
            والسجل التاريخي.
          </p>
        </div>

        <div className="aqua-dashboard-summary__context">
          <div className="aqua-dashboard-summary__date">
            <Clock3 aria-hidden="true" />
            <span>{formatOperationalDay(now, timeZone)}</span>
          </div>

          <div className="aqua-dashboard-summary__actions">
            <AquaLinkButton
              href="/dashboard/my-day"
              variant="primary"
              size="sm"
              trailingIcon={<ArrowUpLeft />}
            >
              افتح يومي
            </AquaLinkButton>
          </div>
        </div>
      </AquaCard>

      <section className="aqua-dashboard-metrics" aria-label="مؤشرات اليوم">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon

          return (
            <AquaCard
              key={metric.label}
              variant="soft"
              padding="sm"
              className="aqua-dashboard-metric"
              data-tone={metric.tone}
            >
              <span className="aqua-dashboard-metric__icon" aria-hidden="true">
                <MetricIcon />
              </span>

              <div className="aqua-dashboard-metric__copy">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </div>

              <AquaLinkButton
                href={metric.href}
                variant="ghost"
                size="sm"
                trailingIcon={<ArrowUpLeft />}
                aria-label={`فتح ${metric.label}`}
              >
                عرض
              </AquaLinkButton>
            </AquaCard>
          )
        })}
      </section>

      <div className="aqua-dashboard-workspace">
        <AquaDataPanel
          title="تركيز اليوم"
          description={
            canViewCompanyTasks
              ? "أقرب مهام الفريق المتأخرة أو المستحقة أو المتعطلة."
              : "أقرب مهامك المتأخرة أو المستحقة أو المتعطلة."
          }
          meta={
            <AquaBadge
              variant={focusTasks.length > 0 ? "warning" : "success"}
              size="sm"
            >
              {focusTasks.length > 0
                ? `${focusTasks.length} ظاهرة`
                : "لا يوجد ضغط عاجل"}
            </AquaBadge>
          }
          footer={
            <AquaLinkButton
              href="/dashboard/my-day"
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowUpLeft />}
            >
              فتح تفاصيل يومي
            </AquaLinkButton>
          }
        >
          {focusTasks.length === 0 ? (
            <AquaEmptyState
              compact
              icon={<CheckCircle2 />}
              title="لا توجد مهام عاجلة"
              description="المهام المتأخرة ومستحقات اليوم والعوائق ستظهر هنا."
            />
          ) : (
            <ol className="aqua-dashboard-focus-list">
              {focusTasks.map((task) => {
                const blocked =
                  task.status === "BLOCKED" || task.blockers.length > 0

                return (
                  <li key={task.id} className="aqua-dashboard-focus-item">
                    <span
                      className="aqua-dashboard-focus-item__icon"
                      data-blocked={blocked}
                      aria-hidden="true"
                    >
                      {blocked ? <Ban /> : <ListTodo />}
                    </span>

                    <div className="aqua-dashboard-focus-item__copy">
                      <strong>{task.title}</strong>
                      <span>
                        {task.project?.name ?? "مهمة تشغيلية غير مرتبطة بمشروع"}
                      </span>
                    </div>

                    <div className="aqua-dashboard-focus-item__badges">
                      <AquaBadge
                        variant={taskStatusVariant(task.status)}
                        size="sm"
                      >
                        {taskStatusLabel(task.status)}
                      </AquaBadge>
                      <AquaBadge
                        variant={taskDueVariant(task.bucket)}
                        size="sm"
                      >
                        {taskDueLabel(task.bucket, task.dueDate)}
                        {task.dueDate
                          ? ` • ${formatTaskDueDate(task.dueDate, timeZone)}`
                          : ""}
                      </AquaBadge>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </AquaDataPanel>

        <AquaDataPanel
          title="يحتاج إجراء"
          description="طوابير تشغيلية مجمعة حسب صلاحيات حسابك."
          className="aqua-dashboard-attention-panel"
          meta={
            <AquaBadge
              variant={activeAttentionPaths > 0 ? "warning" : "success"}
              size="sm"
            >
              {activeAttentionPaths} نشطة
            </AquaBadge>
          }
        >
          {attentionItems.length === 0 ? (
            <AquaEmptyState
              compact
              icon={<CheckCircle2 />}
              title="لا توجد طوابير معلقة"
              description="ستظهر هنا فقط البنود التي تحتاج إجراءً فعليًا."
            />
          ) : (
            <div className="aqua-dashboard-attention-list">
              {attentionItems.map((item) => {
                const AttentionIcon = item.icon

                return (
                  <AquaCard
                    key={item.label}
                    variant="outlined"
                    padding="sm"
                    className="aqua-dashboard-attention-item"
                  >
                    <span
                      className="aqua-dashboard-attention-item__icon"
                      aria-hidden="true"
                    >
                      <AttentionIcon />
                    </span>

                    <div className="aqua-dashboard-attention-item__copy">
                      <div>
                        <strong>{item.label}</strong>
                        <AquaBadge variant={item.variant} size="sm">
                          {item.value}
                        </AquaBadge>
                      </div>
                      <span>{item.hint}</span>
                    </div>

                    <AquaLinkButton
                      href={item.href}
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ArrowUpLeft />}
                      aria-label={`فتح ${item.label}`}
                    >
                      فتح
                    </AquaLinkButton>
                  </AquaCard>
                )
              })}
            </div>
          )}
        </AquaDataPanel>
      </div>

      <AquaDataPanel
        title="آخر 5 أنشطة"
        description={
          canViewCompanyActivity
            ? "أحدث التغييرات المسجلة على مستوى الشركة."
            : "أحدث التغييرات المرتبطة بحسابك."
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
                  <strong>{activity.message || "تم تسجيل نشاط جديد"}</strong>
                  <span>{activity.user?.name ?? "النظام"}</span>
                </div>

                <time
                  dateTime={activity.createdAt.toISOString()}
                  className="aqua-dashboard-activity-item__time"
                >
                  {formatActivityTimestamp(activity.createdAt, timeZone)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </AquaDataPanel>
    </div>
  )
}
