"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ServiceRequestPriority,
  ServiceRequestSource,
  ServiceRequestStatus,
} from "@/generated/prisma/enums";
import AquaPageHeader from "@/components/layout/AquaPageHeader";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectOption = {
  id: string;
  name: string;
  clientId: string | null;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ServiceRequestItem = {
  id: string;

  clientId: string | null;
  client: ClientOption | null;

  projectId: string | null;
  project: { id: string; name: string } | null;

  assignedToId: string | null;
  assignedTo: UserOption | null;

  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCompany: string | null;

  serviceType: string;
  budgetRange: string | null;
  timeline: string | null;
  message: string | null;

  status: ServiceRequestStatus;
  source: ServiceRequestSource;
  priority: ServiceRequestPriority;

  workflowRunId: string | null;
  proposalUrl: string | null;

  proposalSentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  convertedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

type Filters = {
  q: string;
  status: string;
  source: string;
  priority: string;
  assignedToId: string;
};

type Stats = {
  totalRequests: number;
  newRequests: number;
  proposalRequests: number;
  approvedRequests: number;
  from: number;
  to: number;
  currentPage: number;
  totalPages: number;
};

const statuses: ServiceRequestStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
  "ARCHIVED",
];

const sources: ServiceRequestSource[] = [
  "WEBSITE",
  "MANUAL",
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "REFERRAL",
  "OTHER",
];

const priorities: ServiceRequestPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

function statusLabel(status: ServiceRequestStatus) {
  const labels: Record<ServiceRequestStatus, string> = {
    NEW: "جديد",
    CONTACTED: "تم التواصل",
    QUALIFIED: "مؤهل",
    PROPOSAL_SENT: "تم إرسال العرض",
    APPROVED: "مقبول",
    REJECTED: "مرفوض",
    CONVERTED: "تم التحويل",
    ARCHIVED: "مؤرشف",
  };

  return labels[status];
}

function sourceLabel(source: ServiceRequestSource) {
  const labels: Record<ServiceRequestSource, string> = {
    WEBSITE: "الموقع",
    MANUAL: "يدوي",
    WHATSAPP: "واتساب",
    INSTAGRAM: "إنستغرام",
    FACEBOOK: "فيسبوك",
    REFERRAL: "ترشيح",
    OTHER: "أخرى",
  };

  return labels[source];
}

function priorityLabel(priority: ServiceRequestPriority) {
  const labels: Record<ServiceRequestPriority, string> = {
    LOW: "منخفضة",
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    URGENT: "عاجلة",
  };

  return labels[priority];
}

function statusBadge(status: ServiceRequestStatus) {
  if (status === "APPROVED" || status === "CONVERTED") {
    return "text-bg-success";
  }

  if (status === "PROPOSAL_SENT" || status === "QUALIFIED") {
    return "text-bg-warning";
  }

  if (status === "REJECTED" || status === "ARCHIVED") {
    return "text-bg-danger";
  }

  if (status === "CONTACTED") {
    return "text-bg-info";
  }

  return "text-bg-primary";
}

function priorityBadge(priority: ServiceRequestPriority) {
  if (priority === "URGENT") return "text-bg-danger";
  if (priority === "HIGH") return "text-bg-warning";
  if (priority === "LOW") return "text-bg-secondary";
  return "text-bg-info";
}

export default function ServiceRequestsClient({
  serviceRequests,
  clients,
  projects,
  users,
  filters,
  stats,
  pagination,
}: {
  serviceRequests: ServiceRequestItem[];
  clients: ClientOption[];
  projects: ProjectOption[];
  users: UserOption[];
  filters: Filters;
  stats: Stats;
  pagination: React.ReactNode;
}) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");

  const [serviceType, setServiceType] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [timeline, setTimeline] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<ServiceRequestStatus>("NEW");
  const [source, setSource] = useState<ServiceRequestSource>("MANUAL");
  const [priority, setPriority] = useState<ServiceRequestPriority>("MEDIUM");

  const [workflowRunId, setWorkflowRunId] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingId);

  function resetForm() {
    setEditingId(null);
    setClientId("");
    setProjectId("");
    setAssignedToId("");

    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerCompany("");

    setServiceType("");
    setBudgetRange("");
    setTimeline("");
    setMessage("");

    setStatus("NEW");
    setSource("MANUAL");
    setPriority("MEDIUM");

    setWorkflowRunId("");
    setProposalUrl("");

    setError("");
  }

  function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);

    const selectedProject = projects.find(
      (project) => project.id === nextProjectId,
    );

    if (selectedProject?.clientId) {
      setClientId(selectedProject.clientId);
    }
  }

  function startEdit(request: ServiceRequestItem) {
    setEditingId(request.id);

    setClientId(request.clientId ?? "");
    setProjectId(request.projectId ?? "");
    setAssignedToId(request.assignedToId ?? "");

    setCustomerName(request.customerName);
    setCustomerEmail(request.customerEmail ?? "");
    setCustomerPhone(request.customerPhone ?? "");
    setCustomerCompany(request.customerCompany ?? "");

    setServiceType(request.serviceType);
    setBudgetRange(request.budgetRange ?? "");
    setTimeline(request.timeline ?? "");
    setMessage(request.message ?? "");

    setStatus(request.status);
    setSource(request.source);
    setPriority(request.priority);

    setWorkflowRunId(request.workflowRunId ?? "");
    setProposalUrl(request.proposalUrl ?? "");

    setError("");
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isEditing
        ? `/api/service-requests/${editingId}`
        : "/api/service-requests";

      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: clientId || null,
          projectId: projectId || null,
          assignedToId: assignedToId || null,

          customerName,
          customerEmail: customerEmail || null,
          customerPhone,
          customerCompany,

          serviceType,
          budgetRange,
          timeline,
          message,

          status,
          source,
          priority,

          workflowRunId,
          proposalUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ طلب الخدمة");
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

  async function updateRequestStatus(
    request: ServiceRequestItem,
    nextStatus: ServiceRequestStatus,
  ) {
    setError("");

    const response = await fetch(`/api/service-requests/${request.id}`, {
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
      setError(data.message || "فشل تعديل حالة الطلب");
      return;
    }

    router.refresh();
  }

  async function convertRequest(request: ServiceRequestItem) {
    setError("");

    const response = await fetch(
      `/api/service-requests/${request.id}/convert`,
      {
        method: "POST",
      },
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      setError(data.message || "فشل تحويل طلب الخدمة");
      return;
    }

    router.refresh();
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Service Requests"
        title="طلبات الخدمة"
        description="إدارة الطلبات القادمة من موقع Aqua.Tech أو القنوات الأخرى قبل تحويلها إلى عملاء ومشاريع."
        brandValue="Requests"
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="aqua-card aqua-crm-form-card">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">
                  {isEditing ? "تعديل طلب خدمة" : "إضافة طلب خدمة"}
                </h3>
                <p className="small aqua-muted mb-0">
                  {isEditing
                    ? "عدّل بيانات الطلب وحالته."
                    : "أضف طلب يدوي أو اختبر سيناريو الموقع."}
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

            <form onSubmit={submitRequest}>
              <div className="mb-3">
                <label className="form-label aqua-muted">اسم العميل</label>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="اسم مقدم الطلب"
                />
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الإيميل</label>
                  <input
                    dir="ltr"
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="client@email.com"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الهاتف</label>
                  <input
                    dir="ltr"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="+962..."
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">الشركة</label>
                <input
                  value={customerCompany}
                  onChange={(event) => setCustomerCompany(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="اسم الشركة إن وجد"
                />
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">نوع الخدمة</label>
                <input
                  value={serviceType}
                  onChange={(event) => setServiceType(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="Website / SaaS / AI Automation..."
                />
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الميزانية</label>
                  <input
                    value={budgetRange}
                    onChange={(event) => setBudgetRange(event.target.value)}
                    className="form-control aqua-control"
                    placeholder="500 - 1500 JOD"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المدة</label>
                  <input
                    value={timeline}
                    onChange={(event) => setTimeline(event.target.value)}
                    className="form-control aqua-control"
                    placeholder="2 weeks"
                  />
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ServiceRequestStatus)
                    }
                    className="form-select aqua-control"
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {statusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المصدر</label>
                  <select
                    value={source}
                    onChange={(event) =>
                      setSource(event.target.value as ServiceRequestSource)
                    }
                    className="form-select aqua-control"
                  >
                    {sources.map((item) => (
                      <option key={item} value={item}>
                        {sourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as ServiceRequestPriority)
                    }
                    className="form-select aqua-control"
                  >
                    {priorities.map((item) => (
                      <option key={item} value={item}>
                        {priorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">
                    الموظف المسؤول
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(event) => setAssignedToId(event.target.value)}
                    className="form-select aqua-control"
                  >
                    <option value="">غير محدد</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">
                    العميل الداخلي
                  </label>
                  <select
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="form-select aqua-control"
                  >
                    <option value="">بدون عميل</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">المشروع</label>
                  <select
                    value={projectId}
                    onChange={(event) => changeProject(event.target.value)}
                    className="form-select aqua-control"
                  >
                    <option value="">بدون مشروع</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">Workflow ID</label>
                  <input
                    dir="ltr"
                    value={workflowRunId}
                    onChange={(event) => setWorkflowRunId(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="n8n-run-id"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">رابط العرض</label>
                  <input
                    dir="ltr"
                    value={proposalUrl}
                    onChange={(event) => setProposalUrl(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">تفاصيل الطلب</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
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
                    : "إضافة الطلب"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="aqua-card aqua-crm-table-card p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">قائمة الطلبات</h3>
                <p className="small aqua-muted mb-0">
                  عرض {stats.from} - {stats.to} من أصل {stats.totalRequests} طلب
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="aqua-badge">الكل {stats.totalRequests}</span>
                <span className="aqua-badge">الجديدة {stats.newRequests}</span>
                <span className="aqua-badge">
                  العروض {stats.proposalRequests}
                </span>
                <span className="aqua-badge">
                  المقبولة {stats.approvedRequests}
                </span>
                <span className="small aqua-soft ms-2" dir="ltr">
                  Page {stats.currentPage} / {stats.totalPages}
                </span>
              </div>
            </div>

            <form
              action="/dashboard/service-requests"
              method="get"
              className="aqua-card-soft p-3 mb-3"
            >
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-3">
                  <label className="form-label aqua-muted">بحث</label>
                  <input
                    name="q"
                    defaultValue={filters.q}
                    className="form-control aqua-control"
                    placeholder="ابحث بالاسم، الإيميل، الخدمة..."
                  />
                </div>

                <div className="col-12 col-md-3 col-lg-2">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    name="status"
                    defaultValue={filters.status}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {statusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-3 col-lg-2">
                  <label className="form-label aqua-muted">المصدر</label>
                  <select
                    name="source"
                    defaultValue={filters.source}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {sources.map((item) => (
                      <option key={item} value={item}>
                        {sourceLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-3 col-lg-2">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    name="priority"
                    defaultValue={filters.priority}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {priorities.map((item) => (
                      <option key={item} value={item}>
                        {priorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-3">
                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn aqua-btn-primary flex-fill"
                    >
                      تطبيق
                    </button>

                    <a
                      href="/dashboard/service-requests"
                      className="btn aqua-btn-ghost"
                    >
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
                    <th>الطلب</th>
                    <th>الخدمة</th>
                    <th>المصدر</th>
                    <th>الحالة</th>
                    <th>الأولوية</th>
                    <th>المسؤول</th>
                    <th>إجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {serviceRequests.length === 0 ? (
                    <tr className="aqua-crm-empty-row">
                      <td colSpan={8} className="text-center aqua-soft py-5">
                        <div className="fw-bold text-white mb-2">
                          لا يوجد طلبات خدمة حتى الآن
                        </div>
                        <div className="small aqua-muted">
                          أضف طلب يدوي أو اربط فورم الموقع لاحقًا.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    serviceRequests.map((request, index) => (
                      <tr key={request.id}>
                        <td className="aqua-soft" dir="ltr">
                          {(stats.currentPage - 1) * 20 + index + 1}
                        </td>

                        <td>
                          <div className="fw-bold">{request.customerName}</div>
                          <div className="small aqua-soft" dir="ltr">
                            {request.customerEmail ||
                              request.customerPhone ||
                              "—"}
                          </div>
                        </td>

                        <td>
                          <div className="fw-bold">{request.serviceType}</div>
                          <div className="small aqua-soft">
                            {request.budgetRange || "بدون ميزانية"}
                          </div>
                        </td>

                        <td>
                          <span className="aqua-badge">
                            {sourceLabel(request.source)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${statusBadge(request.status)}`}
                          >
                            {statusLabel(request.status)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${priorityBadge(request.priority)}`}
                          >
                            {priorityLabel(request.priority)}
                          </span>
                        </td>

                        <td className="small aqua-muted">
                          {request.assignedTo?.name || "غير محدد"}
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(request)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>

                            {request.status === "NEW" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request, "CONTACTED")
                                }
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                تواصل
                              </button>
                            ) : null}

                            {request.status !== "PROPOSAL_SENT" &&
                            request.status !== "APPROVED" &&
                            request.status !== "CONVERTED" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request, "PROPOSAL_SENT")
                                }
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                عرض
                              </button>
                            ) : null}

                            {request.status !== "APPROVED" &&
                            request.status !== "CONVERTED" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request, "APPROVED")
                                }
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                قبول
                              </button>
                            ) : null}

                            {request.status !== "CONVERTED" &&
                            request.status !== "ARCHIVED" &&
                            request.status !== "REJECTED" ? (
                              <button
                                type="button"
                                onClick={() => convertRequest(request)}
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                تحويل
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                updateRequestStatus(
                                  request,
                                  request.status === "ARCHIVED"
                                    ? "NEW"
                                    : "ARCHIVED",
                                )
                              }
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              {request.status === "ARCHIVED"
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
