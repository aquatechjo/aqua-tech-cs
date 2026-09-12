import 'server-only';

import { ActivityAction } from '@/generated/prisma/enums';
import { ApiError } from '@/lib/api-response';
import { logActivity } from '@/lib/activity';
import { sendTaskStaleEscalationEmail, sendTaskStaleReminderEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { TERMINAL_TASK_STATUSES, isTaskStale, staleDaysElapsed } from '@/lib/task-stale-reminder';
import { resolveTaskAccessScope } from '@/lib/task-scope-server';

type ReminderSource = 'SCHEDULED';

function configuredPublicOrigin() {
  const configured = process.env.APP_URL?.trim();
  if (!configured)
    throw new ApiError('APP_URL مطلوب لتشغيل تذكيرات المهام', 500, 'PUBLIC_APP_URL_REQUIRED');
  const origin = new URL(configured).origin;
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost'))
    throw new ApiError('عنوان التطبيق العام غير آمن', 500, 'INVALID_PUBLIC_APP_URL');
  return origin;
}

export async function sendTaskStaleReminder({
  taskId,
  companyId,
  source,
  requestMeta = {},
}: {
  taskId: string;
  companyId: string;
  source: ReminderSource;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const now = new Date();

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      project: { select: { name: true } },
      company: { select: { taskStaleReminderDays: true } },
    },
  });
  if (!task) throw new ApiError('المهمة غير موجودة', 404, 'TASK_STALE_NOT_FOUND');
  if ((TERMINAL_TASK_STATUSES as readonly string[]).includes(task.status))
    throw new ApiError('المهمة منتهية ولا تحتاج تذكيرًا', 409, 'TASK_STALE_NOT_OPEN');
  if (!task.assignedTo)
    throw new ApiError('لا يوجد موظف مسؤول عن هذه المهمة', 409, 'TASK_STALE_NO_ASSIGNEE');
  if (task.staleReminderSentAt)
    throw new ApiError(
      'تم إرسال التذكير مسبقًا لهذا الركود',
      409,
      'TASK_STALE_REMINDER_ALREADY_SENT',
    );
  if (
    source === 'SCHEDULED' &&
    !isTaskStale(task.statusChangedAt, now, task.company.taskStaleReminderDays)
  )
    throw new ApiError('التذكير غير مستحق بعد', 409, 'TASK_STALE_REMINDER_NOT_DUE');

  const daysStale = staleDaysElapsed(task.statusChangedAt, now);
  const taskUrl = new URL(
    `/dashboard/tasks?taskId=${task.id}`,
    configuredPublicOrigin(),
  ).toString();

  try {
    await sendTaskStaleReminderEmail({
      to: task.assignedTo.email,
      recipientName: task.assignedTo.name,
      taskTitle: task.title,
      projectName: task.project?.name ?? null,
      daysStale,
      taskUrl,
    });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: task.id, staleReminderSentAt: null },
        data: { staleReminderSentAt: now, staleReminderCount: { increment: 1 } },
      });
      if (updated.count === 0) return;

      await tx.notification.create({
        data: {
          companyId,
          userId: task.assignedTo!.id,
          title: 'مهمة متوقفة بدون تحديث',
          message: `المهمة "${task.title}" لم يتغيّر وضعها منذ ${daysStale} يومًا. الرجاء تحديث حالتها.`,
          type: 'WARNING',
          entityType: 'Task',
          entityId: task.id,
        },
      });

      await logActivity({
        db: tx,
        companyId,
        userId: null,
        action: ActivityAction.TASK_STALE_REMINDER_SENT,
        entityType: 'Task',
        entityId: task.id,
        message: `تم إرسال تذكير مهمة متوقفة: ${task.title}`,
        metadata: { daysStale, source },
        ...requestMeta,
      });
    });
  } catch (error) {
    const reason = (error instanceof Error ? error.message : 'UNKNOWN_EMAIL_FAILURE').slice(0, 500);
    await logActivity({
      companyId,
      userId: null,
      action: ActivityAction.TASK_STALE_REMINDER_FAILED,
      entityType: 'Task',
      entityId: task.id,
      message: `فشل إرسال تذكير مهمة متوقفة: ${task.title}`,
      metadata: { daysStale, failureReason: reason, source },
      ...requestMeta,
    });
    throw new ApiError('تعذر إرسال تذكير المهمة', 502, 'TASK_STALE_REMINDER_FAILED');
  }

  return { sent: true };
}

