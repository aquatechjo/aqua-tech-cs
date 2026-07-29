# Aqua.Tech Design System Adoption Roadmap

## DS-01 — Design Foundation

Status: **implemented**

- Approve the 70/30 DNA model.
- Add canonical tokens.
- Add constrained product-theme configuration.
- Add design-system instructions for coding agents.
- Connect Aqua Tech CS to the token layer.
- Preserve current functionality and visual behavior.
- Add unit checks for theme boundaries.

## DS-02 — Bootstrap Primitives

Status: **implemented**

- Migrate AquaButton, AquaInput, AquaCard, AquaBadge, and AquaMark to semantic Bootstrap/CSS classes.
- Add select, textarea, alert, and toast contracts.
- Remove Tailwind dependency from shared primitives.
- Add component-state examples.

## DS-03 — Application Shell

Status: **implemented**

- Standardize sidebar, topbar, page shell, page header, breadcrumbs, and mobile navigation.
- Define compact/comfortable density modes.
- Fix logical RTL/LTR behavior.
- Add responsive navigation tests.

## DS-04 — Data and Workflow Patterns

Status: **implemented**

- Standardize form sections, filters, data panels, responsive tables, pagination, modals, confirmation dialogs, tabs, and detail lists.
- Define scroll and stacked mobile table strategies.
- Add loading, empty, error, success, and permission-denied page states.
- Add accessible modal focus management, Escape handling, body scroll locking, and reduced-motion behavior.
- Introduce `aqua-patterns.css` as the structured workflow layer above primitives and the application shell.
- Migrate the Clients CRM page as the first canonical implementation.

## DS-05 — Auth and Public Surfaces

Status: **implemented**

- Rebuild login, forgot-password, and reset-password using canonical components.
- Define marketing-to-product continuity through `aqua-public.css`.
- Separate transactional email templates from provider transport.
- Migrate password-reset email to the branded reusable template layer.
- Add the canonical AquaSystemDocument browser and print shell.
- Add public-surface, email-safety, and document-contract unit checks.

## DS-06 — Starter, Package, Showcase, and Governance

Status: **implemented**

- Extract `@aqua-tech/design-system` as a synchronized internal package containing components, contracts, and ordered CSS layers.
- Add a guarded in-product component Showcase at `/dashboard/design-system`.
- Add the Aqua.Tech Next.js product starter generator with constrained theme inputs.
- Add deterministic visual-contract regression for contracts, CSS, and Showcase structure.
- Add package synchronization checks so committed package files cannot drift from source.
- Add semantic versioning, release channels, migration notes, and release-gate rules.
- Keep browser screenshot review as a required human release gate before external stable publication.

## DS-06.1 — Showcase UX and Visual Polish

Status: **implemented**

- Give the Design System Showcase a dedicated full-width focus mode.
- Replace the long page with accessible section navigation and one focused panel at a time.
- Explain Package, Package Sync, Product Starter, and Visual Contract in plain language.
- Reorganize component examples, forms, workflows, and governance by intent.
- Clarify baseline status versus live command execution.
- Add a compact document preview and dedicated print flow.
- Fix light-document detail-list contrast and release package patch `0.6.1`.

## AD-01 — Dashboard Overview Adoption

Status: **implemented**

- Migrate the operational dashboard overview to canonical Aqua components.
- Preserve existing metrics, activity visibility, and role permissions.
- Add responsive metric, activity, and quick-action layouts.
- Use the company timezone with Latin digits for operational timestamps.
- Establish the dashboard as the first reference for Aqua Tech CS-wide adoption.


## AD-02 — My Day Adoption

Status: **implemented**

- Migrate My Day to canonical Aqua cards, panels, alerts, badges, and link actions.
- Preserve assignment visibility, due-date buckets, blockers, progress, and company timezone logic.
- Establish a daily focus hierarchy for overdue, today, upcoming, unscheduled, and later work.
- Add a responsive focus rail and direct operational links to tasks, projects, and time.
- Use Arabic Jordan date formatting with Latin digits and logical RTL styling.


## AD-02.1 — Compact Shell and My Day Polish

