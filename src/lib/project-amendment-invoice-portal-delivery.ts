import { z } from "zod"

export const invoicePortalDeliverySchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  recipientEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  validDays: z.number().int().min(1).max(30),
})

export function invoicePortalDeliveryIssues(input: {
  invoiceStatus: string
  invoiceIssuedAt: Date | string | null
  issueDate: Date | string | null
  dueDate: Date | string | null
  issueReference: string | null
  clientId: string | null
  projectClientId: string | null
}) {
  const issues: string[] = []
  if (!["ISSUED", "PARTIALLY_PAID", "PAID"].includes(input.invoiceStatus)) {
    issues.push("يمكن إرسال بوابة فاتورة صادرة وغير ملغاة فقط")
  }
  if (!input.invoiceIssuedAt || !input.issueDate || !input.dueDate || !input.issueReference?.trim()) {
    issues.push("أدلة إصدار فاتورة الملحق غير مكتملة")
  }
  if (!input.clientId || input.clientId !== input.projectClientId) {
    issues.push("ارتباط عميل الفاتورة لا يطابق المشروع")
  }
  return issues
}

export function portalDeliveryAttemptInProgress(input: {
  preparedAt: Date | string | null
  failedAt: Date | string | null
  sentAt: Date | string | null
  now?: Date
}) {
  if (!input.preparedAt || input.failedAt || input.sentAt) return false
  const preparedTime = new Date(input.preparedAt).getTime()
  const now = input.now ?? new Date()
  return Number.isFinite(preparedTime) && now.getTime() - preparedTime < 15 * 60 * 1000
}

export function safeInvoicePortalDeliveryFailure(error: unknown) {
  const value = error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR"
  if (value.startsWith("RESEND_EMAIL_FAILED:")) return `EMAIL_PROVIDER_FAILED:${value.split(":")[1] ?? "unknown"}`
  if (value.includes("INVOICE_FROM")) return "INVOICE_FROM_NOT_CONFIGURED"
  if (value.includes("RESEND_API_KEY")) return "EMAIL_PROVIDER_NOT_CONFIGURED"
  return "INVOICE_PORTAL_DELIVERY_FAILED"
}
