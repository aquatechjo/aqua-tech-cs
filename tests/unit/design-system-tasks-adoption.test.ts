import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/app/dashboard/tasks/page.tsx', 'utf8');
const client = readFileSync('src/app/dashboard/tasks/TasksClient.tsx', 'utf8');
const css = readFileSync('src/app/dashboard/tasks/Tasks.module.css', 'utf8');
const workforceCss = readFileSync('src/styles/aqua-workforce.css', 'utf8');
const timeClient = readFileSync('src/app/dashboard/time/TimeCapacityClient.tsx', 'utf8');
const teamClient = readFileSync('src/app/dashboard/team/TeamClient.tsx', 'utf8');
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8');
const listApi = readFileSync('src/app/api/tasks/route.ts', 'utf8');
const detailApi = readFileSync('src/app/api/tasks/[id]/route.ts', 'utf8');
const scopeServer = readFileSync('src/lib/task-scope-server.ts', 'utf8');
const roadmap = readFileSync('docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md', 'utf8');

test('AD-03 Tasks uses canonical data and workflow components', () => {
  for (const component of [
    'AquaAlert',
    'AquaBadge',
    'AquaButton',
    'AquaConfirmDialog',
    'AquaDataPanel',
    'AquaFilterBar',
    'AquaModal',
    'AquaTable',
    'AquaTableStateRow',
  ]) {
    assert.match(client, new RegExp(component, 'u'));
  }

  assert.doesNotMatch(client, /AquaPageHeader/u);
  assert.doesNotMatch(client, /aqua-crm-form-card/u);
  assert.doesNotMatch(client, /text-bg-(?:danger|warning|info|secondary)/u);
  assert.match(client, /mobileStrategy="stack"/u);
  assert.match(client, /data-label=/u);
  assert.match(client, /AquaConfirmDialog/u);
});

test('AD-03 Tasks enforces personal team and company data scopes on the server', () => {
  assert.match(page, /resolveTaskAccessScope\(user\)/u);
  assert.match(page, /buildTaskVisibilityWhere\(scope\)/u);
  assert.match(page, /canEditTask\(user/u);
  assert.match(page, /scope\.dataScope !== "personal"/u);
  assert.match(page, /ar-JO-u-nu-latn/u);
  assert.match(page, /businessDate\(now, timeZone\)/u);
  assert.match(scopeServer, /reports:/u);
  assert.match(scopeServer, /ledTeams:/u);
  assert.match(scopeServer, /ledDepartments:/u);
  assert.match(scopeServer, /projectMemberships:/u);
  assert.match(listApi, /buildTaskVisibilityWhere\(scope\)/u);
  assert.match(detailApi, /buildTaskVisibilityWhere\(scope\)/u);
  assert.match(listApi, /canAssignTaskTo\(scope/u);
  assert.match(detailApi, /canAssignTaskTo\(scope/u);
});

test('AD-03 Tasks keeps employee UI focused and management controls scoped', () => {
  assert.match(client, /scope\.showAssignee/u);
  assert.match(client, /scope\.canAssignOthers/u);
  assert.match(client, /scope\.canManageSources/u);
  assert.match(client, /العمل المطلوب منك في مكان واحد/u);
  assert.match(client, /متأخرة/u);
  assert.match(client, /مستحقة اليوم/u);
  assert.match(client, /قيد التنفيذ/u);
  assert.match(client, /متعطلة/u);
  assert.match(client, /إرسال للمراجعة/u);
  assert.match(client, /افتح يومي/u);
});

test('AD-03 Tasks styling covers responsive logical and reduced-motion behavior', () => {
  for (const contract of [
    '.page',
    '.intro',
    '.metrics',
    '.metric',
    '.progressTrack',
    '.personalAssignment',
    '@media (max-width: 991.98px)',
    '@media (max-width: 767.98px)',
    '@media (max-width: 575.98px)',
    '@media (prefers-reduced-motion: reduce)',
    'inline-size',
    'block-size',
  ]) {
    assert.match(css, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});

test('UI-12 applies one Tasks, Time, and Team workspace contract', () => {
  assert.match(rootLayout, /@\/styles\/aqua-workforce\.css/u);
  assert.match(client, /aqua-tasks-page/u);
  assert.match(timeClient, /aqua-time-page/u);
  assert.match(timeClient, /aqua-workforce-metrics/u);
  assert.match(timeClient, /aqua-time-entry-grid/u);
  assert.match(teamClient, /aqua-team-page/u);
  assert.match(teamClient, /aqua-team-editor/u);
  assert.match(teamClient, /aqua-team-directory/u);

  for (const contract of [
    '.aqua-tasks-page',
    '.aqua-time-page',
    '.aqua-team-page',
    '.aqua-workforce-actions',
    '.aqua-workforce-metric',
    '.aqua-time-entry-grid',
    'inset-inline-end',
    'min-inline-size',
    '@media (max-width: 767.98px)',
    '@media (prefers-reduced-motion: reduce)',
  ]) {
    assert.match(workforceCss, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});

test('AD-03 is recorded in the adoption roadmap', () => {
  assert.match(roadmap, /## AD-03 — Tasks Adoption/u);
  assert.match(roadmap, /Status: \*\*implemented\*\*/u);
});
