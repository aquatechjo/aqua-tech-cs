"use client"

import { Building2, Search, UserRoundPlus, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaFilterBar,
  AquaFormSection,
  AquaInput,
  AquaLinkButton,
  AquaSelect,
  AquaTable,
  AquaTableStateRow,
  AquaTextarea,
} from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type { AquaBadgeVariant } from "@/design-system"
import { ClientStatus, ClientType, LeadSource } from "@/generated/prisma/enums"

type ClientItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  type: ClientType
  status: ClientStatus
  source: LeadSource
  industry: string | null
  country: string | null
  city: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

type Stats = {
  totalClients: number
  activeClients: number
  leadsCount: number
  archivedCount: number
  from: number
  to: number
  currentPage: number
  totalPages: number
}

type Filters = {
  q: string
  status: string
  type: string
  source: string
}

const PAGE_SIZE = 20

const clientTypes: ClientType[] = ["COMPANY", "INDIVIDUAL"]
const clientStatuses: ClientStatus[] = [
  "LEAD",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
]
const leadSources: LeadSource[] = [
  "WEBSITE",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "REFERRAL",
  "DIRECT",
  "OTHER",
]

function statusBadgeVariant(status: ClientStatus): AquaBadgeVariant {
  if (status === "ACTIVE") return "success"
  if (status === "LEAD") return "blue"
  if (status === "INACTIVE") return "muted"
  return "danger"
}

function clientTypeLabel(type: ClientType) {
  const labels: Record<ClientType, string> = {
    COMPANY: "شركة",
    INDIVIDUAL: "فرد",
  }

  return labels[type]
}

function clientStatusLabel(status: ClientStatus) {
  const labels: Record<ClientStatus, string> = {
    LEAD: "فرصة",
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    ARCHIVED: "مؤرشف",
  }

  return labels[status]
}

function leadSourceLabel(source: LeadSource) {
  const labels: Record<LeadSource, string> = {
    WEBSITE: "الموقع",
    FACEBOOK: "فيسبوك",
    INSTAGRAM: "إنستغرام",
    WHATSAPP: "واتساب",
    REFERRAL: "ترشيح",
    DIRECT: "مباشر",
    OTHER: "أخرى",
  }

  return labels[source]
}

