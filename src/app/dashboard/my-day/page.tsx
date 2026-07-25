import {
  AlertTriangle,
  ArrowUpLeft,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  ListTodo,
  ShieldAlert,
  Sparkles,
  TimerReset,
  type LucideIcon,
} from "lucide-react"

import {
  AquaAlert,
  AquaBadge,
  AquaCard,
  AquaDataPanel,
  AquaEmptyState,
  AquaLinkButton,
} from "@/components/aqua"
import type { AquaBadgeVariant } from "@/design-system"
import { requireAuth } from "@/lib/auth"
import { classifyMyDayDueDate, type MyDayBucket } from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"

type BucketConfig = {
  label: string
  eyebrow: string
  description: string
  variant: AquaBadgeVariant
  icon: LucideIcon
}

type SummaryMetric = {
  label: string
  value: number
  hint: string
  tone: "danger" | "warning" | "aqua" | "blue"
  icon: LucideIcon
}

const bucketConfig: Record<MyDayBucket, BucketConfig> = {
  OVERDUE: {
    label: "متأخرة",
    eyebrow: "Overdue",
    description: "ابدأ بهذه المهام أو حدّث موعدها ومسؤوليتها.",
    variant: "danger",
    icon: AlertTriangle,
  },
  TODAY: {
    label: "مستحقة اليوم",
    eyebrow: "Today",
    description: "الالتزامات التي يجب إغلاقها أو تحريكها اليوم.",
    variant: "warning",
    icon: CalendarClock,
  },
  UPCOMING: {
    label: "الأيام السبعة القادمة",
    eyebrow: "Upcoming",
    description: "حضّر الخطوة التالية قبل أن تتحول إلى عمل عاجل.",
    variant: "aqua",
    icon: CalendarDays,
  },
  NO_DUE_DATE: {
    label: "دون موعد",
    eyebrow: "Unscheduled",
    description: "مهام نشطة تحتاج موعدًا واضحًا أو قرارًا بإبقائها مرنة.",
    variant: "muted",
    icon: CircleDashed,
  },
  LATER: {
    label: "لاحقًا",
    eyebrow: "Later",
    description: "عمل مخطط خارج نافذة الأيام السبعة القادمة.",
    variant: "blue",
    icon: TimerReset,
  },
}

const bucketOrder: MyDayBucket[] = [
  "OVERDUE",
  "TODAY",
  "UPCOMING",
  "NO_DUE_DATE",
  "LATER",
]

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

function priorityLabel(priority: string) {
  return (
    {
      LOW: "منخفضة",
      MEDIUM: "متوسطة",
      HIGH: "عالية",
      URGENT: "عاجلة",
    }[priority] ?? priority
  )
}

function priorityVariant(priority: string): AquaBadgeVariant {
  return (
    {
      LOW: "muted",
      MEDIUM: "blue",
      HIGH: "warning",
      URGENT: "danger",
    }[priority] as AquaBadgeVariant | undefined
  ) ?? "muted"
}

function formatDueDate(value: Date | null, timezone: string) {
  if (!value) return "دون موعد"

  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value)
}

function formatOperationalDay(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value)
}

