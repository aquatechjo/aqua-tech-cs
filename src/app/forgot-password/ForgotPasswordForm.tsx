"use client"

import { CircleAlert, MailCheck, Send } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { AquaAlert, AquaButton, AquaInput } from "@/components/aqua"
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
    <AuthShell
      title="استعادة كلمة المرور"
      description="أدخل بريد حسابك وسنرسل رابطًا آمنًا صالحًا لمدة محدودة."
    >
      {success ? (
        <div className="aqua-auth-result">
          <AquaAlert
            variant="success"
            title="تم استلام الطلب"
            icon={<MailCheck />}
          >
            {success}
          </AquaAlert>

          <p className="aqua-auth-result__hint">
            افحص البريد الوارد والرسائل غير المرغوب فيها. لا نكشف ما إذا كان
            البريد مسجلًا لحماية الحسابات.
          </p>
        </div>
      ) : (
        <form className="aqua-auth-form" onSubmit={handleSubmit} noValidate>
          <AquaInput
            id="forgot-email"
            label="البريد الإلكتروني"
            dir="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="text-start"
            placeholder="name@example.com"
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
          />

          {error ? (
            <AquaAlert
              variant="danger"
              title="تعذر إرسال الرابط"
              icon={<CircleAlert />}
            >
              {error}
            </AquaAlert>
          ) : null}

          <AquaButton
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            loadingLabel="جاري الإرسال..."
            leadingIcon={<Send />}
          >
            إرسال رابط الاستعادة
          </AquaButton>
        </form>
      )}

      <div className="aqua-auth-secondary-action">
        <Link className="aqua-auth-link" href="/login">
          العودة إلى تسجيل الدخول
        </Link>
      </div>
    </AuthShell>
  )
}