Status: **implemented**

- Reduce presentation-scale headings and spacing on the daily operational surface.
- Prevent action buttons from competing with or colliding with page content.
- Compact the Aqua Tech CS topbar, account identity, sidebar width, company card, and navigation rows.
- Keep the reusable Design System package unchanged by treating this as Aqua Tech CS Product Personality density.
- Preserve mobile drawer accessibility, RTL logical layout, reduced motion, and all My Day business behavior.


## AD-02.2 — Operational Density and Dynamic States

Status: **implemented**

- Derive the My Day status badge from actual task volume and attention signals.
- Reduce the hero, metric cards, empty state, focus rail, and action density for daily operations.
- Localize and shorten account identity presentation in the topbar while preserving the full email as supporting context.
- Compress the Aqua Tech CS sidebar to a 256px product-level density and hide nonessential stack metadata on typical laptop heights.
- Preserve task classification, assignment visibility, permissions, timezone behavior, mobile drawer accessibility, RTL, and reduced motion.

## AD-02.3 — Desktop Topbar Simplification

Status: **implemented**

- Keep the desktop topbar limited to the project name, current page, global language entry, account identity, and logout.
- Display the approved project label exactly as `Aqua tech CS`.
- Remove breadcrumbs, descriptive subtitles, and the duplicated internal-system line from the topbar.
- Route the language control to the existing company language setting until full bilingual page dictionaries are implemented.
- Preserve the mobile navigation trigger, keyboard focus, RTL/LTR-safe layout, and compact operational density.

## AD-02.4 — Product Identity and Sidebar Brand

Status: **implemented**

- Rename every user-facing product reference to `Aqua tech CS`.
- Keep the visible product identity as `Aqua tech CS`; technical identifiers move to `aqua-tech-cs` through the separate ID-01 compatibility migration.
- Replace the generated initials mark with the official Aqua.Tech logo while preserving a theme fallback.
- Reduce the sidebar identity to the official logo and project name only.
- Remove the `Internal OS` badge and internal-environment description from the sidebar.
- Apply the same identity to authentication, metadata, transactional email, reports, and the browser icon.

## AD-02.5 — Dashboard Operations

Status: **implemented**

- Replace the presentation-scale dashboard hero with a compact daily operations summary.
- Remove duplicated product identity, simulated connection state, team count, active sessions, and the oversized quick-start panel.
- Prioritize overdue tasks, today's due work, active projects, and unread notifications.
- Add a role-aware action queue for blockers, unscheduled work, service requests, sales follow-ups, overdue invoices, timesheets, leave requests, and expense approvals.
- Add a focused task list ordered by urgency, due bucket, priority, and open blockers.
- Preserve company timezone handling, Latin digits, activity permissions, RTL/LTR behavior, reduced motion, and safe responsive fallback.

## AD-02.6 — Employee Dashboard Polish

Status: **implemented**

- Keep the dashboard employee-first: overdue work, today's due work, in-progress tasks, and active projects.
- Scope project counts to the employee's memberships and assigned work unless the role can manage company projects.
- Remove the duplicated attention-path badge, notifications shortcut, and notifications metric from the dashboard overview.
- Keep operational approval queues role-aware and display only items with an active count.
- Retain the activity summary as the latest five records only, showing the actor and readable message without raw action codes.
- Remove English panel kickers and reduce summary, metric, empty-state, activity, and responsive mobile density.

## AD-03 — Tasks Adoption

Status: **implemented**

- Rebuild Tasks as an employee-first operational surface using canonical data panels, filters, stacked tables, modals, badges, buttons, alerts, and confirmation dialogs.
- Replace the permanently open task form with a focused create/edit modal and keep the main surface centered on overdue, due-today, in-progress, and blocked work.
- Enforce task visibility on the server across the page, collection API, and detail API using personal, managed-team/project, and company scopes.
- Keep employees isolated to assigned, created, or participated work; let team, department, and project managers see only the people and projects they manage; preserve company-wide visibility for authorized task-management roles.
- Limit assignee, project, client, and automation-source controls to the user’s real scope instead of hiding only the final action.
- Add urgency filters, Latin-digit timezone-aware due dates, progress, blockers, next-step actions, mobile stacked rows, RTL-safe layout, reduced motion, and canonical archive confirmation.

