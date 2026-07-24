import Link from "next/link"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import { requireAuth } from "@/lib/auth"
import { classifyMyDayDueDate, type MyDayBucket } from "@/lib/project-execution"
import { prisma } from "@/lib/prisma"

const bucketLabels: Record<MyDayBucket, string> = {
  OVERDUE: "متأخرة",
  TODAY: "اليوم",
  UPCOMING: "الأيام السبعة القادمة",
  LATER: "لاحقًا",
  NO_DUE_DATE: "دون موعد",
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

function formatDate(value: Date | null, timezone: string) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
    blocked: items.filter((item) => item.status === "BLOCKED" || item.blockers.length > 0)
      .length,
  }

  return (
    <div className="d-flex flex-column gap-4">
      <AquaPageHeader
        badge="MY DAY"
        title="يومي"
        description="المهام المسندة إليك مرتبة حسب الاستحقاق، مع إظهار العوائق والتقدم والمشروع المرتبط."
      />

      <section className="row g-3">
        {[
          ["متأخرة", summary.overdue, "text-bg-danger"],
          ["اليوم", summary.today, "text-bg-warning"],
          ["قادمة", summary.upcoming, "text-bg-info"],
          ["متعطلة", summary.blocked, "text-bg-danger"],
        ].map(([label, value, badgeClass]) => (
          <div className="col-6 col-xl-3" key={String(label)}>
            <div className="aqua-card p-4 h-100">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="small aqua-muted">{label}</div>
                  <div className="fs-2 fw-black mt-2" dir="ltr">{value}</div>
                </div>
                <span className={`badge ${badgeClass}`}>LIVE</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {items.length === 0 ? (
        <section className="aqua-card p-5 text-center">
          <h2 className="h5 fw-black">لا توجد مهام نشطة مسندة إليك</h2>
          <p className="aqua-muted mb-0">ستظهر المهام هنا عند إسنادك كمسؤول أو مشارك.</p>
        </section>
      ) : (
        bucketOrder.map((bucket) => {
          const bucketTasks = items.filter((item) => item.bucket === bucket)
          if (bucketTasks.length === 0) return null

          return (
            <section className="aqua-card p-4" key={bucket}>
              <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                <h2 className="h5 fw-black mb-0">{bucketLabels[bucket]}</h2>
                <span className="badge text-bg-info">{bucketTasks.length}</span>
              </div>

              <div className="row g-3">
                {bucketTasks.map((task) => (
                  <div className="col-xl-6" key={task.id}>
                    <article className="aqua-card-soft p-3 h-100">
                      <div className="d-flex justify-content-between gap-3 mb-3">
                        <div>
                          <h3 className="h6 fw-black mb-1">{task.title}</h3>
                          <div className="small aqua-muted">
                            {task.project?.name ?? "مهمة داخلية"}
                            {task.phase ? ` · ${task.phase.name}` : ""}
                          </div>
                        </div>
                        <span className={`badge ${task.blockers.length > 0 ? "text-bg-danger" : "text-bg-secondary"}`}>
                          {task.blockers.length > 0 ? `${task.blockers.length} عائق` : priorityLabel(task.priority)}
                        </span>
                      </div>

                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <span className="aqua-badge">{taskStatusLabel(task.status)}</span>
                        <span className="aqua-badge" dir="ltr">{formatDate(task.dueDate, timezone)}</span>
                      </div>

                      <div className="progress mb-3" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div className="progress-bar" style={{ width: `${task.progress}%` }}>
                          {task.progress}%
                        </div>
                      </div>

                      {task.blockers.length > 0 ? (
                        <div className="small text-danger mb-3">
                          {task.blockers.map((blocker) => blocker.title).join("، ")}
                        </div>
                      ) : null}

                      {task.project ? (
                        <Link href={`/dashboard/projects/${task.project.id}`} className="btn btn-sm aqua-btn-ghost">
                          فتح تنفيذ المشروع
                        </Link>
                      ) : (
                        <Link href="/dashboard/tasks" className="btn btn-sm aqua-btn-ghost">
                          فتح المهام
                        </Link>
                      )}
                    </article>
                  </div>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
