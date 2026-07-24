"use client"

import Link from "next/link"
import { useState } from "react"
import AuthShell from "@/components/auth/AuthShell"

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || "تعذر إرسال طلب الاستعادة")
        return
      }

      setSuccess(
        "إذا كان البريد مسجلًا وفعّالًا، ستصلك رسالة تحتوي على رابط إعادة التعيين."
      )
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-4">
        <h2 className="fw-black mb-2">استعادة كلمة المرور</h2>
        <p className="aqua-muted mb-0">
          أدخل بريد حسابك وسنرسل رابطًا آمنًا صالحًا لمدة محدودة.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="forgot-email" className="form-label aqua-muted">
            البريد الإلكتروني
          </label>
          <input
            id="forgot-email"
            dir="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="form-control aqua-control text-start"
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </div>

        {success ? (
          <div className="alert alert-success rounded-4 border-0 mt-3" role="status">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger rounded-4 border-0 mt-3" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || Boolean(success)}
          className="btn aqua-btn-primary w-100 py-3 mt-3"
        >
          {loading ? "جاري الإرسال..." : "إرسال رابط الاستعادة"}
        </button>
      </form>

      <div className="text-center mt-4">
        <Link className="aqua-auth-link" href="/login">
          العودة إلى تسجيل الدخول
        </Link>
      </div>
    </AuthShell>
  )
}