## AD-04 — Projects Adoption

Status: **implemented**

- Rebuild Projects as a compact operational surface using canonical filters, data panels, stacked tables, badges, modals, date fields, alerts, and confirmation dialogs.
- Enforce company, managed-team/project, and personal project visibility in server pages and every project read API.
- Scope task progress, completion, and blocker summaries to the tasks each user may actually see instead of leaking company-wide execution totals.
- Keep project metadata creation and editing with company project-management roles while project leads and project managers retain execution controls for members, phases, and tasks.
- Restrict project-member and task-participant employee selection on both the page and API to the user’s real assignment scope.
- Hide project budgets from roles without finance-read permission and keep operational dates in the company timezone with Latin digits.
- Add responsive project overview and execution pages with logical RTL/LTR layout, reduced motion, accessible empty states, and canonical confirmation flows.

## AD-04.2 — Project Workflow Foundation

Status: **implemented**

- Require an active workflow template when a company project-management role creates a project.
- Resolve the workflow automatically when converting service requests and won sales opportunities, with a safe default fallback.
- Clone a versioned, independent workflow snapshot into operational phases, tasks, dependencies, approval definitions, role expectations, and automation rules.
- Keep the existing phase and task models as the execution engine so workflow-generated and manually adjusted work share one permission model.
- Backfill existing projects with a generic workflow link without replacing their established execution records.
- Synchronize project and workflow status, and write durable creation, start, and completion events for later notification, email, and n8n dispatchers.
- Show the selected workflow and generated counts in project creation, project lists, and the scoped execution view.

## AD-04.4 — Project Modal Viewport Safety

Status: **implemented**

- Keep the project create/edit modal inside the available viewport.
- Scroll only the modal body when the project form is taller than the screen.
- Keep the title, close control, cancel action, and save action visible.
- Preserve the shared modal focus trap, body scroll lock, RTL/LTR layout, mobile sheet behavior, and reduced-motion contract.

## ID-01 — Technical Identity Migration

Status: **implemented**

- Adopt `aqua-tech-cs` as the canonical application package, product-theme ID, DOM product selector, session-cookie prefix, and website-intake header prefix.
- Rename the canonical product theme export to `aquaTechCsTheme`.
- Keep the deprecated `aquaFlowTheme` export and legacy CSS selector temporarily so existing Design System consumers do not break.
- Accept the legacy `aquaflow_session` cookie while issuing only `aqua-tech-cs_session` on new logins, and clear both names on logout.
- Prefer `X-Aqua-Tech-CS-Intake-Secret` while accepting `X-AquaFlow-Intake-Secret` during the integration migration window.
- Preserve the old seed marker when detecting an existing welcome notification so reseeding does not create duplicates.
- Treat the local folder, future repository, deployment project, and integration names as `aqua-tech-cs`; database table names and historical batch records are unchanged.

## CRM-02 — Leads Management Adoption

Status: **implemented**

- Add a dedicated Leads qualification surface within the canonical application shell.
- Use the DS-04 filter, data-panel, stacked-table, pagination, modal, alert, badge, and confirmation patterns.
- Keep read and mutation capabilities aligned with server-side sales permissions.
- Support manual Lead intake, ownership, qualification, next actions, source and priority tracking, duplicate review, and conversion to sales opportunities.
- Preserve Service Request synchronization without overwriting the original intake message.
- Keep Latin-digit operational dates, logical RTL/LTR layout, responsive table behavior, accessible confirmations, and reduced-motion coverage through canonical components.

## DS-07 — Viresto Adoption

- Map Viresto tokens to the shared contract.
- Preserve teal/copper product personality.
- Replace duplicated primitives gradually.
- Keep legal-domain UX where it is genuinely domain-specific.

## Release gate for every stage

- Lint
- Typecheck
- Unit tests
- Production build
- Keyboard test
- RTL/LTR review
- Mobile review
- Contrast review
- No unapproved hard-coded product colors in shared primitives
