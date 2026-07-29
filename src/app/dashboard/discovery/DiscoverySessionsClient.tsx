"use client"

import {
  ArrowUpRight,
  ClipboardList,
  PlayCircle,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaDataPanel,
  AquaFilterBar,
  AquaInput,
  AquaLinkButton,
  AquaSelect,
  AquaTable,
  AquaTableStateRow,
} from "@/components/aqua"
import type { AquaBadgeProps } from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  DiscoveryServiceTrack,
  IntakeSessionStatus,
  LeadStatus,
  SalesOpportunityStage,
} from "@/generated/prisma/enums"
import {
  discoveryTrackLabel,
  type DiscoveryServiceTrackValue,
} from "@/lib/discovery-intake"

type SessionItem = {
  id: string
  serviceTrack: DiscoveryServiceTrack
  status: IntakeSessionStatus
  completionScore: number
  updatedAt: string
  readyForReviewAt: string | null
  lead: {
    id: string
    contactName: string
    companyName: string | null
    serviceType: string
    status: LeadStatus
  }
  opportunity: {
    id: string
    title: string
    stage: SalesOpportunityStage
  } | null
  owner: {
    id: string
    name: string
    email: string
  } | null
  _count: {
    answers: number
    gaps: number
  }
}

type EligibleLead = {
  id: string
  contactName: string
  companyName: string | null
  serviceType: string
  status: LeadStatus
  owner: {
    name: string
  } | null
}

const discoveryStatuses: IntakeSessionStatus[] = [
  "COLLECTING",
  "NEEDS_INFO",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "ARCHIVED",
]

function statusLabel(status: IntakeSessionStatus) {
  const labels: Record<IntakeSessionStatus, string> = {
    COLLECTING: "جمع المعلومات",
    NEEDS_INFO: "تحتاج معلومات",
    READY_FOR_REVIEW: "جاهزة للمراجعة",
    COMPLETED: "مكتملة",
    ARCHIVED: "مؤرشفة",
  }

  return labels[status]
}

function statusVariant(
  status: IntakeSessionStatus,
): AquaBadgeProps["variant"] {
  if (status === "READY_FOR_REVIEW" || status === "COMPLETED") {
    return "success"
  }
  if (status === "NEEDS_INFO") return "warning"
  if (status === "ARCHIVED") return "muted"
  return "aqua"
}