export async function escalateStaleTaskToManager({
  companyId,
  managerId,
  taskIds,
  source,
  requestMeta = {},
}: {
  companyId: string;
  managerId: string;
  taskIds: string[];
  source: ReminderSource;
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null };
}) {
  const now = new Date();

  const manager = await prisma.user.findFirst({
    where: { id: managerId, companyId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!manager)
    throw new ApiError('المدير غير موجود أو غير فعال', 404, 'TASK_STALE_MANAGER_NOT_FOUND');

  const eligibleTasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      companyId,
      status: { notIn: [...TERMINAL_TASK_STATUSES] },
      staleEscalatedAt: null,
    },
    select: {
      id: true,
      title: true,
      statusChangedAt: true,
      assignedTo: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  if (source === 'SCHEDULED' && eligibleTasks.length === 0)
    throw new ApiError('لا توجد مهام مستحقة للتصعيد', 409, 'TASK_STALE_ESCALATION_NOT_DUE');

  const taskListUrl = new URL('/dashboard/tasks?stale=true', configuredPublicOrigin()).toString();

  try {
    await sendTaskStaleEscalationEmail({
      to: manager.email,
      recipientName: manager.name,
      staleTasks: eligibleTasks.map((task) => ({
        title: task.title,
        assignedToName: task.assignedTo?.name ?? '—',
        daysStale: staleDaysElapsed(task.statusChangedAt, now),
        projectName: task.project?.name ?? null,
      })),
      taskListUrl,
    });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.task.updateMany({
        where: { id: { in: eligibleTasks.map((task) => task.id) }, staleEscalatedAt: null },
        data: { staleEscalatedAt: now },
      });
      if (updated.count === 0) return;

      await tx.notification.create({
        data: {
          companyId,
          userId: manager.id,
          title: `لديك ${updated.count} مهمة متوقفة في فريقك`,
          message: eligibleTasks
            .map(
              (task) =>
                `- ${task.title} (${staleDaysElapsed(task.statusChangedAt, now)} يوم بدون تحديث)`,
            )
            .join('\n'),
          type: 'WARNING',
          entityType: 'TaskStaleDigest',
          entityId: manager.id,
        },
      });

      await logActivity({
        db: tx,
        companyId,
        userId: null,
        action: ActivityAction.TASK_STALE_ESCALATED,
        entityType: 'User',
        entityId: manager.id,
        message: `تم تصعيد ${updated.count} مهمة متوقفة للمدير ${manager.name}`,
        metadata: { taskIds: eligibleTasks.map((task) => task.id), count: updated.count, source },
        ...requestMeta,
      });
    });
  } catch (error) {
    const reason = (error instanceof Error ? error.message : 'UNKNOWN_EMAIL_FAILURE').slice(0, 500);
    await logActivity({
      companyId,
      userId: null,
      action: ActivityAction.TASK_STALE_REMINDER_FAILED,
      entityType: 'User',
      entityId: manager.id,
      message: `فشل تصعيد المهام المتوقفة للمدير ${manager.name}`,
      metadata: {
        stage: 'escalation',
        taskIds: eligibleTasks.map((task) => task.id),
        failureReason: reason,
        source,
      },
      ...requestMeta,
    });
    throw new ApiError('تعذر تصعيد المهام المتوقفة', 502, 'TASK_STALE_ESCALATION_FAILED');
  }

  return { escalated: true, count: eligibleTasks.length };
}

