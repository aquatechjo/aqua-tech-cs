import { ok, withApiHandler } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { sendGovernedFeedbackReminder } from "@/lib/project-feedback-reminder-server"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { assertSameOrigin } from "@/lib/request-security"

async function remind(request: Request, context: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request)
  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const result = await sendGovernedFeedbackReminder({
    projectId,
    companyId: user.companyId,
    projectName: project.name,
    timezone: user.company.timezone,
    userId: user.id,
    source: "MANUAL",
    requestMeta: await getRequestMeta(),
  })
  return ok(result)
}

export const POST = withApiHandler("PROJECT_FEEDBACK_REMINDER_ERROR", remind, "تعذر إرسال تذكير التقييم")
