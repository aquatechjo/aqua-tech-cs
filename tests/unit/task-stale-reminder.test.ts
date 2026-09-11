import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isTaskStale,
  staleCutoff,
  staleDaysElapsed,
  TASK_STALE_ESCALATION_BATCH_SIZE,
  TASK_STALE_REMINDER_BATCH_SIZE,
  TERMINAL_TASK_STATUSES,
} from '../../src/lib/task-stale-reminder';

test('isTaskStale compares elapsed time against the threshold, inclusive of the boundary', () => {
  const now = new Date('2026-08-10T00:00:00.000Z');
  const exactlyFiveDaysAgo = new Date('2026-08-05T00:00:00.000Z');
  const justUnderFiveDaysAgo = new Date('2026-08-05T00:00:01.000Z');

  assert.equal(isTaskStale(exactlyFiveDaysAgo, now, 5), true);
  assert.equal(isTaskStale(justUnderFiveDaysAgo, now, 5), false);
  assert.equal(isTaskStale(now, now, 5), false);
});

test('staleDaysElapsed floors to whole days', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');
  const statusChangedAt = new Date('2026-08-05T00:00:00.000Z');

  assert.equal(staleDaysElapsed(statusChangedAt, now), 5);
  assert.equal(staleDaysElapsed(now, now), 0);
});

test('staleCutoff returns the timestamp that isTaskStale/statusChangedAt comparisons should use', () => {
  const now = new Date('2026-08-10T00:00:00.000Z');
  const cutoff = staleCutoff(now, 5);

  assert.equal(cutoff.toISOString(), '2026-08-05T00:00:00.000Z');
  assert.equal(isTaskStale(cutoff, now, 5), true);
});

test('terminal task statuses are excluded from staleness tracking', () => {
  assert.deepEqual([...TERMINAL_TASK_STATUSES], ['DONE', 'CANCELLED', 'ARCHIVED']);
});

test('PAGINATION-style batch caps stay in place for both cron stages', () => {
  assert.equal(TASK_STALE_REMINDER_BATCH_SIZE, 20);
  assert.equal(TASK_STALE_ESCALATION_BATCH_SIZE, 20);
});

test('the company settings schema rejects an escalation threshold that is not longer than the reminder threshold', () => {
  const route = readFileSync('src/app/api/company/route.ts', 'utf8');
  assert.match(route, /taskStaleReminderDays: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(90\)/);
  assert.match(
    route,
    /taskStaleEscalationDays: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(90\)/,
  );
  assert.match(route, /taskStaleEscalationDays > data\.taskStaleReminderDays/);
});
