import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CircleDollarSign,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  ListTodo,
  PhoneCall,
  ReceiptText,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import {
  AquaBadge,
  AquaCard,
  AquaDataPanel,
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
  href: string
  icon: LucideIcon
  tone: "aqua" | "blue" | "success" | "warning" | "danger"
}

type DashboardAttentionItem = {
  label: string
  value: number
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
      take: 3,
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
      href: "/dashboard/tasks",
      icon: AlertTriangle,
      tone: overdueTaskCount > 0 ? "danger" : "success",
    },
    {
      label: canViewCompanyTasks ? "مستحقة اليوم" : "مستحقة لي اليوم",
      value: todayTaskCount,
      href: "/dashboard/my-day",
      icon: CalendarClock,
      tone: todayTaskCount > 0 ? "warning" : "success",
    },
    {
      label: canViewCompanyTasks ? "مهام قيد التنفيذ" : "مهامي قيد التنفيذ",
      value: inProgressTaskCount,
      href: "/dashboard/tasks",
      icon: ListTodo,
      tone: "aqua",
    },
    {
      label: canViewCompanyProjects
        ? "مشاريع قيد التنفيذ"
        : "مشاريعي الجارية",
      value: activeProjectCount,
      href: "/dashboard/projects",
      icon: FolderKanban,
      tone: "blue",
    },
  ]

  const attentionItems = ([
    {
      label: "مهام متعطلة",
      value: blockedTaskCount,
      href: "/dashboard/tasks",
      icon: Ban,
      variant: blockedTaskCount > 0 ? "danger" : "success",
    },
    {
      label: "مهام دون موعد",
      value: unscheduledTaskCount,
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
      <section className="aqua-dashboard-metrics" aria-label="مؤشرات اليوم">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon

          return (
            <Link
              key={metric.label}
              href={metric.href}
              className="aqua-dashboard-metric-link"
              aria-label={`${metric.label}: ${metric.value}`}
            >
              <AquaCard
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
                </div>
              </AquaCard>
            </Link>
          )
        })}
      </section>

      <div className="aqua-dashboard-workspace">
        <AquaDataPanel
          title="تركيز اليوم"
          meta={
            <AquaBadge
              variant={focusTasks.length > 0 ? "warning" : "success"}
              size="sm"
            >
              {focusTasks.length > 0
                ? `${focusTasks.length} ظاهرة`
                : "لا مهام عاجلة"}
            </AquaBadge>
          }
        >
          {focusTasks.length === 0 ? (
            <p className="aqua-dashboard-quiet-state">لا توجد مهام عاجلة.</p>
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
            <p className="aqua-dashboard-quiet-state">لا توجد إجراءات معلقة.</p>
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
                    </div>

                    <AquaLinkButton
                      href={item.href}
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ArrowLeft />}
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
        title="آخر النشاطات"
        actions={
          canViewCompanyActivity ? (
            <AquaLinkButton
              href="/dashboard/activity"
              variant="ghost"
              size="sm"
            >
              السجل
            </AquaLinkButton>
          ) : null
        }
      >
        {recentActivities.length === 0 ? (
          <p className="aqua-dashboard-quiet-state">لا يوجد نشاط مسجل.</p>
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