export default function ClientsClient({
  clients,
  filters,
  stats,
  pagination,
}: {
  clients: ClientItem[]
  filters: Filters
  stats: Stats
  pagination: React.ReactNode
}) {
  const router = useRouter()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingArchive, setPendingArchive] = useState<ClientItem | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [type, setType] = useState<ClientType>("COMPANY")
  const [status, setStatus] = useState<ClientStatus>("LEAD")
  const [source, setSource] = useState<LeadSource>("OTHER")
  const [industry, setIndustry] = useState("")
  const [country, setCountry] = useState("Jordan")
  const [city, setCity] = useState("")
  const [notes, setNotes] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)

  const isEditing = Boolean(editingId)
  const activeFilterCount = [
    filters.q,
    filters.status,
    filters.type,
    filters.source,
  ].filter(Boolean).length

  function resetForm() {
    setEditingId(null)
    setName("")
    setEmail("")
    setPhone("")
    setWebsite("")
    setType("COMPANY")
    setStatus("LEAD")
    setSource("OTHER")
    setIndustry("")
    setCountry("Jordan")
    setCity("")
    setNotes("")
    setError("")
  }

  function startEdit(client: ClientItem) {
    setEditingId(client.id)
    setName(client.name)
    setEmail(client.email ?? "")
    setPhone(client.phone ?? "")
    setWebsite(client.website ?? "")
    setType(client.type)
    setStatus(client.status)
    setSource(client.source)
    setIndustry(client.industry ?? "")
    setCountry(client.country ?? "")
    setCity(client.city ?? "")
    setNotes(client.notes ?? "")
    setError("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function submitClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isEditing ? `/api/clients/${editingId}` : "/api/clients"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          website,
          type,
          status,
          source,
          industry,
          country,
          city,
          notes,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات العميل")
        return
      }

      resetForm()
      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  async function archiveClient(client: ClientItem) {
    const nextStatus = client.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED"
    setArchiveLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل تعديل حالة العميل")
        return
      }

      setPendingArchive(null)
      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setArchiveLoading(false)
    }
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Clients CRM"
        title="إدارة العملاء"
        description="قاعدة العملاء الداخلية لشركة Aqua.Tech، مع بيانات التواصل، الحالة، المصدر، والمتابعة."
        brandValue="CRM"
      />

      {error ? (
        <AquaAlert variant="danger" title="تعذر إكمال العملية" className="mb-3">
          {error}
        </AquaAlert>
      ) : null}

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <AquaFormSection
            eyebrow={isEditing ? "Edit client" : "New client"}
            title={isEditing ? "تعديل عميل" : "إضافة عميل"}
            description={
              isEditing
                ? "عدّل بيانات العميل الحالية ثم احفظ التغييرات."
                : "أضف عميلًا أو فرصة جديدة إلى قاعدة العملاء."
            }
            className="aqua-workflow-form-sticky"
            actions={
              isEditing ? (
                <AquaButton variant="ghost" size="sm" onClick={resetForm}>
                  إلغاء التعديل
                </AquaButton>
              ) : null
            }
          >
            <form onSubmit={submitClient}>
              <div className="aqua-form-grid">
                <AquaInput
                  required
                  minLength={2}
                  label="اسم العميل"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="مثال: شركة المثال"
                />

                <AquaInput
                  span={6}
                  dir="ltr"
                  type="email"
                  label="البريد الإلكتروني"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="text-start"
                  placeholder="client@email.com"
                />

                <AquaInput
                  span={6}
                  dir="ltr"
                  label="الهاتف"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="text-start"
                  placeholder="+962..."
                />

                <AquaInput
                  dir="ltr"
                  label="الموقع الإلكتروني"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="text-start"
                  placeholder="https://example.com"
                />

                <AquaSelect
                  span={6}
                  label="النوع"
                  value={type}
                  onChange={(event) => setType(event.target.value as ClientType)}
                >
                  {clientTypes.map((item) => (
                    <option key={item} value={item}>
                      {clientTypeLabel(item)}
                    </option>
                  ))}
                </AquaSelect>

                <AquaSelect
                  span={6}
                  label="الحالة"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ClientStatus)
                  }
                >
                  {clientStatuses.map((item) => (
                    <option key={item} value={item}>
                      {clientStatusLabel(item)}
                    </option>
                  ))}
                </AquaSelect>

                <AquaSelect
                  span={6}
                  label="المصدر"
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as LeadSource)
                  }
                >
                  {leadSources.map((item) => (
                    <option key={item} value={item}>
                      {leadSourceLabel(item)}
                    </option>
                  ))}
                </AquaSelect>

                <AquaInput
                  span={6}
                  label="المجال"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="مثال: برمجيات"
                />

                <AquaInput
                  span={6}
                  label="الدولة"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />

                <AquaInput
                  span={6}
                  label="المدينة"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />

                <AquaTextarea
                  label="ملاحظات"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </div>

              <div className="aqua-form-actions">
                <AquaButton
                  type="submit"
                  fullWidth
                  loading={loading}
                  loadingLabel="جارٍ الحفظ"
                  leadingIcon={isEditing ? <Building2 /> : <UserRoundPlus />}
                >
                  {isEditing ? "حفظ التعديلات" : "إضافة العميل"}
                </AquaButton>
              </div>
            </form>
          </AquaFormSection>
        </div>

        <div className="col-12 col-xl-8">
          <AquaDataPanel
            title="قائمة العملاء"
            description={`عرض ${stats.from}–${stats.to} من أصل ${stats.totalClients} عميل`}
            meta={
              <span dir="ltr">
                Page {stats.currentPage} / {stats.totalPages}
              </span>
            }
            actions={
              <>
                <AquaBadge>الكل {stats.totalClients}</AquaBadge>
                <AquaBadge variant="success">
                  النشط {stats.activeClients}
                </AquaBadge>
                <AquaBadge variant="blue">الفرص {stats.leadsCount}</AquaBadge>
                <AquaBadge variant="danger">
                  المؤرشف {stats.archivedCount}
                </AquaBadge>
              </>
            }
            footer={pagination}
          >
            <AquaFilterBar
              action="/dashboard/clients"
              method="get"
              activeCount={activeFilterCount}
              description="استخدم الحقول التالية لتضييق النتائج مع الحفاظ على رابط قابل للمشاركة."
              className="mb-3"
            >
              <AquaInput
                span={4}
                name="q"
                defaultValue={filters.q}
                label="بحث"
                placeholder="الاسم، البريد، الهاتف، المجال..."
              />

              <AquaSelect
                span={2}
                name="status"
                defaultValue={filters.status}
                label="الحالة"
              >
                <option value="">الكل</option>
                {clientStatuses.map((item) => (
                  <option key={item} value={item}>
                    {clientStatusLabel(item)}
                  </option>
                ))}
              </AquaSelect>

              <AquaSelect
                span={2}
                name="type"
                defaultValue={filters.type}
                label="النوع"
              >
                <option value="">الكل</option>
                {clientTypes.map((item) => (
                  <option key={item} value={item}>
                    {clientTypeLabel(item)}
                  </option>
                ))}
              </AquaSelect>

              <AquaSelect
                span={2}
                name="source"
                defaultValue={filters.source}
                label="المصدر"
              >
                <option value="">الكل</option>
                {leadSources.map((item) => (
                  <option key={item} value={item}>
                    {leadSourceLabel(item)}
                  </option>
                ))}
              </AquaSelect>

              <div className="aqua-filter-bar__actions" data-aqua-span="2">
                <AquaButton
                  type="submit"
                  size="sm"
                  fullWidth
                  leadingIcon={<Search />}
                >
                  تطبيق
                </AquaButton>
                <AquaLinkButton
                  href="/dashboard/clients"
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
              minWidth="880px"
              caption="قائمة عملاء Aqua.Tech"
            >
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">العميل</th>
                  <th scope="col">التواصل</th>
                  <th scope="col">النوع</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">المصدر</th>
                  <th scope="col">الموقع</th>
                  <th scope="col">إجراء</th>
                </tr>
              </thead>

              <tbody>
                {clients.length === 0 ? (
                  <AquaTableStateRow
                    colSpan={8}
                    variant="empty"
                    icon={<UsersRound />}
                    title="لا توجد نتائج"
                    description="أضف أول عميل أو غيّر معايير البحث والتصفية الحالية."
                  />
                ) : (
                  clients.map((client, index) => (
                    <tr key={client.id}>
                      <td data-label="#" className="aqua-table__secondary" dir="ltr">
                        {(stats.currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td data-label="العميل">
                        <div className="aqua-table__primary">{client.name}</div>
                        <div className="aqua-table__secondary">
                          {client.industry || "—"}
                        </div>
                      </td>

                      <td data-label="التواصل">
                        <div className="aqua-table__primary" dir="ltr">
                          {client.email || "لا يوجد بريد"}
                        </div>
                        <div className="aqua-table__secondary" dir="ltr">
                          {client.phone || "لا يوجد هاتف"}
                        </div>
                      </td>

                      <td data-label="النوع">
                        <AquaBadge size="sm">
                          {clientTypeLabel(client.type)}
                        </AquaBadge>
                      </td>

                      <td data-label="الحالة">
                        <AquaBadge
                          size="sm"
                          variant={statusBadgeVariant(client.status)}
                          dot
                        >
                          {clientStatusLabel(client.status)}
                        </AquaBadge>
                      </td>

                      <td data-label="المصدر">
                        <span className="aqua-table__secondary">
                          {leadSourceLabel(client.source)}
                        </span>
                      </td>

                      <td data-label="الموقع" dir="ltr">
                        <span className="aqua-table__secondary">
                          {client.website || "—"}
                        </span>
                      </td>

                      <td data-label="إجراء">
                        <div className="aqua-table__actions">
                          <AquaButton
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(client)}
                          >
                            تعديل
                          </AquaButton>

                          <AquaButton
                            variant={
                              client.status === "ARCHIVED" ? "secondary" : "ghost"
                            }
                            size="sm"
                            onClick={() => setPendingArchive(client)}
                          >
                            {client.status === "ARCHIVED" ? "استرجاع" : "أرشفة"}
                          </AquaButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AquaTable>
          </AquaDataPanel>
        </div>
      </div>

      <AquaConfirmDialog
        open={Boolean(pendingArchive)}
        onClose={() => {
          if (!archiveLoading) setPendingArchive(null)
        }}
        onConfirm={async () => {
          if (pendingArchive) await archiveClient(pendingArchive)
        }}
        title={
          pendingArchive?.status === "ARCHIVED"
            ? "استرجاع العميل"
            : "أرشفة العميل"
        }
        description={
          pendingArchive?.status === "ARCHIVED"
            ? `سيعود ${pendingArchive?.name ?? "العميل"} إلى قائمة العملاء النشطين.`
            : `سيتم نقل ${pendingArchive?.name ?? "العميل"} إلى الأرشيف مع الاحتفاظ ببياناته.`
        }
        confirmLabel={
          pendingArchive?.status === "ARCHIVED" ? "استرجاع" : "أرشفة"
        }
        confirmVariant={
          pendingArchive?.status === "ARCHIVED" ? "primary" : "danger"
        }
        tone={pendingArchive?.status === "ARCHIVED" ? "neutral" : "warning"}
        loading={archiveLoading}
      />
    </div>
  )
}
