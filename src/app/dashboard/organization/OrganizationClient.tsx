"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import AquaPageHeader from "@/components/layout/AquaPageHeader"

type Department = {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  leadProfileId: string | null
  leadProfile: { id: string; user: { name: string } } | null
  _count: {
    employeeProfiles: number
    jobRoles: number
    teams: number
  }
}

type JobRole = {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  departmentId: string | null
  department: { id: string; name: string; code: string } | null
  _count: { employeeProfiles: number }
}

type EmployeeProfile = {
  id: string
  user: {
    id: string
    name: string
    email: string
    isActive: boolean
  }
  department: { id: string; name: string } | null
  jobRole: { id: string; name: string } | null
  allocatedPercent: number
}

type Membership = {
  id: string
  allocationPercent: number
  responsibility: string | null
  employeeProfile: {
    id: string
    user: { name: string; email: string }
  }
}

type Team = {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  departmentId: string | null
  leadProfileId: string | null
  department: { id: string; name: string; code: string } | null
  leadProfile: { id: string; user: { name: string } } | null
  memberships: Membership[]
}

type ApiMethod = "POST" | "PATCH" | "DELETE"

export default function OrganizationClient({
  canManage,
  departments,
  jobRoles,
  employeeProfiles,
  teams,
}: {
  canManage: boolean
  departments: Department[]
  jobRoles: JobRole[]
  employeeProfiles: EmployeeProfile[]
  teams: Team[]
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loadingKey, setLoadingKey] = useState("")

  const [departmentEditingId, setDepartmentEditingId] = useState<string | null>(
    null
  )
  const [departmentName, setDepartmentName] = useState("")
  const [departmentCode, setDepartmentCode] = useState("")
  const [departmentDescription, setDepartmentDescription] = useState("")
  const [departmentLeadId, setDepartmentLeadId] = useState("")

  const [jobRoleEditingId, setJobRoleEditingId] = useState<string | null>(null)
  const [jobRoleName, setJobRoleName] = useState("")
  const [jobRoleCode, setJobRoleCode] = useState("")
  const [jobRoleDepartmentId, setJobRoleDepartmentId] = useState("")
  const [jobRoleDescription, setJobRoleDescription] = useState("")

  const [teamEditingId, setTeamEditingId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState("")
  const [teamCode, setTeamCode] = useState("")
  const [teamDepartmentId, setTeamDepartmentId] = useState("")
  const [teamLeadId, setTeamLeadId] = useState("")
  const [teamDescription, setTeamDescription] = useState("")

  const [membershipTeamId, setMembershipTeamId] = useState("")
  const [membershipEmployeeId, setMembershipEmployeeId] = useState("")
  const [allocationPercent, setAllocationPercent] = useState("100")
  const [responsibility, setResponsibility] = useState("")

  async function mutate(
    key: string,
    endpoint: string,
    method: ApiMethod,
    payload?: unknown
  ) {
    setError("")
    setLoadingKey(key)

    try {
      const response = await fetch(endpoint, {
        method,
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر حفظ التعديل")
        return false
      }

      router.refresh()
      return true
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
      return false
    } finally {
      setLoadingKey("")
    }
  }

  function resetDepartmentForm() {
    setDepartmentEditingId(null)
    setDepartmentName("")
    setDepartmentCode("")
    setDepartmentDescription("")
    setDepartmentLeadId("")
  }

  function editDepartment(department: Department) {
    setDepartmentEditingId(department.id)
    setDepartmentName(department.name)
    setDepartmentCode(department.code)
    setDepartmentDescription(department.description || "")
    setDepartmentLeadId(department.leadProfileId || "")
  }

  async function submitDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const saved = await mutate(
      "department-form",
      departmentEditingId
        ? `/api/organization/departments/${departmentEditingId}`
        : "/api/organization/departments",
      departmentEditingId ? "PATCH" : "POST",
      {
        name: departmentName,
        code: departmentCode,
        description: departmentDescription,
        ...(departmentEditingId
          ? { leadProfileId: departmentLeadId || null }
          : {}),
      }
    )

    if (saved) {
      resetDepartmentForm()
    }
  }

  function resetJobRoleForm() {
    setJobRoleEditingId(null)
    setJobRoleName("")
    setJobRoleCode("")
    setJobRoleDepartmentId("")
    setJobRoleDescription("")
  }

  function editJobRole(jobRole: JobRole) {
    setJobRoleEditingId(jobRole.id)
    setJobRoleName(jobRole.name)
    setJobRoleCode(jobRole.code)
    setJobRoleDepartmentId(jobRole.departmentId || "")
    setJobRoleDescription(jobRole.description || "")
  }

  async function submitJobRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const saved = await mutate(
      "job-role-form",
      jobRoleEditingId
        ? `/api/organization/job-roles/${jobRoleEditingId}`
        : "/api/organization/job-roles",
      jobRoleEditingId ? "PATCH" : "POST",
      {
        name: jobRoleName,
        code: jobRoleCode,
        departmentId: jobRoleDepartmentId || null,
        description: jobRoleDescription,
      }
    )

    if (saved) {
      resetJobRoleForm()
    }
  }

  function resetTeamForm() {
    setTeamEditingId(null)
    setTeamName("")
    setTeamCode("")
    setTeamDepartmentId("")
    setTeamLeadId("")
    setTeamDescription("")
  }

  function editTeam(team: Team) {
    setTeamEditingId(team.id)
    setTeamName(team.name)
    setTeamCode(team.code)
    setTeamDepartmentId(team.departmentId || "")
    setTeamLeadId(team.leadProfileId || "")
    setTeamDescription(team.description || "")
  }

  async function submitTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const saved = await mutate(
      "team-form",
      teamEditingId
        ? `/api/organization/teams/${teamEditingId}`
        : "/api/organization/teams",
      teamEditingId ? "PATCH" : "POST",
      {
        name: teamName,
        code: teamCode,
        departmentId: teamDepartmentId || null,
        leadProfileId: teamLeadId || null,
        description: teamDescription,
      }
    )

    if (saved) {
      resetTeamForm()
    }
  }

  async function submitMembership(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const saved = await mutate(
      "membership-form",
      "/api/organization/team-memberships",
      "POST",
      {
        teamId: membershipTeamId,
        employeeProfileId: membershipEmployeeId,
        allocationPercent: Number(allocationPercent),
        responsibility,
      }
    )

    if (saved) {
      setMembershipEmployeeId("")
      setAllocationPercent("100")
      setResponsibility("")
    }
  }

  const activeDepartments = departments.filter((item) => item.isActive)
  const activeTeams = teams.filter((item) => item.isActive)
  const activeEmployees = employeeProfiles.filter((item) => item.user.isActive)
  const totalMemberships = teams.reduce(
    (total, team) => total + team.memberships.length,
    0
  )

  return (
    <div>
      <AquaPageHeader
        badge="Organization"
        title="الهيكل التنظيمي"
        description="الأقسام والمسميات والفرق وتوزيع وقت الموظفين ضمن حدود الشركة نفسها، مع فصل الوظيفة عن صلاحيات النظام."
        brandValue="Structure"
      />

      <div className="d-flex flex-wrap justify-content-end gap-2 mb-4">
        <Link href="/dashboard/team" className="btn aqua-btn-ghost">
          إدارة حسابات الموظفين
        </Link>
      </div>

      <div className="row g-3 mb-4">
        {[
          ["الأقسام", departments.length, "Departments"],
          ["المسميات", jobRoles.length, "Job roles"],
          ["الفرق", teams.length, "Teams"],
          ["التوزيعات", totalMemberships, "Allocations"],
        ].map(([label, value, hint]) => (
          <div className="col-6 col-xl-3" key={String(label)}>
            <div className="aqua-card p-4 h-100">
              <div className="small aqua-muted">{label}</div>
              <div className="display-6 fw-black aqua-text-gradient mt-2">
                {value}
              </div>
              <div className="small aqua-soft mt-2" dir="ltr">
                {hint}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="alert alert-danger rounded-4 border-0">{error}</div>
      ) : null}

      {canManage ? (
        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-4">
            <form onSubmit={submitDepartment} className="aqua-card p-4 h-100">
              <FormHeading
                title={
                  departmentEditingId ? "تعديل القسم" : "إضافة قسم"
                }
                onCancel={
                  departmentEditingId ? resetDepartmentForm : undefined
                }
              />
              <TextField
                label="اسم القسم"
                value={departmentName}
                onChange={setDepartmentName}
                placeholder="مثال: التقنية"
              />
              <TextField
                label="الرمز"
                value={departmentCode}
                onChange={setDepartmentCode}
                placeholder="TECHNOLOGY"
                ltr
              />
              {departmentEditingId ? (
                <SelectField
                  label="مدير القسم"
                  value={departmentLeadId}
                  onChange={setDepartmentLeadId}
                  options={activeEmployees.map((profile) => ({
                    value: profile.id,
                    label: profile.user.name,
                  }))}
                  emptyLabel="غير محدد"
                />
              ) : null}
              <TextArea
                label="الوصف"
                value={departmentDescription}
                onChange={setDepartmentDescription}
              />
              <SubmitButton
                loading={loadingKey === "department-form"}
                label={departmentEditingId ? "حفظ القسم" : "إضافة القسم"}
              />
            </form>
          </div>

          <div className="col-12 col-xl-4">
            <form onSubmit={submitJobRole} className="aqua-card p-4 h-100">
              <FormHeading
                title={
                  jobRoleEditingId
                    ? "تعديل المسمى الوظيفي"
                    : "إضافة مسمى وظيفي"
                }
                onCancel={jobRoleEditingId ? resetJobRoleForm : undefined}
              />
              <TextField
                label="المسمى"
                value={jobRoleName}
                onChange={setJobRoleName}
                placeholder="مثال: مطوّر Full Stack"
              />
              <TextField
                label="الرمز"
                value={jobRoleCode}
                onChange={setJobRoleCode}
                placeholder="FULL_STACK_DEVELOPER"
                ltr
              />
              <SelectField
                label="القسم"
                value={jobRoleDepartmentId}
                onChange={setJobRoleDepartmentId}
                options={activeDepartments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
                emptyLabel="غير مرتبط بقسم"
              />
              <TextArea
                label="الوصف"
                value={jobRoleDescription}
                onChange={setJobRoleDescription}
              />
              <SubmitButton
                loading={loadingKey === "job-role-form"}
                label={
                  jobRoleEditingId ? "حفظ المسمى" : "إضافة المسمى"
                }
              />
            </form>
          </div>

          <div className="col-12 col-xl-4">
            <form onSubmit={submitTeam} className="aqua-card p-4 h-100">
              <FormHeading
                title={teamEditingId ? "تعديل الفريق" : "إضافة فريق"}
                onCancel={teamEditingId ? resetTeamForm : undefined}
              />
              <TextField
                label="اسم الفريق"
                value={teamName}
                onChange={setTeamName}
                placeholder="مثال: فريق المنتجات"
              />
              <TextField
                label="الرمز"
                value={teamCode}
                onChange={setTeamCode}
                placeholder="PRODUCT_TEAM"
                ltr
              />
              <SelectField
                label="القسم"
                value={teamDepartmentId}
                onChange={setTeamDepartmentId}
                options={activeDepartments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
                emptyLabel="عابر للأقسام"
              />
              <SelectField
                label="قائد الفريق"
                value={teamLeadId}
                onChange={setTeamLeadId}
                options={activeEmployees.map((profile) => ({
                  value: profile.id,
                  label: profile.user.name,
                }))}
                emptyLabel="غير محدد"
              />
              <TextArea
                label="الوصف"
                value={teamDescription}
                onChange={setTeamDescription}
              />
              <SubmitButton
                loading={loadingKey === "team-form"}
                label={teamEditingId ? "حفظ الفريق" : "إضافة الفريق"}
              />
            </form>
          </div>
        </div>
      ) : null}

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-6">
          <div className="aqua-card p-4 h-100">
            <SectionHeading
              title="الأقسام"
              hint={`${departments.length} قسم`}
            />
            <div className="d-flex flex-column gap-3">
              {departments.map((department) => (
                <div key={department.id} className="aqua-card-soft p-3">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <strong>{department.name}</strong>
                        <span className="aqua-badge" dir="ltr">
                          {department.code}
                        </span>
                        <StatusBadge active={department.isActive} />
                      </div>
                      <div className="small aqua-soft mt-2">
                        المدير:{" "}
                        {department.leadProfile?.user.name || "غير محدد"}
                      </div>
                    </div>
                    {canManage ? (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          onClick={() => editDepartment(department)}
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          disabled={
                            loadingKey === `department-${department.id}`
                          }
                          onClick={() =>
                            mutate(
                              `department-${department.id}`,
                              `/api/organization/departments/${department.id}`,
                              "PATCH",
                              { isActive: !department.isActive }
                            )
                          }
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          {department.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="small aqua-muted mt-3">
                    {department._count.employeeProfiles} موظف •{" "}
                    {department._count.jobRoles} مسمى •{" "}
                    {department._count.teams} فريق
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="aqua-card p-4 h-100">
            <SectionHeading
              title="المسميات الوظيفية"
              hint={`${jobRoles.length} مسمى`}
            />
            <div className="d-flex flex-column gap-3">
              {jobRoles.map((jobRole) => (
                <div key={jobRole.id} className="aqua-card-soft p-3">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <strong>{jobRole.name}</strong>
                        <span className="aqua-badge" dir="ltr">
                          {jobRole.code}
                        </span>
                        <StatusBadge active={jobRole.isActive} />
                      </div>
                      <div className="small aqua-soft mt-2">
                        {jobRole.department?.name || "غير مرتبط بقسم"} •{" "}
                        {jobRole._count.employeeProfiles} موظف
                      </div>
                    </div>
                    {canManage ? (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          onClick={() => editJobRole(jobRole)}
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          disabled={loadingKey === `job-role-${jobRole.id}`}
                          onClick={() =>
                            mutate(
                              `job-role-${jobRole.id}`,
                              `/api/organization/job-roles/${jobRole.id}`,
                              "PATCH",
                              { isActive: !jobRole.isActive }
                            )
                          }
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          {jobRole.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="aqua-card p-4 mb-4">
        <SectionHeading title="الفرق" hint={`${teams.length} فريق`} />
        {teams.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-soft">
            لا توجد فرق بعد.
          </div>
        ) : (
          <div className="row g-3">
            {teams.map((team) => (
              <div className="col-12 col-lg-6" key={team.id}>
                <div className="aqua-card-soft p-4 h-100">
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <h3 className="h5 fw-black mb-0">{team.name}</h3>
                        <span className="aqua-badge" dir="ltr">
                          {team.code}
                        </span>
                        <StatusBadge active={team.isActive} />
                      </div>
                      <div className="small aqua-soft mt-2">
                        {team.department?.name || "فريق عابر للأقسام"} • القائد:{" "}
                        {team.leadProfile?.user.name || "غير محدد"}
                      </div>
                    </div>
                    {canManage ? (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          onClick={() => editTeam(team)}
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          disabled={loadingKey === `team-${team.id}`}
                          onClick={() =>
                            mutate(
                              `team-${team.id}`,
                              `/api/organization/teams/${team.id}`,
                              "PATCH",
                              { isActive: !team.isActive }
                            )
                          }
                          className="btn aqua-btn-ghost btn-sm"
                        >
                          {team.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 d-flex flex-column gap-2">
                    {team.memberships.length === 0 ? (
                      <div className="small aqua-soft">لا يوجد أعضاء.</div>
                    ) : (
                      team.memberships.map((membership) => (
                        <div
                          key={membership.id}
                          className="d-flex align-items-center justify-content-between gap-3 border-top border-secondary-subtle pt-2"
                        >
                          <div>
                            <div className="fw-bold">
                              {membership.employeeProfile.user.name}
                            </div>
                            <div className="small aqua-soft">
                              {membership.responsibility || "عضو فريق"}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="aqua-badge" dir="ltr">
                              {membership.allocationPercent}%
                            </span>
                            {canManage ? (
                              <button
                                type="button"
                                className="btn aqua-btn-ghost btn-sm"
                                disabled={
                                  loadingKey ===
                                  `membership-${membership.id}`
                                }
                                onClick={() =>
                                  mutate(
                                    `membership-${membership.id}`,
                                    `/api/organization/team-memberships/${membership.id}`,
                                    "DELETE"
                                  )
                                }
                              >
                                إزالة
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row g-4">
        {canManage ? (
          <div className="col-12 col-xl-4">
            <form onSubmit={submitMembership} className="aqua-card p-4 h-100">
              <FormHeading title="توزيع وقت موظف" />
              <SelectField
                label="الموظف"
                value={membershipEmployeeId}
                onChange={setMembershipEmployeeId}
                options={activeEmployees.map((profile) => ({
                  value: profile.id,
                  label: `${profile.user.name} — متاح ${
                    100 - profile.allocatedPercent
                  }%`,
                }))}
                emptyLabel="اختر الموظف"
                required
              />
              <SelectField
                label="الفريق"
                value={membershipTeamId}
                onChange={setMembershipTeamId}
                options={activeTeams.map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                emptyLabel="اختر الفريق"
                required
              />
              <TextField
                label="النسبة من الوقت"
                value={allocationPercent}
                onChange={setAllocationPercent}
                type="number"
                min={1}
                max={100}
                ltr
              />
              <TextField
                label="المسؤولية داخل الفريق"
                value={responsibility}
                onChange={setResponsibility}
                placeholder="اختياري"
                required={false}
              />
              <SubmitButton
                loading={loadingKey === "membership-form"}
                label="حفظ التوزيع"
              />
              <div className="small aqua-soft mt-3">
                إعادة اختيار الموظف والفريق نفسيهما تعدّل النسبة الحالية بدل
                إنشاء سجل مكرر.
              </div>
            </form>
          </div>
        ) : null}

        <div className={canManage ? "col-12 col-xl-8" : "col-12"}>
          <div className="aqua-card p-4 h-100">
            <SectionHeading
              title="طاقة الموظفين"
              hint="الحد الأعلى 100% لكل موظف"
            />
            <div className="row g-3">
              {employeeProfiles.map((profile) => (
                <div className="col-12 col-md-6" key={profile.id}>
                  <div className="aqua-card-soft p-3">
                    <div className="d-flex align-items-start justify-content-between gap-3">
                      <div>
                        <div className="fw-bold">{profile.user.name}</div>
                        <div className="small aqua-soft mt-1">
                          {profile.jobRole?.name || "بدون مسمى"} •{" "}
                          {profile.department?.name || "بدون قسم"}
                        </div>
                      </div>
                      <span className="aqua-badge" dir="ltr">
                        {profile.allocatedPercent}%
                      </span>
                    </div>
                    <div
                      className="progress mt-3"
                      role="progressbar"
                      aria-valuenow={profile.allocatedPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ height: 8 }}
                    >
                      <div
                        className={`progress-bar ${
                          profile.allocatedPercent > 90
                            ? "bg-warning"
                            : "bg-info"
                        }`}
                        style={{
                          width: `${Math.min(profile.allocatedPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="small aqua-soft mt-2">
                      المتاح: {Math.max(0, 100 - profile.allocatedPercent)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormHeading({
  title,
  onCancel,
}: {
  title: string
  onCancel?: () => void
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 mb-4">
      <h3 className="h5 fw-black mb-0">{title}</h3>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="btn aqua-btn-ghost btn-sm"
        >
          إلغاء
        </button>
      ) : null}
    </div>
  )
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <h2 className="h5 fw-black mb-0">{title}</h2>
      <span className="aqua-badge">{hint}</span>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  ltr = false,
  type = "text",
  min,
  max,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ltr?: boolean
  type?: string
  min?: number
  max?: number
  required?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="form-label aqua-muted">{label}</label>
      <input
        required={required}
        type={type}
        min={min}
        max={max}
        dir={ltr ? "ltr" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`form-control aqua-control ${ltr ? "text-start" : ""}`}
        placeholder={placeholder}
      />
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mb-3">
      <label className="form-label aqua-muted">{label}</label>
      <textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="form-control aqua-control"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  emptyLabel,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  emptyLabel: string
  required?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="form-label aqua-muted">{label}</label>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="form-select aqua-control"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SubmitButton({
  loading,
  label,
}: {
  loading: boolean
  label: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="btn aqua-btn-primary w-100 py-3"
    >
      {loading ? "جاري الحفظ..." : label}
    </button>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? "text-bg-success" : "text-bg-secondary"}`}>
      {active ? "فعّال" : "معطّل"}
    </span>
  )
}
