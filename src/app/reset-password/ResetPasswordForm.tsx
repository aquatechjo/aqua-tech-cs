"use client"

import Link from "next/link"
import { useState } from "react"
import AuthShell from "@/components/auth/AuthShell"
import PasswordInput from "@/components/auth/PasswordInput"

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!token) {
      setError("رابط إعادة التعيين غير مكتمل")
      return
    }

    if (password !== confirmation) {
      setError("كلمتا المرور غير متطابقتين")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmation }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر تغيير كلمة المرور")
        return
      }

      setSuccess(true)
      setPassword("")
      setConfirmation("")
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-4">
        <h2 className="fw-black mb-2">تعيين كلمة مرور جديدة</h2>
        <p className="aqua-muted mb-0">
          استخدم كلمة مرور قوية لا تقل عن 12 حرفًا.
        </p>
      </div>

      {success ? (
        <div>
          <div className="alert alert-success rounded-4 border-0" role="status">
            تم تغيير كلمة المرور وإلغاء جميع الجلسات القديمة بنجاح.
          </div>
          <Link className="btn aqua-btn-primary w-100 py-3 mt-3" href="/login">
            تسجيل الدخول بكلمة المرور الجديدة
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {!token ? (
            <div className="alert alert-danger rounded-4 border-0" role="alert">
              رابط إعادة التعيين غير صالح أو غير مكتمل. اطلب رابطًا جديدًا.
            </div>
          ) : null}

          <div className="mb-3">
            <label htmlFor="new-password" className="form-label aqua-muted">
              كلمة المرور الجديدة
            </label>
            <PasswordInput
              id="new-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="confirm-password" className="form-label aqua-muted">
              تأكيد كلمة المرور
            </label>
            <PasswordInput
              id="confirm-password"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <div className="alert alert-danger rounded-4 border-0 mt-3" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !token}
            className="btn aqua-btn-primary w-100 py-3 mt-3"
          >
            {loading ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      )}

      {!success ? (
        <div className="text-center mt-4">
          <Link className="aqua-auth-link" href="/forgot-password">
            طلب رابط استعادة جديد
          </Link>
        </div>
      ) : null}
    </AuthShell>
  )
}
