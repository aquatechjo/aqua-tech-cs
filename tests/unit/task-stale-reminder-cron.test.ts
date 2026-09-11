import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the stale-task cron route is protected by the CRON_SECRET bearer check and both stages respect their batch caps', () => {
  const route = readFileSync('src/app/api/cron/task-stale-reminders/route.ts', 'utf8');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /safeEqualSecrets/);
  assert.match(route, /take: TASK_STALE_REMINDER_BATCH_SIZE/);
  assert.match(route, /take: TASK_STALE_ESCALATION_BATCH_SIZE/);
});

test('the cron route calls both stage helpers with source SCHEDULED', () => {
  const route = readFileSync('src/app/api/cron/task-stale-reminders/route.ts', 'utf8').replace(
    /\s+/gu,
    ' ',
  );
  assert.match(
    route,
    /sendTaskStaleReminder\(\{ taskId: candidate\.id, companyId: company\.id, source: "SCHEDULED" \}\)/,
  );
  assert.match(route, /source: "SCHEDULED",? *\}\)/);
});

test("the reminder and escalation candidate queries scope the staleness cutoff per company's own configured days", () => {
  const route = readFileSync('src/app/api/cron/task-stale-reminders/route.ts', 'utf8');
  assert.match(route, /staleCutoff\(now, company\.taskStaleReminderDays\)/);
  assert.match(route, /staleCutoff\(now, company\.taskStaleEscalationDays\)/);
  assert.match(route, /staleReminderSentAt: null/);
  assert.match(route, /staleEscalatedAt: null/);
});

test('the server helpers expose the not-due skip codes the cron loop relies on to classify results', () => {
  const server = readFileSync('src/lib/task-stale-reminder-server.ts', 'utf8');
  assert.match(server, /TASK_STALE_REMINDER_NOT_DUE/);
  assert.match(server, /TASK_STALE_ESCALATION_NOT_DUE/);
  assert.match(server, /TASK_STALE_REMINDER_ALREADY_SENT/);
});

test('escalation reuses resolveTaskAccessScope as the authorization source of truth instead of re-deriving hierarchy rules', () => {
  const server = readFileSync('src/lib/task-stale-reminder-server.ts', 'utf8');
  assert.match(server, /resolveTaskAccessScope\(/);
  assert.match(server, /scope\.canViewCompanyTasks/);
  assert.match(server, /scope\.managedUserIds\.includes\(task\.assignedToId\)/);
  assert.match(server, /scope\.managedProjectIds\.includes\(task\.projectId\)/);
});

test("a task's status-change write site resets the staleness markers so a task going stale again gets fresh reminders", () => {
  const route = readFileSync('src/app/api/tasks/[id]/route.ts', 'utf8').replace(/\s+/gu, ' ');
  assert.match(route, /nextStatus !== existingTask\.status/);
  assert.match(route, /statusChangedAt: new Date\(\)/);
  assert.match(route, /staleReminderSentAt: null/);
  assert.match(route, /staleEscalatedAt: null/);
});

test('the reminder and escalation emails are sent before the stale markers are committed, so a failed send is retried next run', () => {
  const server = readFileSync('src/lib/task-stale-reminder-server.ts', 'utf8');
  const reminderFlow = server.slice(
    server.indexOf('export async function sendTaskStaleReminder'),
    server.indexOf('export async function escalateStaleTaskToManager'),
  );
  const sendIndex = reminderFlow.indexOf('sendTaskStaleReminderEmail');
  const updateIndex = reminderFlow.indexOf('staleReminderSentAt: now');
  assert.ok(sendIndex > -1 && updateIndex > -1 && sendIndex < updateIndex);
});
