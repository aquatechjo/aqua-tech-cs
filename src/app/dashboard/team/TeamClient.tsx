"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type {
  AccessRole,
  EmploymentType,
} from "@/generated/prisma/enums"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type DepartmentOption = {
  id: string
  name: string
  code: string
}

type JobRoleOption = {
  id: string
  name: string
  code: string
  departmentId: string | null
}

type EmployeeProfile = {
  id: string
  employeeNumber: string | null
  departmentId: string | null
  jobRoleId: string | null
  employmentType: EmploymentType
  workHoursPerWeek: number
  department: DepartmentOption | null
  jobRole: Omit<JobRoleOption, "departmentId"> | null
}

type TeamUser = {
  id: string
  name: string
  email: string
  role: AccessRole
  isActive: boolean
  lastLoginAt: Date | string | null
  createdAt: Date | string
  employeeProfile: EmployeeProfile | null
}

type CurrentUser = {
  id: string
  role: AccessRole
}

const accessRoles: AccessRole[] = [
  "OWNER",
  "ADMIN",
  "OPERATIONS_MANAGER",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
  "MEMBER",
]

const employmentTypes: EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACTOR",
  "INTERN",
]

const accessRoleLabels: Record<AccessRole, string> = {
  OWNER: "مالك النظام",
  ADMIN: "مدير النظام",
  OPERATIONS_MANAGER: "إدارة العمليات",
  SALES_MANAGER: "إدارة المبيعات",
  FINANCE_MANAGER: "إدارة المالية",
  MEMBER: "عضو فريق",
}

const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: "دوام كامل",
  PART_TIME: "دوام جزئي",
  CONTRACTOR: "متعاقد",
  INTERN: "متدرب",
}

function canManage(role: AccessRole) {
  return role === "OWNER" || role === "ADMIN"
}

