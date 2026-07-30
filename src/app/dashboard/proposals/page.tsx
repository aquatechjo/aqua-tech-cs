import { FileText, Search } from "lucide-react"
import { redirect } from "next/navigation"

import {
  AquaBadge,
  AquaButton,
  AquaCard,
  AquaDataPanel,
  AquaFilterBar,
  AquaInput,
  AquaLinkButton,
  AquaPagination,
  AquaSelect,
  AquaTable,
  AquaTableStateRow,
} from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type { Prisma } from "@/generated/prisma/client"
import type { ProposalWorkspaceStatus } from "@/generated/prisma/enums"
import type { AquaBadgeVariant } from "@/design-system"
import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { proposalVersionContentSchema } from "@/lib/proposal"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 20
const workspaceStatuses: ProposalWorkspaceStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SENT",
  "CLIENT_CHANGES_REQUESTED",
  "ACCEPTED",
  "REJECTED",
]
type ProposalQueueStatus = ProposalWorkspaceStatus | "READY"

const statusDetails: Record<
  ProposalQueueStatus,
  { label: string; variant: AquaBadgeVariant }
> = {
  READY: { label: "جاهز للبناء", variant: "blue" },
  DRAFT: { label: "مسودة", variant: "muted" },
  IN_REVIEW: { label: "قيد المراجعة", variant: "warning" },
  CHANGES_REQUESTED: { label: "تحتاج تعديلًا", variant: "danger" },
  APPROVED: { label: "معتمدة", variant: "success" },
  SENT: { label: "مرسلة", variant: "blue" },
  CLIENT_CHANGES_REQUESTED: {
    label: "تعديل من العميل",
    variant: "warning",
  },
  ACCEPTED: { label: "مقبولة", variant: "success" },
  REJECTED: { label: "مرفوضة", variant: "danger" },
}

function parsePage(value?: string) {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function parseStatus(value?: string): ProposalQueueStatus | undefined {
  if (value === "READY") return value
  return workspaceStatuses.includes(value as ProposalWorkspaceStatus)
    ? (value as ProposalWorkspaceStatus)
    : undefined
}

function proposalStatusWhere(
  status?: ProposalQueueStatus,
): Prisma.IntakeSessionWhereInput {
  if (status === "READY") {
    return { proposalWorkspace: { is: null } }
  }
  if (status) {
    return { proposalWorkspace: { is: { status } } }
  }
  return {}
}

function formatDate(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value)
}

function formatMoney(value: string, currency: string) {
  return `${new Intl.NumberFormat("en-JO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))} ${currency}`
}

