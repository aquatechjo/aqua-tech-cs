import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { INVOICE_REMINDER_BATCH_SIZE } from "@/lib/project-amendment-invoice-reminder"
import { prisma } from "@/lib/prisma"
import { safeEqualSecrets } from "@/lib/request-security"
import { sendScheduledInvoiceReminder } from "@/lib/scheduled-invoice-reminder-server"

export const dynamic = "force-dynamic"

async function run(request: Request) {
  const expected = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get("authorization")
  const received = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!expected || !received || !safeEqualSecrets(received, expected)) throw new ApiError("غير مصرح بتشغيل تذكيرات الفواتير", 401, "INVALID_CRON_SECRET")
  const now = new Date()
  const candidates = await prisma.projectContractAmendment.findMany({ where: { invoiceReminderScheduleEnabled: true, invoiceReminderNextAt: { lte: now } }, orderBy: [{ invoiceReminderNextAt: "asc" }, { id: "asc" }], take: INVOICE_REMINDER_BATCH_SIZE, select: { id: true, companyId: true, company: { select: { timezone: true } } } })
  const results: Array<{ amendmentId: string; status: "sent" | "skipped" | "failed"; code?: string }> = []
  for (const candidate of candidates) {
    try { await sendScheduledInvoiceReminder({ amendmentId: candidate.id, companyId: candidate.companyId, timezone: candidate.company.timezone }); results.push({ amendmentId: candidate.id, status: "sent" }) }
    catch (error) { const code = error instanceof ApiError ? error.code : "UNKNOWN_ERROR"; results.push({ amendmentId: candidate.id, status: code === "INVOICE_REMINDER_NOT_DUE" ? "skipped" : "failed", code }) }
  }
  return ok({ processed: results.length, sent: results.filter((item) => item.status === "sent").length, results })
}

export const GET = withApiHandler("SCHEDULED_INVOICE_REMINDERS_ERROR", run, "تعذر تشغيل تذكيرات الفواتير المجدولة")
