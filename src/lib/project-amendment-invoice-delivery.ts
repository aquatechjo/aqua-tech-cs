import { z } from "zod"

export const amendmentInvoiceDeliverySchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  recipientEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  deliveryReference: z.string().trim().min(3).max(200),
})

export function amendmentInvoiceDeliveryIssues({
  invoiceStatus,
  invoiceIssuedAt,
  deliverySentAt,
  clientId,
  projectClientId,
}: {
  invoiceStatus: string
  invoiceIssuedAt?: Date | string | null
  deliverySentAt?: Date | string | null
  clientId?: string | null
  projectClientId?: string | null
}) {
  const issues: string[] = []
  if (invoiceStatus !== "ISSUED") issues.push("يمكن إرسال فاتورة صادرة فقط")
  if (!invoiceIssuedAt) issues.push("بيانات إصدار فاتورة الملحق غير مكتملة")
  if (deliverySentAt) issues.push("تم إرسال فاتورة الملحق بنجاح مسبقًا")
  if (!clientId || clientId !== projectClientId) {
    issues.push("ارتباط عميل الفاتورة لا يطابق المشروع")
  }
  return issues
}

export function safeInvoiceDeliveryFailure(error: unknown) {
  const value = error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR"
  if (value.startsWith("RESEND_EMAIL_FAILED:")) {
    const status = value.split(":")[1] ?? "unknown"
    return `EMAIL_PROVIDER_FAILED:${status}`
  }
  if (value.includes("INVOICE_FROM")) return "INVOICE_FROM_NOT_CONFIGURED"
  if (value.includes("RESEND_API_KEY")) return "EMAIL_PROVIDER_NOT_CONFIGURED"
  return "EMAIL_DELIVERY_FAILED"
}

export function invoiceDeliveryAttemptInProgress({
  preparedAt,
  failedAt,
  now = new Date(),
}: {
  preparedAt?: Date | string | null
  failedAt?: Date | string | null
  now?: Date
}) {
  if (!preparedAt || failedAt) return false
  const preparedTime = new Date(preparedAt).getTime()
  return Number.isFinite(preparedTime) && now.getTime() - preparedTime < 15 * 60 * 1000
}
