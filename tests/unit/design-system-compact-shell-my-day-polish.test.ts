import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const myDayPage = readFileSync('src/app/dashboard/my-day/page.tsx', 'utf8');
const myDayCss = readFileSync('src/styles/aqua-my-day.css', 'utf8');
const shellCss = readFileSync('src/styles/aqua-operational-shell.css', 'utf8');
const cleanupCss = readFileSync('src/styles/aqua-density-cleanup.css', 'utf8');
const dashboardPage = readFileSync('src/app/dashboard/page.tsx', 'utf8');
const tasksPage = readFileSync('src/app/dashboard/tasks/TasksClient.tsx', 'utf8');
const layout = readFileSync('src/app/layout.tsx', 'utf8');
const topbar = readFileSync('src/components/layout/AquaTopbar.tsx', 'utf8');
const pageTitle = readFileSync('src/components/layout/AquaPageTitle.tsx', 'utf8');
const sidebar = readFileSync('src/components/layout/AquaSidebar.tsx', 'utf8');
const roadmap = readFileSync('docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md', 'utf8');

test('AD-02.1 compacts My Day hierarchy and action density', () => {
  assert.match(myDayPage, /padding="md" glow className="aqua-my-day-hero"/u);
  assert.match(myDayPage, /أولويات اليوم/u);
  assert.match(myDayPage, /size="sm"/u);
  assert.match(myDayPage, /className="aqua-my-day-hero__meta-line"/u);
  assert.match(myDayPage, /className="aqua-my-day-hero__context-heading"/u);
  assert.match(myDayPage, /compact\s+className="aqua-my-day-empty"/u);
  assert.doesNotMatch(myDayPage, /Personal operations/u);

  assert.match(myDayCss, /AD-02\.1 — Compact operational polish/u);
  assert.match(myDayCss, /font-size: clamp\(1\.55rem, 2\.45vw, 2\.25rem\)/u);
  assert.match(myDayCss, /min-block-size: 104px/u);
  assert.match(myDayCss, /min-block-size: 230px/u);
});

test('Aqua tech CS operational shell uses a compact topbar and sidebar', () => {
  for (const token of [
    'UI-02 unified operational shell',
    '--aqua-shell-sidebar-width: 256px',
    'min-block-size: 60px',
    '.aqua-sidebar .aqua-brand-lockup',
    '.aqua-topbar__avatar',
    '.aqua-page-heading__content',
    '.aqua-nav-link__icon',
    'prefers-reduced-motion',
  ]) {
    assert.match(shellCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }

  assert.match(topbar, /aqua-topbar__identity-copy/u);
  assert.match(topbar, /<UserRound \/>/u);
  assert.match(sidebar, /<AquaMark size="sm" showTagline=\{false\} \/>/u);
  assert.doesNotMatch(sidebar, /Aqua\.Tech Stack/u);
  assert.doesNotMatch(sidebar, /aqua-sidebar__company-heading/u);
  assert.match(pageTitle, /aqua-page-heading__content/u);
  assert.doesNotMatch(pageTitle, /aqua-page-heading__eyebrow/u);
});

test('compact shell remains product-level and responsive', () => {
  assert.match(layout, /@\/styles\/aqua-operational-shell\.css/u);
  assert.match(shellCss, /\.aqua-shell:not\(\.aqua-shell--showcase\)/u);
  assert.match(shellCss, /@media \(max-width: 767\.98px\)/u);
  assert.match(shellCss, /@media \(max-width: 479\.98px\)/u);
  assert.match(shellCss, /padding-inline-end/u);
  assert.match(shellCss, /inline-size/u);
});

test('UI-13A corrects operational density and RTL navigation', () => {
  assert.match(layout, /@\/styles\/aqua-density-cleanup\.css/u);
  assert.match(dashboardPage, /ArrowLeft/u);
  assert.doesNotMatch(dashboardPage, /ArrowUpLeft/u);
  assert.match(myDayPage, /ArrowLeft/u);
  assert.doesNotMatch(myDayPage, /ArrowUpLeft/u);
  assert.match(tasksPage, /stats\.totalPages > 1/u);
  assert.doesNotMatch(tasksPage, /Page \{stats\.currentPage\}/u);

  for (const token of [
    '--aqua-shell-sidebar-width: 232px',
    '.aqua-topbar__project-name',
    '.aqua-dashboard-workspace',
    '.aqua-my-day-workspace',
    '.aqua-tasks-page .aqua-filter-bar',
    'grid-template-columns: minmax(0, 1fr) 240px',
    'min-block-size: 170px',
    '@media (max-width: 1199.98px)',
    '@media (prefers-reduced-motion: reduce)',
  ]) {
    assert.match(cleanupCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});

test('AD-02.1 is recorded in adoption governance', () => {
  assert.match(roadmap, /## AD-02\.1 — Compact Shell and My Day Polish/u);
  assert.match(roadmap, /Status: \*\*implemented\*\*/u);
});
