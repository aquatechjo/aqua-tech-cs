"use client";

import AquaDatePicker from "@/components/aqua/AquaDatePicker";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectPriority, ProjectStatus } from "@/generated/prisma/enums";
import AquaPageHeader from "@/components/layout/AquaPageHeader";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectItem = {
  id: string;
  clientId: string | null;
  client: ClientOption | null;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  budget: string | null;
  currency: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Filters = {
  q: string;
  status: string;
  priority: string;
  clientId: string;
};

type Stats = {
  totalProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  archivedProjects: number;
  from: number;
  to: number;
  currentPage: number;
  totalPages: number;
};

const projectStatuses: ProjectStatus[] = [
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

const projectPriorities: ProjectPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

function projectStatusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    PLANNING: "تخطيط",
    IN_PROGRESS: "قيد التنفيذ",
    ON_HOLD: "معلّق",
    COMPLETED: "مكتمل",
    CANCELLED: "ملغي",
    ARCHIVED: "مؤرشف",
  };

  return labels[status];
}

function projectPriorityLabel(priority: ProjectPriority) {
  const labels: Record<ProjectPriority, string> = {
    LOW: "منخفضة",
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    URGENT: "عاجلة",
  };

  return labels[priority];
}

function statusBadge(status: ProjectStatus) {
  if (status === "COMPLETED") return "text-bg-success";
  if (status === "IN_PROGRESS") return "text-bg-info";
  if (status === "ON_HOLD") return "text-bg-warning";
  if (status === "CANCELLED" || status === "ARCHIVED") return "text-bg-danger";
  return "text-bg-primary";
}

