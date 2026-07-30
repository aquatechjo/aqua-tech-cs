import "server-only"

import {
  buildPasswordResetEmail,
  buildProposalDeliveryEmail,
} from "@/lib/email-templates"

function requiredEmailEnv(
  name: "RESEND_API_KEY" | "PASSWORD_RESET_FROM" | "PROPOSAL_FROM",
) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to send transactional emails`)
  }

  return value
}

async function sendTransactionalEmail({
  from,
  to,
  subject,
  text,
  html,
}: {
  from: string
  to: string
  subject: string
  text: string
  html: string
}) {
  const apiKey = requiredEmailEnv("RESEND_API_KEY")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
    cache: "no-store",
  })

  const rawBody = await response.text()

  if (!response.ok) {
    throw new Error(
      `RESEND_EMAIL_FAILED:${response.status}:${rawBody.slice(0, 500)}`,
    )
  }

  try {
    const body = JSON.parse(rawBody) as { id?: string }
    return body.id ?? null
  } catch {
    return null
  }
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
  const from = requiredEmailEnv("PASSWORD_RESET_FROM")
  const email = buildPasswordResetEmail({ recipientName, resetUrl })

  await sendTransactionalEmail({
    from,
    to,
    ...email,
  })
}

export async function sendProposalDeliveryEmail({
  to,
  recipientName,
  proposalNumber,
  proposalTitle,
  proposalUrl,
  validUntilLabel,
}: {
  to: string
  recipientName: string
  proposalNumber: string
  proposalTitle: string
  proposalUrl: string
  validUntilLabel: string
}) {
  const from = requiredEmailEnv("PROPOSAL_FROM")
  const email = buildProposalDeliveryEmail({
    recipientName,
    proposalNumber,
    proposalTitle,
    proposalUrl,
    validUntilLabel,
  })

  return sendTransactionalEmail({
    from,
    to,
    ...email,
  })
}
