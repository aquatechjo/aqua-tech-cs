import { ApiError, ok, withApiHandler } from "@/lib/api-response"
import { FEEDBACK_REMINDER_BATCH_SIZE } from "@/lib/project-feedback-reminder"
import { sendGovernedFeedbackReminder } from "@/lib/project-feedback-reminder-server"
import { prisma } from "@/lib/prisma"
import { safeEqualSecrets } from "@/lib/request-security"

export const dynamic = "force-dynamic"

async function run(request: Request) {
  const expected = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get("authorization")
  const received = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!expected || !received || !safeEqualSecrets(received, expected)) throw new ApiError("غير مصرح بتشغيل عامل التذكيرات", 401, "INVALID_CRON_SECRET")

  const now = new Date()
  const candidates = await prisma.projectFeedback.findMany({
    where: {
      reminderScheduleEnabled: true,
      reminderNextAt: { lte: now },
      receivedAt: null,
      publicSubmittedAt: null,
    },
    orderBy: [{ reminderNextAt: "asc" }, { id: "asc" }],
    take: FEEDBACK_REMINDER_BATCH_SIZE,
    select: {
      projectId: true,
      companyId: true,
      project: { select: { name: true } },
      company: { select: { timezone: true } },
    },
  })

  const results: Array<{ projectId: string; status: "sent" | "skipped" | "failed"; code?: string }> = []
  for (const candidate of candidates) {
    try {
      await sendGovernedFeedbackReminder({
        projectId: candidate.projectId,
        companyId: candidate.companyId,
        projectName: candidate.project.name,
        timezone: candidate.company.timezone,
        source: "SCHEDULED",
      })
      results.push({ projectId: candidate.projectId, status: "sent" })
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "UNKNOWN_ERROR"
      results.push({ projectId: candidate.projectId, status: code === "FEEDBACK_REMINDER_NOT_DUE" ? "skipped" : "failed", code })
    }
  }

  return ok({ processed: results.length, sent: results.filter((item) => item.status === "sent").length, results })
}

export const GET = withApiHandler("SCHEDULED_FEEDBACK_REMINDERS_ERROR", run, "تعذر تشغيل تذكيرات التقييم المجدولة")
