export function paymentReceiptReference(paymentId: string) {
  return `RCPT-${paymentId.toUpperCase()}`
}

export function paymentReceiptAttemptInProgress(input: { preparedAt: Date | string | null; failedAt: Date | string | null; sentAt: Date | string | null; now?: Date }) {
  const now = input.now ?? new Date()
  const prepared = input.preparedAt ? new Date(input.preparedAt).getTime() : 0
  const completed = Math.max(input.failedAt ? new Date(input.failedAt).getTime() : 0, input.sentAt ? new Date(input.sentAt).getTime() : 0)
  return prepared > completed && now.getTime() - prepared < 15 * 60 * 1000
}

export function paymentReceiptDeliveryIssues(input: { status: string; clientName: string | null; clientEmail: string | null; preparedAt: Date | string | null; failedAt: Date | string | null; sentAt: Date | string | null; now?: Date }) {
  const issues: string[] = []
  if (input.status !== "POSTED") issues.push("لا يمكن إصدار إيصال لدفعة معكوسة")
  if (!input.clientName?.trim() || !input.clientEmail?.trim()) issues.push("اسم العميل وبريده مطلوبان لإرسال الإيصال")
  if (paymentReceiptAttemptInProgress(input)) issues.push("توجد محاولة إرسال إيصال قيد التنفيذ")
  return issues
}

export function safePaymentReceiptFailure(error: unknown) {
  const value = error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR"
  if (value.startsWith("RESEND_EMAIL_FAILED:")) return `EMAIL_PROVIDER_FAILED:${value.split(":")[1] ?? "unknown"}`
  if (value.includes("INVOICE_FROM")) return "INVOICE_FROM_NOT_CONFIGURED"
  if (value.includes("RESEND_API_KEY")) return "EMAIL_PROVIDER_NOT_CONFIGURED"
  return "PAYMENT_RECEIPT_DELIVERY_FAILED"
}
