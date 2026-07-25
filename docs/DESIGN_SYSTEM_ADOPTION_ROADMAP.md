# Aqua.Tech Design System Adoption Roadmap

## DS-01 — Design Foundation

Status: **implemented**

- Approve the 70/30 DNA model.
- Add canonical tokens.
- Add constrained product-theme configuration.
- Add design-system instructions for coding agents.
- Connect AquaFlow to the token layer.
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
- Establish the dashboard as the first reference for AquaFlow-wide adoption.


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
- Compact the AquaFlow topbar, account identity, sidebar width, company card, and navigation rows.
- Keep the reusable Design System package unchanged by treating this as AquaFlow Product Personality density.
- Preserve mobile drawer accessibility, RTL logical layout, reduced motion, and all My Day business behavior.


## AD-02.2 — Operational Density and Dynamic States

Status: **implemented**

- Derive the My Day status badge from actual task volume and attention signals.
- Reduce the hero, metric cards, empty state, focus rail, and action density for daily operations.
- Localize and shorten account identity presentation in the topbar while preserving the full email as supporting context.
- Compress the AquaFlow sidebar to a 256px product-level density and hide nonessential stack metadata on typical laptop heights.
- Preserve task classification, assignment visibility, permissions, timezone behavior, mobile drawer accessibility, RTL, and reduced motion.

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