function priorityBadge(priority: ProjectPriority) {
  if (priority === "URGENT") return "text-bg-danger";
  if (priority === "HIGH") return "text-bg-warning";
  if (priority === "LOW") return "text-bg-secondary";
  return "text-bg-info";
}

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function ProjectsClient({
  projects,
  clients,
  filters,
  stats,
  pagination,
}: {
  projects: ProjectItem[];
  clients: ClientOption[];
  filters: Filters;
  stats: Stats;
  pagination: React.ReactNode;
}) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [priority, setPriority] = useState<ProjectPriority>("MEDIUM");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("JOD");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingId);

  function resetForm() {
    setEditingId(null);
    setClientId("");
    setName("");
    setCode("");
    setDescription("");
    setStatus("PLANNING");
    setPriority("MEDIUM");
    setBudget("");
    setCurrency("JOD");
    setStartDate("");
    setDueDate("");
    setError("");
  }

  function startEdit(project: ProjectItem) {
    setEditingId(project.id);
    setClientId(project.clientId ?? "");
    setName(project.name);
    setCode(project.code ?? "");
    setDescription(project.description ?? "");
    setStatus(project.status);
    setPriority(project.priority);
    setBudget(project.budget ?? "");
    setCurrency(project.currency);
    setStartDate(dateInputValue(project.startDate));
    setDueDate(dateInputValue(project.dueDate));
    setError("");
  }

  async function submitProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isEditing
        ? `/api/projects/${editingId}`
        : "/api/projects";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: clientId || null,
          name,
          code,
          description,
          status,
          priority,
          budget,
          currency,
          startDate: startDate || null,
          dueDate: dueDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات المشروع");
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

  async function updateProjectStatus(
    project: ProjectItem,
    nextStatus: ProjectStatus,
  ) {
    setError("");

    const response = await fetch(`/api/projects/${project.id}`, {
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
      setError(data.message || "فشل تعديل حالة المشروع");
      return;
    }

    router.refresh();
  }

  return (
    <div className="aqua-crm-page">
      <AquaPageHeader
        badge="Projects"
        title="إدارة المشاريع"
        description="متابعة مشاريع Aqua.Tech حسب العميل، الحالة، الأولوية، الميزانية، والمواعيد."
        brandValue="Projects"
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="aqua-card aqua-crm-form-card">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">
                  {isEditing ? "تعديل مشروع" : "إضافة مشروع"}
                </h3>
                <p className="small aqua-muted mb-0">
                  {isEditing
                    ? "عدّل بيانات المشروع الحالية."
                    : "أضف مشروع جديد واربطه بعميل اختياريًا."}
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

            <form onSubmit={submitProject}>
              <div className="mb-3">
                <label className="form-label aqua-muted">اسم المشروع</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="form-control aqua-control"
                  placeholder="مثال: موقع شركة جديدة"
                />
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">كود المشروع</label>
                  <input
                    dir="ltr"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="AQ-001"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">العميل</label>
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
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الحالة</label>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ProjectStatus)
                    }
                    className="form-select aqua-control"
                  >
                    {projectStatuses.map((item) => (
                      <option key={item} value={item}>
                        {projectStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as ProjectPriority)
                    }
                    className="form-select aqua-control"
                  >
                    {projectPriorities.map((item) => (
                      <option key={item} value={item}>
                        {projectPriorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">الميزانية</label>
                  <input
                    dir="ltr"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="1200"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">العملة</label>
                  <input
                    dir="ltr"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="JOD"
                  />
                </div>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">تاريخ البداية</label>
                  <AquaDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="اختر تاريخ البداية"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">تاريخ التسليم</label>
                  <AquaDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="اختر تاريخ التسليم"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label aqua-muted">الوصف</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
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
                    : "إضافة المشروع"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="aqua-card aqua-crm-table-card p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h3 className="h5 fw-black mb-1">قائمة المشاريع</h3>
                <p className="small aqua-muted mb-0">
                  عرض {stats.from} - {stats.to} من أصل {stats.totalProjects}{" "}
                  مشروع
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="aqua-badge">الكل {stats.totalProjects}</span>
                <span className="aqua-badge">
                  قيد التنفيذ {stats.inProgressProjects}
                </span>
                <span className="aqua-badge">
                  المكتملة {stats.completedProjects}
                </span>
                <span className="aqua-badge">
                  المؤرشفة {stats.archivedProjects}
                </span>
                <span className="small aqua-soft ms-2" dir="ltr">
                  Page {stats.currentPage} / {stats.totalPages}
                </span>
              </div>
            </div>

            <form
              action="/dashboard/projects"
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
                    placeholder="ابحث بالاسم، الكود، الوصف..."
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
                    {projectStatuses.map((item) => (
                      <option key={item} value={item}>
                        {projectStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">الأولوية</label>
                  <select
                    name="priority"
                    defaultValue={filters.priority}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {projectPriorities.map((item) => (
                      <option key={item} value={item}>
                        {projectPriorityLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4 col-lg-2">
                  <label className="form-label aqua-muted">العميل</label>
                  <select
                    name="clientId"
                    defaultValue={filters.clientId}
                    className="form-select aqua-control"
                  >
                    <option value="">الكل</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
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

                    <a
                      href="/dashboard/projects"
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
                    <th>المشروع</th>
                    <th>العميل</th>
                    <th>الحالة</th>
                    <th>الأولوية</th>
                    <th>الميزانية</th>
                    <th>التسليم</th>
                    <th>إجراء</th>
                  </tr>
                </thead>

                <tbody>
                  {projects.length === 0 ? (
                    <tr className="aqua-crm-empty-row">
                      <td colSpan={8} className="text-center aqua-soft py-5">
                        <div className="fw-bold text-white mb-2">
                          لا يوجد مشاريع حتى الآن
                        </div>
                        <div className="small aqua-muted">
                          أضف أول مشروع من النموذج الموجود بجانب الجدول.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    projects.map((project, index) => (
                      <tr key={project.id}>
                        <td className="aqua-soft" dir="ltr">
                          {(stats.currentPage - 1) * 20 + index + 1}
                        </td>

                        <td>
                          <div className="fw-bold">{project.name}</div>
                          <div className="small aqua-soft" dir="ltr">
                            {project.code || "—"}
                          </div>
                        </td>

                        <td className="small aqua-muted">
                          {project.client?.name || "بدون عميل"}
                        </td>

                        <td>
                          <span
                            className={`badge ${statusBadge(project.status)}`}
                          >
                            {projectStatusLabel(project.status)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${priorityBadge(project.priority)}`}
                          >
                            {projectPriorityLabel(project.priority)}
                          </span>
                        </td>

                        <td className="small aqua-muted" dir="ltr">
                          {project.budget
                            ? `${project.budget} ${project.currency}`
                            : "—"}
                        </td>

                        <td className="small aqua-muted" dir="ltr">
                          {project.dueDate
                            ? dateInputValue(project.dueDate)
                            : "—"}
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(project)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>

                            {project.status !== "COMPLETED" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProjectStatus(project, "COMPLETED")
                                }
                                className="btn aqua-btn-ghost btn-sm"
                              >
                                إكمال
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() =>
                                updateProjectStatus(
                                  project,
                                  project.status === "ARCHIVED"
                                    ? "IN_PROGRESS"
                                    : "ARCHIVED",
                                )
                              }
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              {project.status === "ARCHIVED"
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
