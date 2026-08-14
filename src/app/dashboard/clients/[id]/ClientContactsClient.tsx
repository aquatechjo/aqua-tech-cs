"use client"

import {
  Archive,
  Pencil,
  Plus,
  RotateCcw,
  Star,
  UserRound,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  AquaAlert,
  AquaBadge,
  AquaButton,
  AquaConfirmDialog,
  AquaDataPanel,
  AquaDetailList,
  AquaInput,
  AquaLinkButton,
  AquaModal,
  AquaTable,
  AquaTableStateRow,
  AquaTextarea,
} from "@/components/aqua"
import AquaPageHeader from "@/components/layout/AquaPageHeader"
import type {
  ClientStatus,
  ClientType,
  LeadSource,
} from "@/generated/prisma/enums"

type ContactItem = {
  id: string
  name: string
  jobTitle: string | null
  department: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  isPrimary: boolean
  isDecisionMaker: boolean
  notes: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

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
  createdAt: string
  updatedAt: string
  contacts: ContactItem[]
  _count: {
    projects: number
    invoices: number
    salesOpportunities: number
    leads: number
    serviceRequests: number
  }
}

type PendingAction =
  | {
      type: "archive" | "primary"
      contact: ContactItem
    }
  | null

function clientTypeLabel(type: ClientType) {
  return type === "COMPANY" ? "شركة" : "فرد"
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

function sourceLabel(source: LeadSource) {
  const labels: Record<LeadSource, string> = {
    WEBSITE: "الموقع",
    CHATBOT: "الشات بوت",
    FACEBOOK: "فيسبوك",
    INSTAGRAM: "إنستغرام",
    WHATSAPP: "واتساب",
    EMAIL: "البريد الإلكتروني",
    CALL: "اتصال",
    MEETING: "اجتماع",
    REFERRAL: "ترشيح",
    CAMPAIGN: "حملة",
    MANUAL: "إدخال يدوي",
    DIRECT: "مباشر",
    OTHER: "أخرى",
  }

  return labels[source]
}

export default function ClientContactsClient({
  client,
  canManage,
  timeZone,
}: {
  client: ClientItem
  canManage: boolean
  timeZone: string
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [name, setName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [department, setDepartment] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [isDecisionMaker, setIsDecisionMaker] = useState(false)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const activeContacts = client.contacts.filter(
    (contact) => !contact.archivedAt,
  )
  const archivedContacts = client.contacts.length - activeContacts.length

  function resetForm() {
    setEditingContact(null)
    setName("")
    setJobTitle("")
    setDepartment("")
    setEmail("")
    setPhone("")
    setWhatsapp("")
    setIsPrimary(false)
    setIsDecisionMaker(false)
    setNotes("")
    setError("")
  }

  function openCreate() {
    resetForm()
    setIsPrimary(activeContacts.length === 0)
    setModalOpen(true)
  }

  function openEdit(contact: ContactItem) {
    setEditingContact(contact)
    setName(contact.name)
    setJobTitle(contact.jobTitle ?? "")
    setDepartment(contact.department ?? "")
    setEmail(contact.email ?? "")
    setPhone(contact.phone ?? "")
    setWhatsapp(contact.whatsapp ?? "")
    setIsPrimary(contact.isPrimary)
    setIsDecisionMaker(contact.isDecisionMaker)
    setNotes(contact.notes ?? "")
    setError("")
    setModalOpen(true)
  }

  function closeModal() {
    if (loading) return
    setModalOpen(false)
    resetForm()
  }

  async function saveContact() {
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const endpoint = editingContact
        ? `/api/clients/${client.id}/contacts/${editingContact.id}`
        : `/api/clients/${client.id}/contacts`
      const response = await fetch(endpoint, {
        method: editingContact ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          jobTitle,
          department,
          email,
          phone,
          whatsapp,
          ...(isPrimary ? { isPrimary: true } : {}),
          isDecisionMaker,
          notes,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ جهة الاتصال")
        return
      }

      setSuccess(
        editingContact
          ? "تم تحديث جهة الاتصال."
          : "تمت إضافة جهة الاتصال.",
      )
      setModalOpen(false)
      resetForm()
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  async function patchContact(
    contact: ContactItem,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setError("")
    setSuccess("")
    setActionLoading(true)

    try {
      const response = await fetch(
        `/api/clients/${client.id}/contacts/${contact.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      )
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تحديث جهة الاتصال")
        return
      }

      setSuccess(successMessage)
      setPendingAction(null)
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم")
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
    dateStyle: "medium",
    timeZone,
  })

  return (
    <div className="aqua-crm-detail-page">
      <AquaPageHeader
        badge="Client account"
        title={client.name}
        description="ملف العميل وجهات الاتصال والأعمال المرتبطة به داخل Aqua Tech CS."
        brandValue="CRM"
      />

      <div className="aqua-crm-actions">
        <AquaLinkButton href="/dashboard/clients" variant="ghost">
          رجوع إلى العملاء
        </AquaLinkButton>
        {canManage ? (
          <AquaButton leadingIcon={<Plus />} onClick={openCreate}>
            إضافة جهة اتصال
          </AquaButton>
        ) : null}
      </div>

      {error ? (
        <AquaAlert variant="danger" title="تعذر إكمال العملية">
          {error}
        </AquaAlert>
      ) : null}

      {success ? (
        <AquaAlert variant="success" title="تم الحفظ">
          {success}
        </AquaAlert>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <AquaDataPanel
            eyebrow="ملف العميل"
            title="بيانات الحساب"
            description="يمثل هذا السجل الشركة العميلة أو العميل الفرد، بينما تحفظ جهات الاتصال بصورة مستقلة."
          >
            <AquaDetailList
              columns={2}
              items={[
                {
                  label: "النوع",
                  value: clientTypeLabel(client.type),
                },
                {
                  label: "الحالة",
                  value: clientStatusLabel(client.status),
                },
                {
                  label: "المصدر",
                  value: sourceLabel(client.source),
                },
                {
                  label: "المجال",
                  value: client.industry,
                },
                {
                  label: "الموقع الإلكتروني",
                  value: client.website,
                  dir: "ltr",
                },
                {
                  label: "الموقع",
                  value:
                    [client.city, client.country].filter(Boolean).join("، ") ||
                    null,
                },
                {
                  label: "جهة الاتصال الرئيسية",
                  value:
                    activeContacts.find((contact) => contact.isPrimary)?.name ??
                    null,
                },
                {
                  label: "تاريخ الإضافة",
                  value: formatDate.format(new Date(client.createdAt)),
                },
                {
                  label: "ملاحظات",
                  value: client.notes,
                  fullWidth: true,
                },
              ]}
            />
          </AquaDataPanel>
        </div>

        <div className="col-12 col-xl-5">
          <AquaDataPanel
            eyebrow="الارتباطات"
            title="ملخص السجل"
            description="عدد السجلات التشغيلية المرتبطة بهذا العميل."
          >
            <div className="d-flex flex-wrap gap-2">
              <AquaBadge variant="blue">
                جهات الاتصال {activeContacts.length}
              </AquaBadge>
              <AquaBadge>Leads {client._count.leads}</AquaBadge>
              <AquaBadge>
                الفرص {client._count.salesOpportunities}
              </AquaBadge>
              <AquaBadge variant="success">
                المشاريع {client._count.projects}
              </AquaBadge>
              <AquaBadge>
                الطلبات {client._count.serviceRequests}
              </AquaBadge>
              <AquaBadge>
                الفواتير {client._count.invoices}
              </AquaBadge>
              {archivedContacts > 0 ? (
                <AquaBadge variant="muted">
                  مؤرشف {archivedContacts}
                </AquaBadge>
              ) : null}
            </div>
          </AquaDataPanel>
        </div>
      </div>

      <AquaDataPanel
        eyebrow="Contacts"
        title="جهات الاتصال"
        description="الأشخاص المرتبطون بحساب العميل، مع جهة رئيسية واحدة وصاحب قرار عند الحاجة."
        actions={
          canManage ? (
            <AquaButton size="sm" leadingIcon={<Plus />} onClick={openCreate}>
              جهة اتصال جديدة
            </AquaButton>
          ) : null
        }
      >
        <AquaTable
          mobileStrategy="stack"
          minWidth="920px"
          caption={`جهات اتصال العميل ${client.name}`}
        >
          <thead>
            <tr>
              <th scope="col">الاسم</th>
              <th scope="col">الدور</th>
              <th scope="col">التواصل</th>
              <th scope="col">الصفة</th>
              <th scope="col">الحالة</th>
              <th scope="col">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {client.contacts.length === 0 ? (
              <AquaTableStateRow
                colSpan={6}
                variant="empty"
                icon={<UserRound />}
                title="لا توجد جهات اتصال"
                description="أضف الشخص الرئيسي الذي يتم التواصل معه لدى هذا العميل."
              />
            ) : (
              client.contacts.map((contact) => (
                <tr key={contact.id}>
                  <td data-label="الاسم">
                    <div className="aqua-table__primary">{contact.name}</div>
                    <div className="aqua-table__secondary">
                      {contact.department || "—"}
                    </div>
                  </td>
                  <td data-label="الدور">
                    <span className="aqua-table__secondary">
                      {contact.jobTitle || "غير محدد"}
                    </span>
                  </td>
                  <td data-label="التواصل">
                    <div className="aqua-table__primary" dir="ltr">
                      {contact.email || "لا يوجد بريد"}
                    </div>
                    <div className="aqua-table__secondary" dir="ltr">
                      {contact.phone || contact.whatsapp || "لا يوجد هاتف"}
                    </div>
                  </td>
                  <td data-label="الصفة">
                    <div className="d-flex flex-wrap gap-1">
                      {contact.isPrimary ? (
                        <AquaBadge size="sm" variant="blue">
                          رئيسية
                        </AquaBadge>
                      ) : null}
                      {contact.isDecisionMaker ? (
                        <AquaBadge size="sm" variant="warning">
                          صاحب قرار
                        </AquaBadge>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="الحالة">
                    <AquaBadge
                      size="sm"
                      variant={contact.archivedAt ? "muted" : "success"}
                      dot
                    >
                      {contact.archivedAt ? "مؤرشفة" : "نشطة"}
                    </AquaBadge>
                  </td>
                  <td data-label="إجراء">
                    {canManage ? (
                      <div className="aqua-table__actions">
                        {!contact.archivedAt ? (
                          <>
                            <AquaButton
                              size="sm"
                              variant="ghost"
                              leadingIcon={<Pencil />}
                              onClick={() => openEdit(contact)}
                            >
                              تعديل
                            </AquaButton>
                            {!contact.isPrimary ? (
                              <AquaButton
                                size="sm"
                                variant="secondary"
                                leadingIcon={<Star />}
                                onClick={() =>
                                  setPendingAction({
                                    type: "primary",
                                    contact,
                                  })
                                }
                              >
                                تعيين رئيسية
                              </AquaButton>
                            ) : null}
                            <AquaButton
                              size="sm"
                              variant="ghost"
                              leadingIcon={<Archive />}
                              onClick={() =>
                                setPendingAction({
                                  type: "archive",
                                  contact,
                                })
                              }
                            >
                              أرشفة
                            </AquaButton>
                          </>
                        ) : (
                          <AquaButton
                            size="sm"
                            variant="secondary"
                            leadingIcon={<RotateCcw />}
                            onClick={() =>
                              void patchContact(
                                contact,
                                {
                                  archived: false,
                                },
                                "تمت استعادة جهة الاتصال.",
                              )
                            }
                          >
                            استعادة
                          </AquaButton>
                        )}
                      </div>
                    ) : (
                      <span className="aqua-table__secondary">قراءة فقط</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AquaTable>
      </AquaDataPanel>

      <AquaModal
        open={modalOpen}
        onClose={closeModal}
        title={editingContact ? "تعديل جهة الاتصال" : "إضافة جهة اتصال"}
        description="احفظ الشخص ووسائل التواصل والدور داخل حساب العميل."
        size="lg"
        footer={
          <>
            <AquaButton variant="ghost" onClick={closeModal} disabled={loading}>
              إلغاء
            </AquaButton>
            <AquaButton
              loading={loading}
              loadingLabel="جارٍ الحفظ"
              onClick={() => void saveContact()}
            >
              حفظ جهة الاتصال
            </AquaButton>
          </>
        }
      >
        <div className="aqua-form-grid">
          <AquaInput
            required
            label="الاسم"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <AquaInput
            span={6}
            label="المسمى الوظيفي"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
          <AquaInput
            span={6}
            label="القسم"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
          <AquaInput
            span={6}
            type="email"
            dir="ltr"
            label="البريد الإلكتروني"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AquaInput
            span={6}
            dir="ltr"
            label="الهاتف"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <AquaInput
            span={6}
            dir="ltr"
            label="واتساب"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
          />
          <div className="d-flex flex-column gap-2" data-aqua-span="6">
            <label className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={isPrimary}
                disabled={Boolean(editingContact?.isPrimary)}
                onChange={(event) => setIsPrimary(event.target.checked)}
              />
              <span className="form-check-label">جهة الاتصال الرئيسية</span>
            </label>
            <label className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={isDecisionMaker}
                onChange={(event) =>
                  setIsDecisionMaker(event.target.checked)
                }
              />
              <span className="form-check-label">صاحب قرار</span>
            </label>
          </div>
          <AquaTextarea
            label="ملاحظات داخلية"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
        </div>
      </AquaModal>

      <AquaConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!actionLoading) setPendingAction(null)
        }}
        onConfirm={async () => {
          if (!pendingAction) return

          if (pendingAction.type === "primary") {
            await patchContact(
              pendingAction.contact,
              {
                isPrimary: true,
              },
              "تم تغيير جهة الاتصال الرئيسية.",
            )
            return
          }

          await patchContact(
            pendingAction.contact,
            {
              archived: true,
            },
            "تمت أرشفة جهة الاتصال.",
          )
        }}
        title={
          pendingAction?.type === "primary"
            ? "تغيير جهة الاتصال الرئيسية"
            : "أرشفة جهة الاتصال"
        }
        description={
          pendingAction?.type === "primary"
            ? `سيتم اعتماد ${pendingAction.contact.name} كجهة الاتصال الرئيسية ومزامنة البريد والهاتف مع سجل العميل.`
            : `سيتم أرشفة ${pendingAction?.contact.name ?? "جهة الاتصال"} مع الاحتفاظ بسجلها. إذا كانت رئيسية سيختار النظام بديلًا نشطًا.`
        }
        confirmLabel={
          pendingAction?.type === "primary" ? "تعيين رئيسية" : "أرشفة"
        }
        confirmVariant={
          pendingAction?.type === "primary" ? "primary" : "danger"
        }
        tone={pendingAction?.type === "primary" ? "neutral" : "warning"}
        loading={actionLoading}
      />
    </div>
  )
}
