import 'server-only';

import { ActivityAction } from '@/generated/prisma/enums';
import { logActivity } from '@/lib/activity';
import { prisma } from '@/lib/prisma';
import type { DomainEventInput } from '@/lib/domain-events';

type FeedbackActionRequiredPayload = Extract<
  DomainEventInput,
  { type: 'project_feedback.action_required' }
>['payload'];

/**
 * Creates the follow-up task for a feedback submission marked ACTION_REQUIRED.
 *
 * This is idempotent against re-dispatch: it re-reads the current
 * `followUpTaskId` from the database before creating anything, so running
 * this handler twice for the same feedback (e.g. after a retry) never
 * creates a duplicate task. This guard is required precisely because the
 * dispatcher only promises at-least-once processing, not exactly-once.
 */
export async function handleProjectFeedbackActionRequired(
  companyId: string,
  payload: FeedbackActionRequiredPayload,
) {
  const feedback = await prisma.projectFeedback.findUnique({
    where: { id: payload.feedbackId },
    select: { id: true, followUpTaskId: true },
  });
  if (!feedback || feedback.followUpTaskId) return;

  const task = await prisma.task.create({
    data: {
      companyId,
      createdById: payload.ownerId,
      assignedToId: payload.ownerId,
      title: `متابعة تقييم العميل — ${payload.projectName}`,
      description: 'مراجعة تقييم العميل والتواصل معه لمعالجة الملاحظات',
      priority: payload.priority,
      status: 'TODO',
      progress: 0,
      dueDate: new Date(payload.followUpDueAt),
      clientId: payload.clientId,
      projectId: payload.projectId,
      source: 'PROJECT_FEEDBACK',
      sourceRef: payload.feedbackId,
    },
  });

  await prisma.projectFeedback.update({
    where: { id: payload.feedbackId },
    data: { followUpTaskId: task.id },
  });

  await logActivity({
    companyId,
    userId: payload.ownerId,
    action: ActivityAction.PROJECT_FEEDBACK_TASK_CREATED,
    entityType: 'Task',
    entityId: task.id,
    message: `تم إنشاء مهمة متابعة تقييم مشروع ${payload.projectName}`,
    metadata: {
      projectId: payload.projectId,
      feedbackId: payload.feedbackId,
      taskId: task.id,
      source: 'DOMAIN_EVENT',
    },
  });
}