export default async function MyDayPage() {
  const user = await requireAuth()
  const now = new Date()
  const timezone = user.company.timezone || "Asia/Amman"

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      status: {
        notIn: ["DONE", "CANCELLED", "ARCHIVED"],
      },
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
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      phase: {
        select: {
          id: true,
          name: true,
        },
      },
      blockers: {
        where: {
          status: "OPEN",
        },
        select: {
          id: true,
          title: true,
          severity: true,
        },
      },
    },
  })

  const items = tasks.map((task) => ({
    ...task,
    bucket: classifyMyDayDueDate(task.dueDate, now, timezone),
  }))

  const summary = {
    overdue: items.filter((item) => item.bucket === "OVERDUE").length,
    today: items.filter((item) => item.bucket === "TODAY").length,
    upcoming: items.filter((item) => item.bucket === "UPCOMING").length,
    noDueDate: items.filter((item) => item.bucket === "NO_DUE_DATE").length,
    blocked: items.filter(
      (item) => item.status === "BLOCKED" || item.blockers.length > 0
    ).length,
  }

  const metrics: SummaryMetric[] = [
    {
      label: "متأخرة",
      value: summary.overdue,
      hint: summary.overdue > 0 ? "تحتاج قرارًا اليوم" : "لا توجد مهام متأخرة",
      tone: "danger",
      icon: AlertTriangle,
    },
    {
      label: "مستحقة اليوم",
      value: summary.today,
      hint: summary.today > 0 ? "ضمن تركيز اليوم" : "اليوم خالٍ من الاستحقاقات",
      tone: "warning",
      icon: CalendarClock,
    },
    {
      label: "قادمة",
      value: summary.upcoming,
      hint: "خلال الأيام السبعة القادمة",
      tone: "aqua",
      icon: CalendarDays,
    },
    {
      label: "متعطلة",
      value: summary.blocked,
      hint: summary.blocked > 0 ? "تحتاج إزالة عائق" : "لا توجد عوائق مفتوحة",
      tone: "blue",
      icon: Ban,
    },
  ]

  const attentionCount = items.filter(
    (item) =>
      item.bucket === "OVERDUE" ||
      item.status === "BLOCKED" ||
      item.blockers.length > 0
  ).length

  const operationalState: {
    label: string
    variant: AquaBadgeVariant
  } =
    items.length === 0
      ? { label: "لا توجد مهام نشطة", variant: "muted" }
      : attentionCount > 0
        ? { label: `${attentionCount} بحاجة للمراجعة`, variant: "warning" }
        : { label: "اليوم تحت السيطرة", variant: "success" }

  return (
    <div className="aqua-my-day">
      <AquaCard variant="surface" padding="md" glow className="aqua-my-day-hero">
        <div className="aqua-my-day-hero__copy">
          <div className="aqua-my-day-hero__meta-line">
            <span className="aqua-my-day-hero__eyebrow">يوم العمل</span>
            <AquaBadge variant={operationalState.variant} dot>
              {operationalState.label}
            </AquaBadge>
          </div>

          <h1>أولويات اليوم</h1>
          <p>ابدأ بالمتأخر والعوائق، ثم انتقل إلى استحقاقات اليوم.</p>

          <div className="aqua-my-day-hero__actions">
            <AquaLinkButton
              href="/dashboard/tasks"
              variant="primary"
              size="sm"
              trailingIcon={<ArrowUpLeft />}
            >
              كل المهام
            </AquaLinkButton>
            <AquaLinkButton
              href="/dashboard/time"
              variant="secondary"
              size="sm"
              leadingIcon={<Clock3 />}
            >
              الوقت والطاقة
            </AquaLinkButton>
          </div>
        </div>

        <div className="aqua-my-day-hero__context">
          <div className="aqua-my-day-hero__context-heading">
            <span className="aqua-my-day-hero__context-icon" aria-hidden="true">
              <Sparkles />
            </span>
            <div>
              <span>يوم التشغيل</span>
              <strong>{formatOperationalDay(now, timezone)}</strong>
            </div>
          </div>

          <dl>
            <div>
              <dt>نشطة</dt>
              <dd>{items.length}</dd>
            </div>
            <div>
              <dt>دون موعد</dt>
              <dd>{summary.noDueDate}</dd>
            </div>
            <div>
              <dt>المنطقة الزمنية</dt>
              <dd dir="ltr">{timezone}</dd>
            </div>
          </dl>
        </div>
      </AquaCard>

      <section className="aqua-my-day-metrics" aria-label="ملخص يوم العمل">
        {metrics.map((metric) => {
          const MetricIcon = metric.icon

          return (
            <AquaCard
              key={metric.label}
              variant="soft"
              padding="sm"
              className="aqua-my-day-metric"
              data-tone={metric.tone}
            >
              <span className="aqua-my-day-metric__icon" aria-hidden="true">
                <MetricIcon />
              </span>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </div>
            </AquaCard>
          )
        })}
      </section>

      {attentionCount > 0 ? (
        <AquaAlert
          variant={summary.overdue > 0 ? "warning" : "info"}
          title={
            summary.blocked > 0
              ? "ابدأ بإزالة ما يعيق التنفيذ"
              : "راجع المهام المتأخرة قبل إضافة عمل جديد"
          }
          icon={<ShieldAlert />}
          className="aqua-my-day-attention"
        >
          لديك {summary.overdue} مهام متأخرة و{summary.blocked} مهام متعطلة. راجع
          السبب والموعد والمسؤولية قبل إضافة عمل جديد إلى اليوم.
        </AquaAlert>
      ) : null}

      <div className="aqua-my-day-workspace">
        <main className="aqua-my-day-buckets">
          {items.length === 0 ? (
            <AquaEmptyState
              compact
              className="aqua-my-day-empty"
              icon={<CheckCircle2 />}
              title="لا توجد مهام مسندة إليك"
              description="ستظهر هنا فور إسنادك كمسؤول أو مشارك."
              action={
                <AquaLinkButton
                  href="/dashboard/tasks"
                  variant="secondary"
                  size="sm"
                  trailingIcon={<ArrowUpLeft />}
                >
                  فتح سجل المهام
                </AquaLinkButton>
              }
            />
          ) : (
            bucketOrder.map((bucket) => {
              const bucketTasks = items.filter((item) => item.bucket === bucket)
              if (bucketTasks.length === 0) return null

              const config = bucketConfig[bucket]
              const BucketIcon = config.icon

              return (
                <AquaDataPanel
                  key={bucket}
                  eyebrow={config.eyebrow}
                  title={config.label}
                  description={config.description}
                  meta={
                    <span className="aqua-my-day-bucket__meta">
                      <BucketIcon aria-hidden="true" />
                      <AquaBadge variant={config.variant} size="sm" dot>
                        {bucketTasks.length} مهام
                      </AquaBadge>
                    </span>
                  }
                  className="aqua-my-day-bucket"
                >
                  <div className="aqua-my-day-task-grid">
                    {bucketTasks.map((task) => {
                      const isBlocked =
                        task.status === "BLOCKED" || task.blockers.length > 0

                      return (
                        <AquaCard
                          key={task.id}
                          variant="outlined"
                          padding="md"
                          className="aqua-my-day-task"
                          data-blocked={isBlocked ? "true" : "false"}
                        >
                          <div className="aqua-my-day-task__heading">
                            <div>
                              <h3>{task.title}</h3>
                              <p>
                                {task.project?.name ?? "مهمة داخلية"}
                                {task.phase ? ` · ${task.phase.name}` : ""}
                              </p>
                            </div>

                            <div className="aqua-my-day-task__badges">
                              <AquaBadge
                                variant={taskStatusVariant(task.status)}
                                size="sm"
                              >
                                {taskStatusLabel(task.status)}
                              </AquaBadge>
                              <AquaBadge
                                variant={priorityVariant(task.priority)}
                                size="sm"
                              >
                                {priorityLabel(task.priority)}
                              </AquaBadge>
                            </div>
                          </div>

                          <div className="aqua-my-day-task__meta">
                            <span>
                              <CalendarDays aria-hidden="true" />
                              {formatDueDate(task.dueDate, timezone)}
                            </span>
                            <span dir="ltr">{task.progress}%</span>
                          </div>

                          <div
                            className="aqua-my-day-progress"
                            role="progressbar"
                            aria-label={`تقدم مهمة ${task.title}`}
                            aria-valuenow={task.progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span style={{ inlineSize: `${task.progress}%` }} />
                          </div>

                          {task.blockers.length > 0 ? (
                            <div className="aqua-my-day-task__blockers">
                              <ShieldAlert aria-hidden="true" />
                              <div>
                                <strong>
                                  {task.blockers.length === 1
                                    ? "عائق مفتوح"
                                    : `${task.blockers.length} عوائق مفتوحة`}
                                </strong>
                                <span>
                                  {task.blockers
                                    .map((blocker) => blocker.title)
                                    .join("، ")}
                                </span>
                              </div>
                            </div>
                          ) : null}

                          <div className="aqua-my-day-task__footer">
                            <span>
                              {task.project ? "تنفيذ مشروع" : "مسار مهام داخلي"}
                            </span>
                            <AquaLinkButton
                              href={
                                task.project
                                  ? `/dashboard/projects/${task.project.id}`
                                  : "/dashboard/tasks"
                              }
                              variant="ghost"
                              size="sm"
                              trailingIcon={<ArrowUpLeft />}
                              aria-label={`فتح ${task.title}`}
                            >
                              فتح
                            </AquaLinkButton>
                          </div>
                        </AquaCard>
                      )
                    })}
                  </div>
                </AquaDataPanel>
              )
            })
          )}
        </main>

        <aside className="aqua-my-day-rail" aria-label="سياق يوم العمل">
          <AquaDataPanel
            title="خطة التركيز"
            className="aqua-my-day-focus-panel"
          >
            <ol className="aqua-my-day-focus-steps">
              <li>
                <span>1</span>
                <strong>ابدأ بالمتأخر</strong>
              </li>
              <li>
                <span>2</span>
                <strong>عالج العوائق</strong>
              </li>
              <li>
                <span>3</span>
                <strong>نفّذ مهام اليوم</strong>
              </li>
            </ol>
          </AquaDataPanel>

          <AquaDataPanel
            title="مسارات مرتبطة"
            className="aqua-my-day-links-panel"
          >
            <div className="aqua-my-day-links">
              <AquaLinkButton
                href="/dashboard/tasks"
                variant="ghost"
                fullWidth
                leadingIcon={<ListTodo />}
                trailingIcon={<ArrowUpLeft />}
              >
                إدارة المهام
              </AquaLinkButton>
              <AquaLinkButton
                href="/dashboard/projects"
                variant="ghost"
                fullWidth
                leadingIcon={<FolderKanban />}
                trailingIcon={<ArrowUpLeft />}
              >
                تنفيذ المشاريع
              </AquaLinkButton>
              <AquaLinkButton
                href="/dashboard/time"
                variant="ghost"
                fullWidth
                leadingIcon={<Clock3 />}
                trailingIcon={<ArrowUpLeft />}
              >
                الوقت والطاقة
              </AquaLinkButton>
            </div>
          </AquaDataPanel>
        </aside>
      </div>
    </div>
  )
}
