"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRole } from "@/generated/prisma/enums";
import AquaPageHeader from "@/components/layout/AquaPageHeader"
type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

type CurrentUser = {
  id: string;
  role: UserRole;
};

const roles: UserRole[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "DESIGNER",
  "SALES",
  "MARKETING",
  "SUPPORT",
  "FINANCE",
];

function canManage(role: UserRole) {
  return role === "OWNER" || role === "ADMIN";
}

export default function TeamClient({
  users,
  currentUser,
}: {
  users: TeamUser[];
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const manager = canManage(currentUser.role);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("DEVELOPER");
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingId);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("DEVELOPER");
    setIsActive(true);
    setError("");
  }

  function startEdit(user: TeamUser) {
    setEditingId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setIsActive(user.isActive);
    setError("");
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isEditing ? `/api/team/${editingId}` : "/api/team";
      const method = isEditing ? "PATCH" : "POST";

      const payload = isEditing
        ? {
            name,
            email,
            password,
            role,
            isActive,
          }
        : {
            name,
            email,
            password,
            role,
          };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات الموظف");
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

  async function toggleUser(userId: string, currentState: boolean) {
    const response = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isActive: !currentState,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      setError(data.message || "فشل تعديل حالة الموظف");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <AquaPageHeader
        badge="Team Management"
        title="إدارة الفريق"
        description="من هنا تدير حسابات موظفي الشركة داخل النظام الداخلي فقط، مع الأدوار وصلاحيات الدخول."
        brandValue="Team"
      />

      <div className="row g-4">
        {manager ? (
          <div className="col-12 col-xl-4">
            <div className="aqua-card p-4 h-100">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-black mb-1">
                    {isEditing ? "تعديل موظف" : "إضافة موظف"}
                  </h3>
                  <p className="small aqua-muted mb-0">
                    {isEditing
                      ? "عدّل بيانات حساب الموظف الداخلي."
                      : "أنشئ حساب داخلي جديد لفريق Aqua.Tech."}
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

              <form onSubmit={submitUser}>
                <div className="mb-3">
                  <label className="form-label aqua-muted">الاسم</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="form-control aqua-control"
                    placeholder="مثال: Qusai Kiwan"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">
                    البريد الإلكتروني
                  </label>
                  <input
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="name@aquatech.com"
                  />
                  <div className="form-text aqua-soft">
                    يستخدم فقط كاسم دخول داخل AquaFlow.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">كلمة المرور</label>
                  <input
                    dir="ltr"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder={
                      isEditing
                        ? "اتركها فارغة إذا لا تريد تغييرها"
                        : "12 حرفًا على الأقل"
                    }
                    required={!isEditing}
                    minLength={isEditing && !password ? undefined : 12}
                  />
                  <div className="form-text aqua-soft">
                    {isEditing
                      ? "إذا كتبت كلمة مرور جديدة، سيتم تسجيل خروج الموظف من كل الجلسات."
                      : "استخدم كلمة مرور مؤقتة قوية وفريدة، ثم شاركها مع الموظف بطريقة آمنة."}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">الدور</label>
                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as UserRole)
                    }
                    className="form-select aqua-control"
                    disabled={editingId === currentUser.id}
                  >
                    {roles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                {isEditing ? (
                  <div className="mb-3">
                    <label className="form-label aqua-muted">الحالة</label>
                    <select
                      value={isActive ? "active" : "disabled"}
                      onChange={(event) =>
                        setIsActive(event.target.value === "active")
                      }
                      className="form-select aqua-control"
                      disabled={editingId === currentUser.id}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                ) : null}

                {error ? (
                  <div className="alert alert-danger rounded-4 border-0">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn aqua-btn-primary w-100 py-3 mt-2"
                >
                  {loading
                    ? "جاري الحفظ..."
                    : isEditing
                      ? "حفظ التعديلات"
                      : "إضافة الموظف"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <div className={manager ? "col-12 col-xl-8" : "col-12"}>
          <div className="aqua-card p-4">
            <div className="d-flex align-items-start justify-content-between mb-4">
              <div>
                <h3 className="h5 fw-black mb-1">قائمة الفريق</h3>
                <p className="small aqua-muted mb-0">
                  كل الحسابات الداخلية المرتبطة بـ Aqua.Tech.
                </p>
              </div>

              <span className="aqua-badge">{users.length} Users</span>
            </div>

            <div className="table-responsive aqua-table-wrap">
              <table className="table aqua-table table-hover align-middle">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الدور</th>
                    <th>الحالة</th>
                    <th>آخر دخول</th>
                    {manager ? <th className="text-start">إجراء</th> : null}
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="fw-bold">{user.name}</div>
                        <div className="small aqua-soft" dir="ltr">
                          {user.email}
                        </div>
                      </td>

                      <td>
                        <span className="aqua-badge">{user.role}</span>
                      </td>

                      <td>
                        {user.isActive ? (
                          <span className="badge text-bg-success">Active</span>
                        ) : (
                          <span className="badge text-bg-secondary">
                            Disabled
                          </span>
                        )}
                      </td>

                      <td className="small aqua-muted" dir="ltr">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString("en-GB")
                          : "Never"}
                      </td>

                      {manager ? (
                        <td className="text-start">
                          <div className="d-flex justify-content-start gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>

                            <button
                              type="button"
                              disabled={user.id === currentUser.id}
                              onClick={() => toggleUser(user.id, user.isActive)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              {user.isActive ? "تعطيل" : "تفعيل"}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="small aqua-soft mt-3">
              ملاحظة: حسابات الفريق داخلية فقط، ولا تستخدم كحسابات عملاء أو
              تسجيل عام.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
