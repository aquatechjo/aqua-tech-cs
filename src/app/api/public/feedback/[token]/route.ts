import { ActivityAction } from '@/generated/prisma/enums';
import { ApiError, err, handleApiError, ok } from '@/lib/api-response';
import { logActivity } from '@/lib/activity';
import { dispatchDomainEventNow, emitDomainEvent } from '@/lib/domain-events';
import {
  feedbackStatus,
  feedbackTaskPriority,
  isValidFeedbackPublicToken,
  publicFeedbackSubmissionSchema,
} from '@/lib/project-feedback';
import { loadPublicFeedbackForUpdate } from '@/lib/project-feedback-public-server';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  assertSameOrigin,
  getClientIp,
  hashOpaqueValue,
  readJsonBody,
} from '@/lib/request-security';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    if (!isValidFeedbackPublicToken(token))
      throw new ApiError('رابط التقييم غير متاح', 404, 'FEEDBACK_PUBLIC_LINK_UNAVAILABLE');
    const tokenHash = hashOpaqueValue(token);
    const ipAddress = getClientIp(request);
    await enforceRateLimit({
      namespace: 'public-project-feedback',
      identifier: `${tokenHash}:${ipAddress}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    const body = await readJsonBody(request, 12 * 1024);
    if ((body as { action?: string }).action === 'VIEW') {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const feedback = await loadPublicFeedbackForUpdate(tx, tokenHash, now);
        const firstView = !feedback.publicFirstViewedAt;
        await tx.projectFeedback.update({
          where: { id: feedback.id },
          data: {
            publicFirstViewedAt: feedback.publicFirstViewedAt ?? now,
            publicLastViewedAt: now,
            publicViewCount: { increment: 1 },
          },
        });
        if (firstView)
          await logActivity({
            db: tx,
            companyId: feedback.companyId,
            action: ActivityAction.PROJECT_FEEDBACK_LINK_VIEWED,
            entityType: 'ProjectFeedback',
            entityId: feedback.id,
            message: `فتح العميل رابط تقييم مشروع ${feedback.project.name}`,
            metadata: { projectId: feedback.projectId },
            ipAddress,
            userAgent: request.headers.get('user-agent'),
          });
      });
      return ok({ viewed: true });
    }
    const parsed = publicFeedbackSubmissionSchema.safeParse(body);
    if (!parsed.success)
      return err(
        parsed.error.issues[0]?.message ?? 'بيانات التقييم غير صحيحة',
        400,
        parsed.error.flatten(),
      );
    const now = new Date();
    const result = await prisma.$transaction(
      async (tx) => {
        const feedback = await loadPublicFeedbackForUpdate(tx, tokenHash, now);
        if (!feedback.ownerId)
          throw new ApiError('تعذر تعيين مسؤول المتابعة', 409, 'FEEDBACK_OWNER_REQUIRED');
        const status = feedbackStatus({ ...parsed.data, followUpRequired: false });
        const followUpDueAt =
          status === 'ACTION_REQUIRED' ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) : null;
        const updated = await tx.projectFeedback.update({
          where: { id: feedback.id },
          data: {
            status,
            npsScore: parsed.data.npsScore,
            satisfactionScore: parsed.data.satisfactionScore,
            feedbackSummary: parsed.data.feedbackSummary,
            testimonial: parsed.data.testimonial?.trim() || null,
            testimonialApproved: parsed.data.testimonialApproved,
            followUpRequired: status === 'ACTION_REQUIRED',
            followUpAction:
              status === 'ACTION_REQUIRED'
                ? 'مراجعة تقييم العميل والتواصل معه لمعالجة الملاحظات'
                : null,
            followUpDueAt,
            receivedAt: now,
            publicSubmittedAt: now,
            publicTokenHash: null,
            publicExpiresAt: null,
            reminderScheduleEnabled: false,
            reminderNextAt: null,
            reminderScheduleUpdatedAt: now,
          },
        });
        let pendingEventId: string | null = null;
        if (status === 'ACTION_REQUIRED') {
          const event = await emitDomainEvent(tx, feedback.companyId, {
            type: 'project_feedback.action_required',
            payload: {
              feedbackId: feedback.id,
              projectId: feedback.projectId,
              clientId: feedback.project.clientId,
              ownerId: feedback.ownerId,
              followUpDueAt: followUpDueAt!.toISOString(),
              priority: feedbackTaskPriority(parsed.data),
              projectName: feedback.project.name,
            },
          });
          pendingEventId = event.id;
        }
        await logActivity({
          db: tx,
          companyId: feedback.companyId,
          action: ActivityAction.PROJECT_FEEDBACK_CLIENT_SUBMITTED,
          entityType: 'ProjectFeedback',
          entityId: feedback.id,
          message: `أرسل العميل تقييم مشروع ${feedback.project.name}`,
          metadata: { projectId: feedback.projectId, status, npsScore: parsed.data.npsScore },
          ipAddress,
          userAgent: request.headers.get('user-agent'),
        });
        return { updated, pendingEventId };
      },
      { isolationLevel: 'Serializable' },
    );
    if (result.pendingEventId) await dispatchDomainEventNow(result.pendingEventId);
    return ok({ submitted: true, status: result.updated.status });
  } catch (error) {
    return handleApiError(error, 'PUBLIC_PROJECT_FEEDBACK_ERROR', 'تعذر إرسال التقييم');
  }
}
