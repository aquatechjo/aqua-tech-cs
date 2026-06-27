"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientStatus, ClientType, LeadSource } from "@/generated/prisma/enums";
import AquaPageHeader from "@/components/layout/AquaPageHeader";

type ClientItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  type: ClientType;
  status: ClientStatus;
  source: LeadSource;
  industry: string | null;
  country: string | null;
  city: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Stats = {
  totalClients: number;
  activeClients: number;
  leadsCount: number;
  archivedCount: number;
  from: number;
  to: number;
  currentPage: number;
  totalPages: number;
};

type Filters = {
  q: string;
  status: string;
  type: string;
  source: string;
};

const PAGE_SIZE = 20;

const clientTypes: ClientType[] = ["COMPANY", "INDIVIDUAL"];
const clientStatuses: ClientStatus[] = [
  "LEAD",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
];
const leadSources: LeadSource[] = [
  "WEBSITE",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "REFERRAL",
  "DIRECT",
  "OTHER",
];

function statusBadge(status: ClientStatus) {
  if (status === "ACTIVE") return "text-bg-success";
  if (status === "LEAD") return "text-bg-info";
  if (status === "INACTIVE") return "text-bg-secondary";
  return "text-bg-danger";
}

function clientTypeLabel(type: ClientType) {
  const labels: Record<ClientType, string> = {
    COMPANY: "شركة",
    INDIVIDUAL: "فرد",
  };

  return labels[type];
}

function clientStatusLabel(status: ClientStatus) {
  const labels: Record<ClientStatus, string> = {
    LEAD: "فرصة",
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    ARCHIVED: "مؤرشف",
  };

  return labels[status];
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
  };

  return labels[source];
}

