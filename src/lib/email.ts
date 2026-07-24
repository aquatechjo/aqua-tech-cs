import "server-only"

import { PASSWORD_RESET_TTL_MINUTES } from "@/lib/password-reset"

function requiredEmailEnv(name: "RESEND_API_KEY" | "PASSWORD_RESET_FROM") {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to send password reset emails`)
  }

  return value
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

export async function sendPasswordResetEmail({
  to,
  recipientName,
  resetUrl,
}: {
  to: string
  recipientName: string
  resetUrl: string
}) {
  const apiKey = requiredEmailEnv("RESEND_API_KEY")
  const from = requiredEmailEnv("PASSWORD_RESET_FROM")
  const safeName = escapeHtml(recipientName)
  const safeResetUrl = escapeHtml(resetUrl)

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "إعادة تعيين كلمة مرور AquaFlow",
      text: [
        `مرحبًا ${recipientName}،`,
        "",
        "تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في AquaFlow.",
        `استخدم الرابط التالي خلال ${PASSWORD_RESET_TTL_MINUTES} دقيقة:`,
        resetUrl,
        "",
        "إذا لم تطلب هذا التغيير، تجاهل الرسالة ولن تتغير كلمة المرور.",
      ].join("\n"),
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#0f172a;max-width:620px;margin:auto">
          <h1 style="font-size:24px;margin-bottom:16px">إعادة تعيين كلمة المرور</h1>
          <p>مرحبًا ${safeName}،</p>
          <p>تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في AquaFlow.</p>
          <p>
            <a href="${safeResetUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:700">
              تعيين كلمة مرور جديدة
            </a>
          </p>
          <p>الرابط صالح لمدة ${PASSWORD_RESET_TTL_MINUTES} دقيقة ويُستخدم مرة واحدة فقط.</p>
          <p style="color:#64748b">إذا لم تطلب هذا التغيير، تجاهل الرسالة ولن تتغير كلمة المرور.</p>
          <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0" />
          <p style="font-size:13px;color:#64748b">AquaFlow — Aqua.Tech Internal System</p>
        </div>
      `,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`RESEND_EMAIL_FAILED:${response.status}:${body.slice(0, 500)}`)
  }
}
