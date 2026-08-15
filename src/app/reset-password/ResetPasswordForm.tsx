"use client"

import { Check, Circle, CircleAlert, KeyRound, ShieldCheck } from "lucide-react"
import { useState } from "react"

import {
  AquaAlert,
  AquaButton,
  AquaLinkButton,
} from "@/components/aqua"
import AuthShell from "@/components/auth/AuthShell"
import PasswordInput from "@/components/auth/PasswordInput"

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const hasMinimumLength = password.length >= 12
  const passwordsMatch = confirmation.length > 0 && password === confirmation

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!token) {
      setError("رابط إعادة التعيين غير مكتمل")
      return
    }

    if (!hasMinimumLength) {
      setError("كلمة المرور يجب أن تكون 12 حرفًا على الأقل")
      return
    }

    if (!passwordsMatch) {
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
    <AuthShell
      title="تعيين كلمة مرور جديدة"
      description="اختر كلمة مرور قوية ومختلفة عن كلمة المرور الحالية."
    >
      {!token ? (
        <div className="aqua-auth-result">
          <AquaAlert
            variant="danger"
            title="الرابط غير صالح"
            icon={<CircleAlert />}
          >
            رابط إعادة التعيين غير مكتمل. اطلب رابطًا جديدًا من صفحة
            الاستعادة.
          </AquaAlert>
          <AquaLinkButton href="/forgot-password" size="lg" fullWidth>
            طلب رابط استعادة جديد
          </AquaLinkButton>
        </div>
      ) : success ? (
        <div className="aqua-auth-result">
          <AquaAlert
            variant="success"
            title="تم تحديث كلمة المرور"
            icon={<ShieldCheck />}
          >
            تم إلغاء جميع الجلسات القديمة. سجّل الدخول مجددًا باستخدام كلمة
            المرور الجديدة.
          </AquaAlert>
          <AquaLinkButton href="/login" size="lg" fullWidth>
            تسجيل الدخول
          </AquaLinkButton>
        </div>
      ) : (
        <form className="aqua-auth-form aqua-auth-form--reset" onSubmit={handleSubmit} noValidate>
          <PasswordInput
            id="new-password"
            label="كلمة المرور الجديدة"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="استخدم 12 حرفًا على الأقل وتجنب كلمات المرور السابقة."
          />

          <PasswordInput
            id="confirm-password"
            label="تأكيد كلمة المرور"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />

          <div className="aqua-password-guidance" aria-live="polite">
            <p>متطلبات كلمة المرور</p>
            <ul>
              <li data-complete={hasMinimumLength}>
                {hasMinimumLength ? <Check /> : <Circle />}
                12 حرفًا على الأقل
              </li>
              <li data-complete={passwordsMatch}>
                {passwordsMatch ? <Check /> : <Circle />}
                تطابق الحقلين
              </li>
            </ul>
          </div>

          {error ? (
            <AquaAlert
              variant="danger"
              title="تعذر حفظ كلمة المرور"
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
            loadingLabel="جاري الحفظ..."
            leadingIcon={<KeyRound />}
          >
            حفظ كلمة المرور الجديدة
          </AquaButton>
        </form>
      )}
    </AuthShell>
  )
}