export default function ClientsClient({
  clients,
  filters,
  stats,
  pagination,
}: {
  clients: ClientItem[];
  filters: Filters;
  stats: Stats;
  pagination: React.ReactNode;
}) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState<ClientType>("COMPANY");
  const [status, setStatus] = useState<ClientStatus>("LEAD");
  const [source, setSource] = useState<LeadSource>("OTHER");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("Jordan");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingId);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setType("COMPANY");
    setStatus("LEAD");
    setSource("OTHER");
    setIndustry("");
    setCountry("Jordan");
    setCity("");
    setNotes("");
    setError("");
  }

  function startEdit(client: ClientItem) {
    setEditingId(client.id);
    setName(client.name);
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    setWebsite(client.website ?? "");
    setType(client.type);
    setStatus(client.status);
    setSource(client.source);
    setIndustry(client.industry ?? "");
    setCountry(client.country ?? "");
    setCity(client.city ?? "");
    setNotes(client.notes ?? "");
    setError("");
  }

  async function submitClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isEditing ? `/api/clients/${editingId}` : "/api/clients";
      const method = isEditing ? "PATCH" : "POST";

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
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات العميل");
        return;
      }

      resetForm();
      router.refresh();
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function archiveClient(client: ClientItem) {
    const nextStatus = client.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";

    const response = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      setError(data.message || "فشل تعديل حالة العميل");
      return;
    }

    router.refresh();
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Clients CRM"
        title="إدارة العملاء"
        description="قاعدة العملاء الداخلية لشركة Aqua.Tech، مع بيانات التواصل، الحالة، المصدر، والمتابعة."
        brandValue="CRM"
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="aqua-card aqua-crm-form-card">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">
                  {isEditing ? "تعديل عميل" : "إضافة عميل"}
                </h3>
                <p className="small aqua-muted mb-0">
                  {isEditing
                    ? "عدّل بيانات العميل الحالية."
                    : "أضف عميل أو فرصة جديدة."}
                </p>
              </div>

              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn aqua-btn-ghost btn-sm"
                >
                  إلغاء
                </button>
              ) : null}
            </div>

            <form onSubmit={submitClient}>
              <div className="mb-3">
                <label className="form-label aqua-muted">اسم العميل</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="مثال: شركة المثال"
                />
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الإيميل</label>
                  <input
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="client@email.com"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الهاتف</label>
                  <input
                    dir="ltr"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="+962..."
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">الموقع</label>
                <input
                  dir="ltr"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  className="form-control aqua-control text-start"
                  placeholder="https://example.com"
                />
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">النوع</label>
                  <select
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as ClientType)
                    }
                    className="form-select aqua-control"
                  >
                    {clientTypes.map((item) => (
                      <option key={item} value={item}>
                        {clientTypeLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ClientStatus)
                    }
                    className="form-select aqua-control"
                  >
                    {clientStatuses.map((item) => (
                      <option key={item} value={item}>
                        {clientStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المصدر</label>
                  <select
                    value={source}
                    onChange={(event) =>
                      setSource(event.target.value as LeadSource)
                    }
                    className="form-select aqua-control"
                  >
                    {leadSources.map((item) => (
                      <option key={item} value={item}>
                        {leadSourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المجال</label>
                  <input
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                    className="form-control aqua-control"
                    placeholder="مثال: برمجيات"
                  />
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الدولة</label>
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="form-control aqua-control"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المدينة</label>
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="form-control aqua-control"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="form-control aqua-control"
                  rows={3}
                />
              </div>

              {error ? (
                <div className="alert alert-danger rounded-4 border-0 mt-3">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="btn aqua-btn-primary w-100 py-3 mt-3"
              >
                {loading
                  ? "جاري الحفظ..."
                  : isEditing
                    ? "حفظ التعديلات"
                    : "إضافة العميل"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="aqua-card aqua-crm-table-card p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">قائمة العملاء</h3>
                <p className="small aqua-muted mb-0">
                  عرض {stats.from} - {stats.to} من أصل {stats.totalClients} عميل
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="aqua-badge">الكل {stats.totalClients}</span>
                <span className="aqua-badge">النشط {stats.activeClients}</span>
                <span className="aqua-badge">الفرص {stats.leadsCount}</span>
                <span className="aqua-badge">
                  المؤرشف {stats.archivedCount}
                </span>
                <span className="small aqua-soft ms-2" dir="ltr">
                  Page {stats.currentPage} / {stats.totalPages}
                </span>
              </div>
            </div>

            <form
              action="/dashboard/clients"
              method="get"
              className="aqua-card-soft p-3 mb-3"
            >
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-4">
                  <label className="form-label aqua-muted">بحث</label>
                  <input
                    name="q"
                    defaultValue={filters.q}
                    className="form-control aqua-control"
                    placeholder="ابحث بالاسم، الإيميل، الهاتف، المجال..."
                  />
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    name="status"
                    defaultValue={filters.status}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {clientStatuses.map((item) => (
                      <option key={item} value={item}>
                        {clientStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">النوع</label>
                  <select
                    name="type"
                    defaultValue={filters.type}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {clientTypes.map((item) => (
                      <option key={item} value={item}>
                        {clientTypeLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">المصدر</label>
                  <select
                    name="source"
                    defaultValue={filters.source}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {leadSources.map((item) => (
                      <option key={item} value={item}>
                        {leadSourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-2">
                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn aqua-btn-primary flex-fill"
                    >
                      تطبيق
                    </button>

                    <a href="/dashboard/clients" className="btn aqua-btn-ghost">
                      مسح
                    </a>
                  </div>
                </div>
              </div>
            </form>

            <div className="aqua-crm-table-scroll">
              <table className="table table-hover align-middle aqua-log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العميل</th>
                    <th>التواصل</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>المصدر</th>
                    <th>الموقع</th>
                    <th>إجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {clients.length === 0 ? (
                    <tr className="aqua-crm-empty-row">
                      <td colSpan={8} className="text-center aqua-soft py-5">
                        <div className="fw-bold text-white mb-2">
                          لا يوجد عملاء حتى الآن
                        </div>
                        <div className="small aqua-muted">
                          أضف أول عميل من النموذج الموجود بجانب الجدول.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    clients.map((client, index) => (
                      <tr key={client.id}>
                        <td className="aqua-soft" dir="ltr">
                          {(stats.currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>

                        <td>
                          <div className="fw-bold">{client.name}</div>
                          <div className="small aqua-soft">
                            {client.industry || "—"}
                          </div>
                        </td>

                        <td>
                          <div className="small" dir="ltr">
                            {client.email || "لا يوجد إيميل"}
                          </div>
                          <div className="small aqua-soft" dir="ltr">
                            {client.phone || "لا يوجد هاتف"}
                          </div>
                        </td>

                        <td>
                          <span className="aqua-badge">
                            {clientTypeLabel(client.type)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${statusBadge(client.status)}`}
                          >
                            {clientStatusLabel(client.status)}
                          </span>
                        </td>

                        <td>
                          <span className="small aqua-muted">
                            {leadSourceLabel(client.source)}
                          </span>
                        </td>

                        <td className="small aqua-muted" dir="ltr">
                          {client.website || "—"}
                        </td>

                        <td>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(client)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>

                            <button
                              type="button"
                              onClick={() => archiveClient(client)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              {client.status === "ARCHIVED"
                                ? "استرجاع"
                                : "أرشفة"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3">{pagination}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
