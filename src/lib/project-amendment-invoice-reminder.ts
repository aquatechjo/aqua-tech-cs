import { z } from "zod"

export const INVOICE_REMINDER_COOLDOWN_MS = 72 * 60 * 60 * 1000
export const INVOICE_REMINDER_MAX_COUNT = 3
export const INVOICE_REMINDER_PREPARATION_TIMEOUT_MS = 15 * 60 * 1000
export const INVOICE_REMINDER_BATCH_SIZE = 20

export const invoiceReminderScheduleSchema = z.object({ enabled: z.boolean() })

export function nextInvoiceReminderAt(lastContactAt: Date, now = new Date()) {
  return new Date(Math.max(lastContactAt.getTime(), now.getTime()) + INVOICE_REMINDER_COOLDOWN_MS)
}

export function invoiceReminderIssues(input: {
  invoiceStatus: string
  amountOutstanding: number
  portalTokenHash: string | null
  portalExpiresAt: Date | string | null
  portalRevokedAt: Date | string | null
  deliverySentAt: Date | string | null
  reminderSentAt: Date | string | null
  reminderCount: number
  reminderPreparedAt: Date | string | null
  reminderFailedAt: Date | string | null
  now?: Date
}) {
  const now = input.now ?? new Date()
  const issues: string[] = []
  if (!["ISSUED", "PARTIALLY_PAID"].includes(input.invoiceStatus) || input.amountOutstanding <= 0) issues.push("لا يمكن تذكير فاتورة مدفوعة أو غير قابلة للتحصيل")
  if (!input.portalTokenHash || !input.portalExpiresAt || input.portalRevokedAt || new Date(input.portalExpiresAt) <= now) issues.push("يجب أن تكون بوابة الفاتورة فعالة قبل إرسال التذكير")
  if (!input.deliverySentAt) issues.push("يجب إرسال بوابة الفاتورة بنجاح قبل التذكير")
  if (input.reminderCount >= INVOICE_REMINDER_MAX_COUNT) issues.push("تم بلوغ الحد الأقصى لتذكيرات الدفع")
  const lastContact = input.reminderSentAt ?? input.deliverySentAt
  if (lastContact && now.getTime() - new Date(lastContact).getTime() < INVOICE_REMINDER_COOLDOWN_MS) issues.push("يجب الانتظار 72 ساعة بين رسائل الدفع")
  if (input.reminderPreparedAt && !input.reminderFailedAt && now.getTime() - new Date(input.reminderPreparedAt).getTime() < INVOICE_REMINDER_PREPARATION_TIMEOUT_MS) issues.push("توجد محاولة تذكير قيد الإرسال")
  return issues
}