export default async function ProposalQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
  }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.proposalRead)) {
    redirect("/dashboard")
  }

  const resolvedSearchParams = await searchParams
  const requestedPage = parsePage(resolvedSearchParams.page)
  const q = resolvedSearchParams.q?.trim() ?? ""
  const status = parseStatus(resolvedSearchParams.status)
  const eligibleWhere: Prisma.IntakeSessionWhereInput = {
    companyId: user.companyId,
    pricingWorkspace: {
      is: {
        status: "APPROVED",
      },
    },
  }
  const where: Prisma.IntakeSessionWhereInput = {
    ...eligibleWhere,
    ...proposalStatusWhere(status),
    ...(q
      ? {
          OR: [
            {
              lead: {
                contactName: { contains: q, mode: "insensitive" },
              },
            },
            {
              lead: {
                companyName: { contains: q, mode: "insensitive" },
              },
            },
            {
              opportunity: {
                title: { contains: q, mode: "insensitive" },
              },
            },
            {
              proposalWorkspace: {
                proposalNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  }

  const [
    totalSessions,
    readyCount,
    draftCount,
    inReviewCount,
    changesRequestedCount,
    approvedCount,
    sentCount,
    clientChangesCount,
    acceptedCount,
    rejectedCount,
  ] = await Promise.all([
    prisma.intakeSession.count({ where }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: null },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "DRAFT" } },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "IN_REVIEW" } },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: {
          is: { status: "CHANGES_REQUESTED" },
        },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "APPROVED" } },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "SENT" } },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: {
          is: { status: "CLIENT_CHANGES_REQUESTED" },
        },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "ACCEPTED" } },
      },
    }),
    prisma.intakeSession.count({
      where: {
        ...eligibleWhere,
        proposalWorkspace: { is: { status: "REJECTED" } },
      },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const skip = (currentPage - 1) * PAGE_SIZE
  const sessions = await prisma.intakeSession.findMany({
    where,
    orderBy: [
      { proposalWorkspace: { updatedAt: "desc" } },
      { updatedAt: "desc" },
    ],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      updatedAt: true,
      lead: {
        select: {
          contactName: true,
          companyName: true,
          serviceType: true,
        },
      },
      opportunity: {
        select: {
          title: true,
        },
      },
      pricingWorkspace: {
        select: {
          approvedAt: true,
          currentVersion: true,
        },
      },
      proposalWorkspace: {
        select: {
          proposalNumber: true,
          status: true,
          currentVersion: true,
          updatedAt: true,
          createdBy: {
            select: {
              name: true,
            },
          },
          reviewedBy: {
            select: {
              name: true,
            },
          },
          versions: {
            orderBy: {
              version: "desc",
            },
            take: 1,
            select: {
              content: true,
            },
          },
        },
      },
    },
  })

  const from = totalSessions === 0 ? 0 : skip + 1
  const to = Math.min(skip + sessions.length, totalSessions)
  const activeFilterCount = Number(Boolean(q)) + Number(Boolean(status))
  const cards = [
    { label: "جاهزة للبناء", value: readyCount, variant: "blue" as const },
    { label: "مسودات", value: draftCount, variant: "muted" as const },
    {
      label: "قيد المراجعة",
      value: inReviewCount,
      variant: "warning" as const,
    },
    {
      label: "تحتاج تعديلًا",
      value: changesRequestedCount,
      variant: "danger" as const,
    },
    {
      label: "معتمدة",
      value: approvedCount,
      variant: "success" as const,
    },
    { label: "مرسلة", value: sentCount, variant: "blue" as const },
    {
      label: "تعديل من العميل",
      value: clientChangesCount,
      variant: "warning" as const,
    },
    {
      label: "مقبولة",
      value: acceptedCount,
      variant: "success" as const,
    },
    {
      label: "مرفوضة",
      value: rejectedCount,
      variant: "danger" as const,
    },
  ]

  return (
    <div className="d-flex flex-column gap-4">
      <AquaPageHeader
        badge="PROP-02"
        title="العروض المركزية"
        description="أنشئ العرض واعتمده، ثم أرسله كرابط آمن وتابع مشاهدة العميل وطلباته وقراره."
        brandValue="Proposals"
      />

      <div className="row g-3">
        {cards.map((card) => (
          <div className="col-12 col-sm-6 col-xl" key={card.label}>
            <AquaCard variant="soft" padding="sm" className="h-100">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div className="small aqua-muted">{card.label}</div>
                  <div className="h4 fw-black mb-0 mt-2" dir="ltr">
                    {card.value}
                  </div>
                </div>
                <AquaBadge variant={card.variant} size="sm">
                  {card.value}
                </AquaBadge>
              </div>
            </AquaCard>
          </div>
        ))}
      </div>

      <AquaDataPanel
        title="قائمة العروض"
        description={`عرض ${from}–${to} من أصل ${totalSessions} نتيجة`}
        meta={
          <span dir="ltr">
            Page {currentPage} / {totalPages}
          </span>
        }
        footer={
          <AquaPagination
            basePath="/dashboard/proposals"
            currentPage={currentPage}
            totalPages={totalPages}
            queryParams={{ q, status }}
            from={from}
            to={to}
            totalItems={totalSessions}
          />
        }
      >
        <AquaFilterBar
          action="/dashboard/proposals"
          method="get"
          activeCount={activeFilterCount}
          description="ابحث عن العميل أو رقم العرض، ثم صفِّ بحسب مرحلة المراجعة."
          className="mb-3"
        >
          <AquaInput
            span={6}
            name="q"
            defaultValue={q}
            label="بحث"
            placeholder="العميل، الفرصة، أو رقم العرض..."
          />
          <AquaSelect
            span={3}
            name="status"
            defaultValue={status ?? ""}
            label="الحالة"
          >
            <option value="">كل الحالات</option>
            {Object.entries(statusDetails).map(
              ([statusValue, details]) => (
                <option key={statusValue} value={statusValue}>
                  {details.label}
                </option>
              ),
            )}
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
              href="/dashboard/proposals"
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
          minWidth="1020px"
          caption="قائمة العروض المركزية"
        >
          <thead>
            <tr>
              <th scope="col">العميل والفرصة</th>
              <th scope="col">رقم العرض</th>
              <th scope="col">الحالة</th>
              <th scope="col">الإجمالي</th>
              <th scope="col">الإصدار والمسؤول</th>
              <th scope="col">آخر تحديث</th>
              <th scope="col">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <AquaTableStateRow
                colSpan={7}
                variant="empty"
                icon={<FileText />}
                title="لا توجد عروض مطابقة"
                description="اعتمد تسعيرًا أولًا، أو غيّر معايير البحث والتصفية."
              />
            ) : (
              sessions.map((session) => {
                const workspace = session.proposalWorkspace
                const queueStatus: ProposalQueueStatus =
                  workspace?.status ?? "READY"
                const parsedContent =
                  proposalVersionContentSchema.safeParse(
                    workspace?.versions[0]?.content,
                  )
                const displayName =
                  session.lead.companyName || session.lead.contactName
                const updatedAt =
                  workspace?.updatedAt ??
                  session.pricingWorkspace?.approvedAt ??
                  session.updatedAt
                const reviewer =
                  workspace?.reviewedBy?.name ??
                  workspace?.createdBy?.name ??
                  "غير محدد"

                return (
                  <tr key={session.id}>
                    <td data-label="العميل والفرصة">
                      <div className="fw-bold">{displayName}</div>
                      <div className="small aqua-muted">
                        {session.opportunity?.title ??
                          session.lead.serviceType}
                      </div>
                    </td>
                    <td data-label="رقم العرض" dir="ltr">
                      {workspace?.proposalNumber ?? "—"}
                    </td>
                    <td data-label="الحالة">
                      <AquaBadge
                        variant={statusDetails[queueStatus].variant}
                        size="sm"
                      >
                        {statusDetails[queueStatus].label}
                      </AquaBadge>
                    </td>
                    <td data-label="الإجمالي" dir="ltr">
                      {parsedContent.success
                        ? formatMoney(
                            parsedContent.data.commercial.totals
                              .grandTotal,
                            parsedContent.data.commercial.currency,
                          )
                        : "—"}
                    </td>
                    <td data-label="الإصدار والمسؤول">
                      <div className="fw-bold">
                        {workspace
                          ? `الإصدار ${workspace.currentVersion}`
                          : "لم يبدأ"}
                      </div>
                      <div className="small aqua-muted">{reviewer}</div>
                    </td>
                    <td data-label="آخر تحديث">
                      {formatDate(updatedAt, user.company.timezone)}
                    </td>
                    <td data-label="إجراء">
                      <AquaLinkButton
                        href={`/dashboard/discovery/${session.id}/proposal`}
                        size="sm"
                        variant={
                          queueStatus === "READY"
                            ? "primary"
                            : "secondary"
                        }
                      >
                        {queueStatus === "READY"
                          ? "بناء العرض"
                          : "فتح العرض"}
                      </AquaLinkButton>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>
    </div>
  )
}
