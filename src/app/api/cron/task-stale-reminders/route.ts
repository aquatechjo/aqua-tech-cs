import { ApiError, ok, withApiHandler } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { safeEqualSecrets } from '@/lib/request-security';
import {
  escalateStaleTaskToManager,
  resolveStaleTaskManagers,
  sendTaskStaleReminder,
} from '@/lib/task-stale-reminder-server';
import {
  TASK_STALE_ESCALATION_BATCH_SIZE,
  TASK_STALE_REMINDER_BATCH_SIZE,
  TERMINAL_TASK_STATUSES,
  staleCutoff,
} from '@/lib/task-stale-reminder';

export const dynamic = 'force-dynamic';

type ReminderResult = { taskId: string; status: 'sent' | 'skipped' | 'failed'; code?: string };
type EscalationResult = {
  managerId: string;
  taskIds: string[];
  status: 'escalated' | 'skipped' | 'failed';
  code?: string;
};

async function run(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  const received = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!expected || !received || !safeEqualSecrets(received, expected))
    throw new ApiError('غير مصرح بتشغيل عامل تذكيرات المهام المتوقفة', 401, 'INVALID_CRON_SECRET');

  const now = new Date();

  const companies = await prisma.company.findMany({
    where: { tasks: { some: { status: { notIn: [...TERMINAL_TASK_STATUSES] } } } },
    select: { id: true, taskStaleReminderDays: true, taskStaleEscalationDays: true },
  });

  const reminderResults: ReminderResult[] = [];
  const escalationResults: EscalationResult[] = [];

  for (const company of companies) {
    const reminderCandidates = await prisma.task.findMany({
      where: {
        companyId: company.id,
        status: { notIn: [...TERMINAL_TASK_STATUSES] },
        statusChangedAt: { lte: staleCutoff(now, company.taskStaleReminderDays) },
        staleReminderSentAt: null,
        assignedToId: { not: null },
      },
      orderBy: [{ statusChangedAt: 'asc' }, { id: 'asc' }],
      take: TASK_STALE_REMINDER_BATCH_SIZE,
      select: { id: true },
    });

    for (const candidate of reminderCandidates) {
      try {
        await sendTaskStaleReminder({
          taskId: candidate.id,
          companyId: company.id,
          source: 'SCHEDULED',
        });
        reminderResults.push({ taskId: candidate.id, status: 'sent' });
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
        reminderResults.push({
          taskId: candidate.id,
          status: code === 'TASK_STALE_REMINDER_NOT_DUE' ? 'skipped' : 'failed',
          code,
        });
      }
    }

    const escalationCandidates = await prisma.task.findMany({
      where: {
        companyId: company.id,
        status: { notIn: [...TERMINAL_TASK_STATUSES] },
        statusChangedAt: { lte: staleCutoff(now, company.taskStaleEscalationDays) },
        staleEscalatedAt: null,
        assignedToId: { not: null },
      },
      orderBy: [{ statusChangedAt: 'asc' }, { id: 'asc' }],
      take: TASK_STALE_ESCALATION_BATCH_SIZE,
      select: { id: true, assignedToId: true, projectId: true },
    });

    if (escalationCandidates.length > 0) {
      const managerGroups = await resolveStaleTaskManagers({
        companyId: company.id,
        tasks: escalationCandidates.map((task) => ({
          id: task.id,
          assignedToId: task.assignedToId!,
          projectId: task.projectId,
        })),
      });

      for (const [managerId, taskIds] of managerGroups) {
        try {
          await escalateStaleTaskToManager({
            companyId: company.id,
            managerId,
            taskIds,
            source: 'SCHEDULED',
          });
          escalationResults.push({ managerId, taskIds, status: 'escalated' });
        } catch (error) {
          const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
          escalationResults.push({
            managerId,
            taskIds,
            status: code === 'TASK_STALE_ESCALATION_NOT_DUE' ? 'skipped' : 'failed',
            code,
          });
        }
      }
    }
  }

  return ok({
    processed: reminderResults.length + escalationResults.length,
    reminderSent: reminderResults.filter((item) => item.status === 'sent').length,
    escalated: escalationResults.filter((item) => item.status === 'escalated').length,
    results: { reminders: reminderResults, escalations: escalationResults },
  });
}

export const GET = withApiHandler(
  'SCHEDULED_TASK_STALE_REMINDERS_ERROR',
  run,
  'تعذر تشغيل تذكيرات المهام المتوقفة المجدولة',
);