export default function TeamClient({
  users,
  currentUser,
  departments,
  jobRoles,
}: {
  users: TeamUser[]
  currentUser: CurrentUser
  departments: DepartmentOption[]
  jobRoles: JobRoleOption[]
}) {
  const router = useRouter()
  const manager = canManage(currentUser.role)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AccessRole>("MEMBER")
  const [isActive, setIsActive] = useState(true)
  const [departmentId, setDepartmentId] = useState("")
  const [jobRoleId, setJobRoleId] = useState("")
  const [employeeNumber, setEmployeeNumber] = useState("")
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME")
  const [workHoursPerWeek, setWorkHoursPerWeek] = useState("40")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const isEditing = Boolean(editingId)
  const editingOwner = users.some(
    (user) => user.id === editingId && user.role === "OWNER"
  )
  const availableJobRoles = useMemo(
    () =>
      departmentId
        ? jobRoles.filter(
            (item) =>
              item.departmentId === departmentId || item.departmentId === null
          )
        : jobRoles,
    [departmentId, jobRoles]
  )

  function resetForm() {
    setEditingId(null)
    setName("")
    setEmail("")
    setPassword("")
    setRole("MEMBER")
    setIsActive(true)
    setDepartmentId("")
    setJobRoleId("")
    setEmployeeNumber("")
    setEmploymentType("FULL_TIME")
    setWorkHoursPerWeek("40")
    setError("")
  }

  function startEdit(user: TeamUser) {
    setEditingId(user.id)
    setName(user.name)
    setEmail(user.email)
    setPassword("")
    setRole(user.role)
    setIsActive(user.isActive)
    setDepartmentId(user.employeeProfile?.departmentId || "")
    setJobRoleId(user.employeeProfile?.jobRoleId || "")
    setEmployeeNumber(user.employeeProfile?.employeeNumber || "")
    setEmploymentType(user.employeeProfile?.employmentType || "FULL_TIME")
    setWorkHoursPerWeek(
      String(user.employeeProfile?.workHoursPerWeek ?? 40)
    )
    setError("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function updateDepartment(value: string) {
    setDepartmentId(value)

    const currentJobRole = jobRoles.find((item) => item.id === jobRoleId)
    if (
      currentJobRole?.departmentId &&
      currentJobRole.departmentId !== value
    ) {
      setJobRoleId("")
    }
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch(
        isEditing ? `/api/team/${editingId}` : "/api/team",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            ...(editingOwner ? {} : { email, password }),
            role,
            ...(isEditing ? { isActive } : {}),
            departmentId: departmentId || null,
            jobRoleId: jobRoleId || null,
            employeeNumber,
            employmentType,
            workHoursPerWeek: Number(workHoursPerWeek),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ بيانات الموظف")
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

  async function toggleUser(userId: string, currentState: boolean) {
    setError("")

    try {
      const response = await fetch(`/api/team/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentState }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل تعديل حالة الموظف")
        return
      }

      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    }
  }

  return (
    <div className="aqua-compact-page aqua-team-page aqua-admin-governance-page">
      <AquaPageHeader
        badge="People & Access"
        title="الفريق والموظفون"
        description="الحساب والصلاحية منفصلان عن القسم والمسمى الوظيفي، لتبقى إدارة الوصول دقيقة من دون خلطها بهوية الموظف."
        brandValue="People"
      />

      <div className="aqua-workforce-actions aqua-admin-actions">
        <Link href="/dashboard/organization" className="btn aqua-btn-ghost">
          إدارة الهيكل التنظيمي والفرق
        </Link>
      </div>

      {error ? (
        <div className="alert alert-danger rounded-4 border-0">{error}</div>
      ) : null}

      <div className="row g-3 aqua-team-workspace aqua-team-admin-workspace">
        {manager ? (
          <div className="col-12 col-xl-4">
            <div className="aqua-card p-4 aqua-team-editor aqua-admin-panel">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
                <div>
                  <h3 className="h5 fw-black mb-1">
                    {isEditing ? "تعديل موظف" : "إضافة موظف"}
                  </h3>
                  <p className="small aqua-muted mb-0">
                    بيانات الدخول والهوية التنظيمية في مكان واحد.
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
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="form-control aqua-control"
                    placeholder="اسم الموظف"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">
                    البريد الإلكتروني
                  </label>
                  <input
                    required={!editingOwner}
                    disabled={editingOwner}
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="form-control aqua-control text-start"
                    placeholder="name@aquatech.com"
                  />
                  {editingOwner ? (
                    <div className="form-text aqua-soft">
                      بريد مالك النظام ثابت وتتم حمايته من التغيير.
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">كلمة المرور</label>
                  {editingOwner ? (
                    <div className="aqua-card-soft p-3 small aqua-muted">
                      كلمة مرور المالك تُغيّر فقط من مسار «نسيت كلمة المرور»
                      الآمن في شاشة الدخول.
                    </div>
                  ) : (
                    <input
                      dir="ltr"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="form-control aqua-control text-start"
                      placeholder={
                        isEditing
                          ? "اتركها فارغة إذا لم تتغير"
                          : "12 حرفًا على الأقل"
                      }
                      required={!isEditing}
                      minLength={isEditing && !password ? undefined : 12}
                    />
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label aqua-muted">
                    مستوى الوصول
                  </label>
                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as AccessRole)
                    }
                    className="form-select aqua-control"
                    disabled={
                      editingId === currentUser.id || editingOwner
                    }
                  >
                    {accessRoles.map((item) => (
                      <option
                        key={item}
                        value={item}
                        disabled={item === "OWNER"}
                      >
                        {accessRoleLabels[item]}
                      </option>
                    ))}
                  </select>
                  <div className="form-text aqua-soft">
                    مستوى الوصول يحدد الصلاحيات فقط، وليس وظيفة الموظف.
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label aqua-muted">القسم</label>
                    <select
                      value={departmentId}
                      onChange={(event) =>
                        updateDepartment(event.target.value)
                      }
                      className="form-select aqua-control"
                    >
                      <option value="">بدون قسم</option>
                      {departments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label aqua-muted">
                      المسمى الوظيفي
                    </label>
                    <select
                      value={jobRoleId}
                      onChange={(event) => setJobRoleId(event.target.value)}
                      className="form-select aqua-control"
                    >
                      <option value="">بدون مسمى</option>
                      {availableJobRoles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row g-3 mt-0">
                  <div className="col-12 col-md-6">
                    <label className="form-label aqua-muted">نوع التوظيف</label>
                    <select
                      value={employmentType}
                      onChange={(event) =>
                        setEmploymentType(
                          event.target.value as EmploymentType
                        )
                      }
                      className="form-select aqua-control"
                    >
                      {employmentTypes.map((item) => (
                        <option key={item} value={item}>
                          {employmentTypeLabels[item]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label aqua-muted">
                      ساعات العمل أسبوعيًا
                    </label>
                    <input
                      dir="ltr"
                      type="number"
                      min="0"
                      max="168"
                      step="0.5"
                      value={workHoursPerWeek}
                      onChange={(event) =>
                        setWorkHoursPerWeek(event.target.value)
                      }
                      className="form-control aqua-control text-start"
                    />
                  </div>
                </div>

                <div className="mb-3 mt-3">
                  <label className="form-label aqua-muted">
                    الرقم الوظيفي
                  </label>
                  <input
                    dir="ltr"
                    value={employeeNumber}
                    onChange={(event) =>
                      setEmployeeNumber(event.target.value)
                    }
                    className="form-control aqua-control text-start"
                    placeholder="اختياري"
                  />
                </div>

                {isEditing ? (
                  <div className="mb-3">
                    <label className="form-label aqua-muted">
                      حالة حساب الدخول
                    </label>
                    <select
                      value={isActive ? "active" : "disabled"}
                      onChange={(event) =>
                        setIsActive(event.target.value === "active")
                      }
                      className="form-select aqua-control"
                      disabled={
                        editingId === currentUser.id || editingOwner
                      }
                    >
                      <option value="active">فعّال</option>
                      <option value="disabled">معطّل</option>
                    </select>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn aqua-btn-primary w-100 mt-2"
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
          <div className="aqua-card p-4 aqua-team-directory aqua-admin-panel">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h3 className="h5 fw-black mb-1">دليل الموظفين</h3>
                <p className="small aqua-muted mb-0">
                  الوظيفة والقسم منفصلان عن صلاحيات الحساب.
                </p>
              </div>
              <span className="aqua-badge">{users.length} موظف</span>
            </div>

            <div className="table-responsive aqua-table-wrap">
              <table className="table aqua-table table-hover align-middle">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الهوية الوظيفية</th>
                    <th>الوصول</th>
                    <th>الحالة</th>
                    <th>آخر دخول</th>
                    {manager ? <th>إجراء</th> : null}
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
                        {user.employeeProfile?.employeeNumber ? (
                          <div className="small aqua-soft mt-1" dir="ltr">
                            #{user.employeeProfile.employeeNumber}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="fw-bold">
                          {user.employeeProfile?.jobRole?.name ||
                            "بدون مسمى وظيفي"}
                        </div>
                        <div className="small aqua-soft mt-1">
                          {user.employeeProfile?.department?.name ||
                            "بدون قسم"}
                          {" • "}
                          {employmentTypeLabels[
                            user.employeeProfile?.employmentType || "FULL_TIME"
                          ]}
                        </div>
                      </td>
                      <td>
                        <span className="aqua-badge">
                          {accessRoleLabels[user.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            user.isActive
                              ? "text-bg-success"
                              : "text-bg-secondary"
                          }`}
                        >
                          {user.isActive ? "فعّال" : "معطّل"}
                        </span>
                      </td>
                      <td className="small aqua-muted" dir="ltr">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString("en-GB")
                          : "Never"}
                      </td>
                      {manager ? (
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                user.role === "OWNER" &&
                                currentUser.role !== "OWNER"
                              }
                              onClick={() => startEdit(user)}
                              className="btn aqua-btn-ghost btn-sm"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              disabled={
                                user.id === currentUser.id ||
                                user.role === "OWNER"
                              }
                              onClick={() =>
                                toggleUser(user.id, user.isActive)
                              }
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
          </div>
        </div>
      </div>
    </div>
  )
}
