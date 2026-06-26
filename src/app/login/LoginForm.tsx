"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = useState("admin@aquatech.local")
  const [password, setPassword] = useState("Admin@123456")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "فشل تسجيل الدخول")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="aqua-page">
      <div className="aqua-grid" />

      <div className="aqua-layer">
        <div className="container min-vh-100 d-flex align-items-center py-5">
          <div className="row g-5 align-items-center w-100">
            <div className="col-12 col-lg-7 d-none d-lg-block">
              <span className="aqua-badge">Growth • Software • AI</span>

              <h1 className="display-3 fw-black mt-4 mb-4">
                AquaFlow
                <span className="d-block aqua-text-gradient">
                  Build. Launch. Grow.
                </span>
              </h1>

              <p className="fs-5 aqua-muted lh-lg col-xl-10">
                نظام داخلي يوحّد شغل Aqua.Tech: الفريق، العملاء، المشاريع،
                المهام، التنبيهات، وسير العمل من مكان واحد.
              </p>

              <div className="row g-3 mt-4 col-xl-10">
                {[
                  ["Core", "System"],
                  ["AI", "Ready"],
                  ["Ops", "Flow"],
                ].map(([title, subtitle]) => (
                  <div className="col-4" key={title}>
                    <div className="aqua-card-soft p-4 h-100">
                      <div className="fs-3 fw-bold text-info">{title}</div>
                      <div className="small aqua-muted mt-2">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="aqua-card p-4 p-md-5 mx-auto" style={{ maxWidth: 480 }}>
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-3">
                    <div className="aqua-mark">AF</div>
                    <div>
                      <div className="fs-3 fw-black">AquaFlow</div>
                      <div className="small aqua-muted" dir="ltr">
                        Growth • Software • AI
                      </div>
                    </div>
                  </div>

                  <h2 className="fw-black mt-5 mb-2">تسجيل الدخول</h2>
                  <p className="aqua-muted mb-0">
                    ادخل إلى نظام Aqua.Tech الداخلي
                  </p>
                </div>

                <form onSubmit={handleSubmit}>
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
                      placeholder="admin@aquatech.local"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label aqua-muted">كلمة المرور</label>
                    <input
                      dir="ltr"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="form-control aqua-control text-start"
                      placeholder="••••••••"
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
                    {loading ? "جاري الدخول..." : "دخول النظام"}
                  </button>
                </form>

                <div className="text-center small aqua-soft mt-4">
                  Aqua.Tech © Internal System
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}