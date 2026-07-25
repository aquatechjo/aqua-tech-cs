"use client"

import { CircleAlert, LockKeyhole } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { AquaAlert, AquaButton, AquaInput } from "@/components/aqua"
import AuthShell from "@/components/auth/AuthShell"
import PasswordInput from "@/components/auth/PasswordInput"

export default function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <AuthShell
      title="تسجيل الدخول"
      description="استخدم حساب Aqua.Tech المصرّح له للوصول إلى مساحة التشغيل."
    >
      <form className="aqua-auth-form" onSubmit={handleSubmit} noValidate>
        <AquaInput
          id="login-email"
          label="البريد الإلكتروني"
          dir="ltr"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="text-start"
          placeholder="name@example.com"
          autoComplete="username"
          inputMode="email"
          autoFocus
          required
        />

        <PasswordInput
          id="login-password"
          label="كلمة المرور"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          labelAction={
            <Link className="aqua-auth-link" href="/forgot-password">
              نسيت كلمة المرور؟
            </Link>
          }
        />

        {error ? (
          <AquaAlert
            variant="danger"
            title="تعذر تسجيل الدخول"
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
          loadingLabel="جاري التحقق..."
          leadingIcon={<LockKeyhole />}
        >
          دخول النظام
        </AquaButton>
      </form>

      <p className="aqua-auth-security-note">
        يتم إنشاء جلسة مشفّرة لهذا الجهاز فقط بعد التحقق من بيانات الحساب.
      </p>
    </AuthShell>
  )
}
