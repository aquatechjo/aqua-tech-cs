"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccessRole } from "@/generated/prisma/enums";
import AquaPageHeader from "@/components/layout/AquaPageHeader";

type CompanySettings = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string;
  currency: string;
  timezone: string;
  language: string;
  updatedAt: Date;
};

function canManage(role: AccessRole) {
  return role === "OWNER" || role === "ADMIN";
}

export default function SettingsClient({
  company,
  currentUser,
}: {
  company: CompanySettings;
  currentUser: {
    role: AccessRole;
  };
}) {
  const router = useRouter();
  const editable = canManage(currentUser.role);

  const [name, setName] = useState(company.name);
  const [email, setEmail] = useState(company.email ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [country, setCountry] = useState(company.country);
  const [currency, setCurrency] = useState(company.currency);
  const [timezone, setTimezone] = useState(company.timezone);
  const [language, setLanguage] = useState(company.language);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          website,
          address,
          country,
          currency,
          timezone,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل حفظ إعدادات الشركة");
        return;
      }

      setSuccess("تم حفظ إعدادات الشركة بنجاح");
      router.refresh();
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="aqua-compact-page aqua-settings-page aqua-admin-governance-page">
      <AquaPageHeader
        badge="Company Settings"
        title="إعدادات الشركة"
        description="هذه البيانات تعتبر مرجع الشركة داخل النظام، وتستخدم لاحقًا في الفواتير، العروض، التقارير، والهوية الداخلية."
        brandValue="Aqua.Tech"
      />

      <div className="row g-3 align-items-start aqua-settings-workspace">
        <div className="col-12 col-xl-8">
          <div className="aqua-card aqua-settings-form-card aqua-admin-panel">
            <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
              <div>
                <h3 className="h5 fw-black mb-1">بيانات الشركة</h3>
                <p className="small aqua-muted mb-0">
                  عدّل معلومات Aqua.Tech الأساسية.
                </p>
              </div>

              <span className="aqua-badge">{company.slug}</span>
            </div>

            {!editable ? (
              <div className="alert alert-warning rounded-4 border-0">
                لا تملك صلاحية تعديل إعدادات الشركة.
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">اسم الشركة</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control"
                    placeholder="Aqua.Tech"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">إيميل الشركة</label>
                  <input
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control text-start"
                    placeholder="info.aquatech.jo@gmail.com"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">رقم الهاتف</label>
                  <input
                    dir="ltr"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control text-start"
                    placeholder="+962..."
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label aqua-muted">
                    الموقع الإلكتروني
                  </label>
                  <input
                    dir="ltr"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control text-start"
                    placeholder="https://aquatechagency.com"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label aqua-muted">العنوان</label>
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control"
                    placeholder="Jordan"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label aqua-muted">الدولة</label>
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control"
                    placeholder="Jordan"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label aqua-muted">العملة</label>
                  <input
                    dir="ltr"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    disabled={!editable}
                    className="form-control aqua-control text-start"
                    placeholder="JOD"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label aqua-muted">اللغة</label>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    disabled={!editable}
                    className="form-select aqua-control"
                  >
                    <option value="ar">Arabic</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label aqua-muted">
                    المنطقة الزمنية
                  </label>
                  <select
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    disabled={!editable}
                    className="form-select aqua-control"
                  >
                    <option value="Asia/Amman">Asia/Amman</option>
                    <option value="Africa/Cairo">Africa/Cairo</option>
                    <option value="Asia/Riyadh">Asia/Riyadh</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              {error ? (
                <div className="alert alert-danger rounded-4 border-0 mt-4">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="alert alert-success rounded-4 border-0 mt-4">
                  {success}
                </div>
              ) : null}

              {editable ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="btn aqua-btn-primary px-4 mt-4"
                >
                  {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
              ) : null}
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="aqua-card aqua-settings-preview-card aqua-admin-panel">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="aqua-mark">AF</div>

              <div>
                <h3 className="h5 fw-black mb-1">Aqua.Tech Identity</h3>
                <p className="small aqua-muted mb-0">ملخص بيانات الشركة</p>
              </div>
            </div>

            <div className="aqua-card-soft p-3 mb-3">
              <div className="small aqua-muted">Company</div>
              <div className="fw-black text-truncate">{name}</div>
            </div>

            <div className="aqua-card-soft p-3 mb-3">
              <div className="small aqua-muted">Email</div>
              <div className="fw-black text-truncate" dir="ltr">
                {email || "غير محدد"}
              </div>
            </div>

            <div className="aqua-card-soft p-3 mb-3">
              <div className="small aqua-muted">Website</div>
              <div className="fw-black text-truncate" dir="ltr">
                {website || "غير محدد"}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-6">
                <div className="aqua-card-soft p-3">
                  <div className="small aqua-muted">Currency</div>
                  <div className="fw-black" dir="ltr">
                    {currency}
                  </div>
                </div>
              </div>

              <div className="col-6">
                <div className="aqua-card-soft p-3">
                  <div className="small aqua-muted">Lang</div>
                  <div className="fw-black" dir="ltr">
                    {language}
                  </div>
                </div>
              </div>
            </div>

            <div className="aqua-card-soft p-3 mt-3">
              <div className="small fw-bold text-info mb-2" dir="ltr">
                ملاحظة النظام
              </div>
              <p className="small aqua-muted mb-0">
                ستستخدم هذه البيانات لاحقًا في الفواتير، العروض، العقود،
                والتقارير.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