/**
 * Groups a batch of stale, unescalated tasks by manager, reusing
 * resolveTaskAccessScope as the authorization source of truth: a candidate
 * manager (direct manager, department/team lead, or project lead) only
 * receives a task in their group if resolveTaskAccessScope(manager) would
 * itself grant them visibility into that task's assignee/project. This
 * guarantees escalation never reaches someone who couldn't already see the
 * task through the normal task-scope rules.
 */
export async function resolveStaleTaskManagers({
  companyId,
  tasks,
}: {
  companyId: string;
  tasks: Array<{ id: string; assignedToId: string; projectId: string | null }>;
}): Promise<Map<string, string[]>> {
  const assigneeUserIds = [...new Set(tasks.map((task) => task.assignedToId))];
  const projectIds = [
    ...new Set(tasks.flatMap((task) => (task.projectId ? [task.projectId] : []))),
  ];

  const assigneeProfiles = await prisma.employeeProfile.findMany({
    where: { companyId, userId: { in: assigneeUserIds } },
    select: {
      userId: true,
      managerId: true,
      department: { select: { leadProfileId: true } },
      teamMemberships: { select: { team: { select: { leadProfileId: true } } } },
    },
  });

  const candidateManagerProfileIds = new Set<string>();
  const assigneeToManagerProfileIds = new Map<string, Set<string>>();
  for (const profile of assigneeProfiles) {
    const managerProfileIds = new Set<string>();
    if (profile.managerId) managerProfileIds.add(profile.managerId);
    if (profile.department?.leadProfileId) managerProfileIds.add(profile.department.leadProfileId);
    for (const membership of profile.teamMemberships) {
      if (membership.team.leadProfileId) managerProfileIds.add(membership.team.leadProfileId);
    }
    for (const id of managerProfileIds) candidateManagerProfileIds.add(id);
    assigneeToManagerProfileIds.set(profile.userId, managerProfileIds);
  }

  const projectLeads =
    projectIds.length > 0
      ? await prisma.projectMember.findMany({
          where: {
            companyId,
            projectId: { in: projectIds },
            role: { in: ['PROJECT_LEAD', 'MANAGER'] },
          },
          select: { projectId: true, employeeProfileId: true },
        })
      : [];
  for (const lead of projectLeads) candidateManagerProfileIds.add(lead.employeeProfileId);

  if (candidateManagerProfileIds.size === 0) return new Map();

  const managerProfiles = await prisma.employeeProfile.findMany({
    where: { id: { in: [...candidateManagerProfileIds] }, user: { isActive: true } },
    select: { id: true, userId: true, user: { select: { id: true, role: true } } },
  });
  const managerProfileIdToUser = new Map(
    managerProfiles.map((profile) => [profile.id, profile.user]),
  );

  const groups = new Map<string, string[]>();
  for (const task of tasks) {
    const managerProfileIds = new Set<string>(
      assigneeToManagerProfileIds.get(task.assignedToId) ?? [],
    );
    if (task.projectId) {
      for (const lead of projectLeads) {
        if (lead.projectId === task.projectId) managerProfileIds.add(lead.employeeProfileId);
      }
    }

    for (const managerProfileId of managerProfileIds) {
      const managerUser = managerProfileIdToUser.get(managerProfileId);
      if (!managerUser || managerUser.id === task.assignedToId) continue;

      const scope = await resolveTaskAccessScope({
        id: managerUser.id,
        companyId,
        role: managerUser.role,
      });
      const canSeeTask =
        scope.canViewCompanyTasks ||
        scope.managedUserIds.includes(task.assignedToId) ||
        (task.projectId !== null && scope.managedProjectIds.includes(task.projectId));
      if (!canSeeTask) continue;

      const existing = groups.get(managerUser.id) ?? [];
      existing.push(task.id);
      groups.set(managerUser.id, existing);
    }
  }

  return groups;
}