export default function DiscoverySessionsClient({
  sessions,
  eligibleLeads,
  canManage,
  timeZone,
  filters,
  stats,
  pagination,
}: {
  sessions: SessionItem[]
  eligibleLeads: EligibleLead[]
  canManage: boolean
  timeZone: string
  filters: {
    q: string
    status: string
  }
  stats: {
    totalSessions: number
    collectingSessions: number
    needsInfoSessions: number
    readySessions: number
    eligibleLeads: number
    from: number
    to: number
    currentPage: number
    totalPages: number
  }
  pagination: React.ReactNode
}) {
  const router = useRouter()
  const [selectedLeadId, setSelectedLeadId] = useState(
    eligibleLeads[0]?.id ?? "",
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  })
  const activeFilterCount =
    Number(Boolean(filters.q)) + Number(Boolean(filters.status))
  const summaryCards: {
    label: string
    value: number
    hint: string
    variant: AquaBadgeProps["variant"]
  }[] = [
    {
      label: "قيد الجمع",
      value: stats.collectingSessions,
      hint: "جلسات مفتوحة",
      variant: "aqua",
    },
    {
      label: "تحتاج معلومات",
      value: stats.needsInfoSessions,
      hint: "بها فجوات مفتوحة",
      variant: "warning",
    },
    {
      label: "جاهزة للمراجعة",
      value: stats.readySessions,
      hint: "اجتازت بوابة الاكتمال",
      variant: "success",
    },
    {
      label: "لم تبدأ",
      value: stats.eligibleLeads,
      hint: "Leads متاحة للاكتشاف",
      variant: "blue",
    },
  ]

  async function startSession() {
    if (!selectedLeadId) {
      setError("اختر عميلًا محتملًا لبدء الجلسة.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/discovery/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: selectedLeadId,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر بدء جلسة جمع المتطلبات")
        return
      }

      router.push(`/dashboard/discovery/${data.data.sessionId}`)
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Discovery Intake"
        title="جمع المتطلبات"
        description="جلسات منظمة تحول معلومات العميل إلى حقائق قابلة للمراجعة، مع قياس اكتمال وفجوات موثقة قبل التقرير الأولي."
        brandValue="Discovery"
      />

      <div className="d-flex flex-wrap gap-2 mb-3">
        <AquaLinkButton href="/dashboard/leads" variant="secondary">
          العملاء المحتملون
        </AquaLinkButton>
        <AquaLinkButton href="/dashboard/sales" variant="ghost">
          خط المبيعات
        </AquaLinkButton>
      </div>

      {error ? (
        <AquaAlert
          variant="danger"
          title="تعذر إكمال العملية"
          className="mb-3"
        >
          {error}
        </AquaAlert>
      ) : null}

      <div className="row g-3 mb-3">
        {summaryCards.map((card) => (
          <div className="col-12 col-sm-6 col-xl-3" key={card.label}>
            <AquaCard variant="soft" padding="sm" className="h-100">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div className="small aqua-muted">{card.label}</div>
                  <div className="h4 fw-black mb-1 mt-2" dir="ltr">
                    {card.value}
                  </div>
                  <div className="small aqua-soft">{card.hint}</div>
                </div>
                <AquaBadge variant={card.variant} size="sm">
                  {card.value}
                </AquaBadge>
              </div>
            </AquaCard>
          </div>
        ))}
      </div>

      {canManage ? (
        <AquaDataPanel
          eyebrow="جلسة جديدة"
          title="ابدأ من Lead قائم"
          description="يستنتج النظام مسار الأسئلة من نوع الخدمة ويملأ ما يمكن إثباته من طلب الموقع دون تحويل الملاحظات الداخلية إلى حقائق عميل."
          className="mb-3"
        >
          {eligibleLeads.length > 0 ? (
            <div className="aqua-form-grid">
              <AquaSelect
                span={6}
                label="العميل المحتمل"
                value={selectedLeadId}
                onChange={(event) => setSelectedLeadId(event.target.value)}
              >
                {eligibleLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.companyName || lead.contactName} — {lead.serviceType}
                  </option>
                ))}
              </AquaSelect>
              <div
                className="aqua-filter-bar__actions align-self-end"
                data-aqua-span="6"
              >
                <AquaButton
                  fullWidth
                  leadingIcon={<PlayCircle />}
                  loading={loading}
                  loadingLabel="جارٍ البدء"
                  onClick={startSession}
                >
                  بدء جلسة
                </AquaButton>
              </div>
            </div>
          ) : (
            <AquaAlert variant="neutral" title="لا توجد Leads متاحة">
              كل السجلات المؤهلة لديها جلسات بالفعل، أو أن حالتها مغلقة.
            </AquaAlert>
          )}
        </AquaDataPanel>
      ) : null}

      <AquaDataPanel
        title="جلسات جمع المتطلبات"
        description={`عرض ${stats.from}–${stats.to} من أصل ${stats.totalSessions} جلسة`}
        meta={
          <span dir="ltr">
            Page {stats.currentPage} / {stats.totalPages}
          </span>
        }
        footer={pagination}
      >
        <AquaFilterBar
          action="/dashboard/discovery"
          method="get"
          activeCount={activeFilterCount}
          description="ابحث باسم العميل أو الخدمة وصفِّ حسب حالة الاكتشاف."
          className="mb-3"
        >
          <AquaInput
            span={6}
            name="q"
            defaultValue={filters.q}
            label="بحث"
            placeholder="العميل، الشركة، الخدمة، المسؤول..."
          />
          <AquaSelect
            span={3}
            name="status"
            defaultValue={filters.status}
            label="الحالة"
          >
            <option value="">الكل</option>
            {discoveryStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </AquaSelect>
          <div className="aqua-filter-bar__actions" data-aqua-span="3">
            <AquaButton
              type="submit"
              size="sm"
              fullWidth
              leadingIcon={<Search />}
            >
              تطبيق
            </AquaButton>
            <AquaLinkButton
              href="/dashboard/discovery"
              variant="ghost"
              size="sm"
              fullWidth
            >
              مسح
            </AquaLinkButton>
          </div>
        </AquaFilterBar>

        <AquaTable
          mobileStrategy="stack"
          minWidth="980px"
          caption="جلسات جمع متطلبات العملاء"
        >
          <thead>
            <tr>
              <th scope="col">العميل</th>
              <th scope="col">المسار</th>
              <th scope="col">الحالة</th>
              <th scope="col">الاكتمال</th>
              <th scope="col">المسؤول</th>
              <th scope="col">آخر تحديث</th>
              <th scope="col">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <AquaTableStateRow
                colSpan={7}
                variant="empty"
                icon={<ClipboardList />}
                title="لا توجد جلسات مطابقة"
                description="ابدأ جلسة من Lead قائم أو غيّر معايير البحث."
              />
            ) : (
              sessions.map((session) => (
                <tr key={session.id}>
                  <td data-label="العميل">
                    <div className="aqua-table__primary">
                      {session.lead.companyName ||
                        session.lead.contactName}
                    </div>
                    <div className="aqua-table__secondary">
                      {session.lead.companyName
                        ? session.lead.contactName
                        : session.lead.serviceType}
                    </div>
                  </td>
                  <td data-label="المسار">
                    <div className="aqua-table__primary">
                      {discoveryTrackLabel(
                        session.serviceTrack as DiscoveryServiceTrackValue,
                      )}
                    </div>
                    <div className="aqua-table__secondary">
                      {session.lead.serviceType}
                    </div>
                  </td>
                  <td data-label="الحالة">
                    <AquaBadge
                      size="sm"
                      variant={statusVariant(session.status)}
                      dot
                    >
                      {statusLabel(session.status)}
                    </AquaBadge>
                    {session.opportunity ? (
                      <div className="aqua-table__secondary mt-2">
                        فرصة: {session.opportunity.stage}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="الاكتمال">
                    <div className="aqua-table__primary" dir="ltr">
                      {session.completionScore}%
                    </div>
                    <div className="aqua-table__secondary">
                      {session._count.answers} إجابة ·{" "}
                      {session._count.gaps} فجوة مفتوحة
                    </div>
                  </td>
                  <td data-label="المسؤول">
                    <div className="aqua-table__primary">
                      {session.owner?.name || "غير معيّن"}
                    </div>
                    <div className="aqua-table__secondary" dir="ltr">
                      {session.owner?.email || "—"}
                    </div>
                  </td>
                  <td data-label="آخر تحديث">
                    <span className="aqua-table__secondary">
                      {formatDate.format(new Date(session.updatedAt))}
                    </span>
                  </td>
                  <td data-label="إجراء">
                    <AquaLinkButton
                      href={`/dashboard/discovery/${session.id}`}
                      size="sm"
                      variant={
                        session.status === "READY_FOR_REVIEW"
                          ? "secondary"
                          : "primary"
                      }
                      trailingIcon={<ArrowUpRight />}
                    >
                      {canManage ? "متابعة" : "عرض"}
                    </AquaLinkButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>
    </div>
  )
}
