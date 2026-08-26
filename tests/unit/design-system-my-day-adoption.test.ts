import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync('src/app/dashboard/my-day/page.tsx', 'utf8');
const css = readFileSync('src/styles/aqua-my-day.css', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');
const roadmap = readFileSync('docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md', 'utf8');

test('AD-02 My Day uses canonical Aqua workflow components', () => {
  for (const component of [
    'AquaAlert',
    'AquaBadge',
    'AquaCard',
    'AquaDataPanel',
    'AquaEmptyState',
    'AquaLinkButton',
  ]) {
    assert.match(page, new RegExp(component, 'u'));
  }

  assert.doesNotMatch(page, /className="(?:row|col-|d-flex|aqua-card p-)/u);
  assert.doesNotMatch(page, /text-bg-(?:danger|warning|info|secondary)/u);
  assert.doesNotMatch(page, /className="progress/u);
});

test('AD-02 preserves assignment, bucket, blocker, and timezone behavior', () => {
  assert.match(page, /assignedToId: user\.id/u);
  assert.match(page, /employeeProfile:\s*\{\s*userId: user\.id/u);
  assert.match(page, /classifyMyDayDueDate\(task\.dueDate, now, timezone\)/u);
  assert.match(page, /status: "OPEN"/u);
  assert.match(page, /user\.company\.timezone \|\| "Asia\/Amman"/u);
  assert.match(page, /ar-JO-u-nu-latn/u);
  assert.match(page, /notIn: \["DONE", "CANCELLED", "ARCHIVED"\]/u);
});

test('My Day adoption CSS covers operational hierarchy and accessibility', () => {
  for (const selector of [
    '.aqua-my-day-hero',
    '.aqua-my-day-metrics',
    '.aqua-my-day-workspace',
    '.aqua-my-day-task-grid',
    '.aqua-my-day-progress',
    '.aqua-my-day-task__blockers',
  ]) {
    assert.match(css, new RegExp(selector.replaceAll('.', '\\.'), 'u'));
  }

  assert.match(css, /@media \(max-width: 767\.98px\)/u);
  assert.match(css, /@media \(max-width: 479\.98px\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /inset-inline-/u);
  assert.match(css, /inline-size/u);
  assert.match(layout, /@\/styles\/aqua-my-day\.css/u);
});

test('UI-08 gives My Day one final operational hierarchy', () => {
  for (const token of [
    'UI-08 — My Day final operational hierarchy',
    'min-block-size: 120px',
    'min-block-size: 88px',
    'font-size: var(--at-text-display)',
    'block-size: 5px',
    'grid-template-columns: minmax(0, 1fr) minmax(240px, 0.25fr)',
  ]) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});

test('AD-02 is recorded in the adoption roadmap', () => {
  assert.match(roadmap, /## AD-02 — My Day Adoption/u);
  assert.match(roadmap, /Status: \*\*implemented\*\*/u);
});
