export const TASK_STALE_REMINDER_BATCH_SIZE = 20;
export const TASK_STALE_ESCALATION_BATCH_SIZE = 20;

export const OPEN_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW'] as const;
export const TERMINAL_TASK_STATUSES = ['DONE', 'CANCELLED', 'ARCHIVED'] as const;

export function isTaskStale(statusChangedAt: Date, now: Date, thresholdDays: number) {
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return now.getTime() - statusChangedAt.getTime() >= thresholdMs;
}

export function staleDaysElapsed(statusChangedAt: Date, now: Date) {
  return Math.floor((now.getTime() - statusChangedAt.getTime()) / (24 * 60 * 60 * 1000));
}

export function staleCutoff(now: Date, thresholdDays: number) {
  return new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);
}
