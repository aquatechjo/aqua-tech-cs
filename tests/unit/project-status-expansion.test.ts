import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const NEW_STATES = ['AT_RISK', 'IN_REVIEW', 'READY_FOR_DELIVERY'];

test('schema.prisma declares the three new project states exactly once each, additive to the existing enum', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const match = schema.match(/enum ProjectStatus \{([^}]+)\}/);
  assert.ok(match, 'ProjectStatus enum not found');
  const values = match![1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const state of NEW_STATES)
    assert.ok(values.includes(state), `${state} missing from ProjectStatus`);
  for (const original of [
    'PLANNING',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]) {
    assert.ok(values.includes(original), `existing state ${original} must not be removed`);
  }
});

test('the readiness-activation gate covers every new in-flight state, not just IN_PROGRESS', () => {
  const route = readFileSync('src/app/api/projects/[id]/route.ts', 'utf8').replace(/\s+/gu, ' ');
  const match = route.match(/\[\s*["']IN_PROGRESS["'][^\]]*\]\.includes\(data\.status\)/u);
  assert.ok(match, 'the readiness-activation gate array was not found in the expected shape');
  for (const state of NEW_STATES) {
    assert.match(
      match![0],
      new RegExp(state, 'u'),
      `${state} must be included in the readiness-activation gate array so it cannot be reached directly from PLANNING`,
    );
  }
});

test('projectStatusToWorkflowStatus maps every new state to ACTIVE, not the NOT_STARTED fallback', () => {
  const lib = readFileSync('src/lib/project-workflow-server.ts', 'utf8').replace(/\s+/gu, ' ');
  for (const state of NEW_STATES) {
    assert.match(
      lib,
      new RegExp(`status === ['"]${state}['"]\\) return ['"]ACTIVE['"]`, 'u'),
      `${state} must explicitly map to ACTIVE`,
    );
  }
});

test('the projects list page counts new in-flight states as active, so a flagged project never silently drops off the active count', () => {
  const page = readFileSync('src/app/dashboard/projects/page.tsx', 'utf8').replace(/\s+/gu, ' ');
  const match = page.match(/const activeProjectStatuses: ProjectStatus\[\] = \[([^\]]+)\]/);
  assert.ok(match, 'activeProjectStatuses array not found');
  for (const state of NEW_STATES) assert.match(match![1], new RegExp(state, 'u'));
});

test("the main dashboard's active-project count is not scoped to IN_PROGRESS alone any more", () => {
  const dashboard = readFileSync('src/app/dashboard/page.tsx', 'utf8').replace(/\s+/gu, ' ');
  assert.match(
    dashboard,
    /status: \{ in: \[[^\]]*AT_RISK[^\]]*\] \}/u,
    'the dashboard project count must include the new in-flight states',
  );
});

test('both project status label maps in the dashboard UI cover every new state', () => {
  const list = readFileSync('src/app/dashboard/projects/ProjectsClient.tsx', 'utf8');
  const detail = readFileSync('src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx', 'utf8');
  for (const state of NEW_STATES) {
    assert.match(
      list,
      new RegExp(`${state}:`, 'u'),
      `${state} missing a label in ProjectsClient.tsx`,
    );
    assert.match(
      detail,
      new RegExp(`${state}:`, 'u'),
      `${state} missing a label in ProjectExecutionClient.tsx`,
    );
  }
});

test('READY_FOR_DELIVERY is blocked while any deliverable is not ACCEPTED or CANCELLED, mirroring the closure gate', () => {
  const route = readFileSync('src/app/api/projects/[id]/route.ts', 'utf8').replace(/\s+/gu, ' ');
  const match = route.match(
    /data\.status === \s*["']READY_FOR_DELIVERY["'][^{]*\{[^]*?projectDeliverable\.count\(\{([^]*?)\}\);/u,
  );
  assert.ok(match, 'the READY_FOR_DELIVERY deliverable-acceptance gate was not found');
  assert.match(match![1], /notIn: \[["']ACCEPTED["'], ["']CANCELLED["']\]/u);
});

test('the project execution page surfaces open change requests and closure completion without a new project status', () => {
  const detail = readFileSync(
    'src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx',
    'utf8',
  ).replace(/\s+/gu, ' ');
  assert.match(
    detail,
    /openChangeRequestCount = changeRequests\.filter/u,
    'open change requests must be derived from the existing changeRequests list, not a stored project status',
  );
  assert.match(
    detail,
    /closureCompleted = closure\?\.status === ["']COMPLETED["']/u,
    'closure completion must be read from ProjectClosure.status, not a stored project status',
  );
});
