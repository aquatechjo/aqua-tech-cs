import "server-only"

import { buildPasswordResetEmail } from "@/lib/email-templates"

function requiredEmailEnv(name: "RESEND_API_KEY" | "PASSWORD_RESET_FROM") {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to send password reset emails`)
  }

  return value
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
  const email = buildPasswordResetEmail({ recipientName, resetUrl })

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`RESEND_EMAIL_FAILED:${response.status}:${body.slice(0, 500)}`)
  }
}
