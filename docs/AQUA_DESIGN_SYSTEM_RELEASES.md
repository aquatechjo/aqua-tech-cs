# Aqua.Tech Design System Releases

## Package

- Name: `@aqua-tech/design-system`
- Current internal version: `0.14.0`
- Canonical source: Aqua Tech CS
- Generated package: `packages/aqua-design-system`

## 0.14.0 — internal

Release level: **minor**

- Tightened canonical table scrollbars, sticky headers, row feedback, action cells, and state-row spacing.
- Tightened line and pill tabs, count indicators, pagination links, and result summaries.
- Added dashboard-scoped compatibility for legacy Bootstrap tables and responsive table wrappers.
- Consumer migration: none required; table mobile strategies, tab contracts, and pagination URLs remain unchanged.
- Visual review surfaces: CRM tables, finance tables, workflow tabs, pagination, RTL, keyboard focus, and mobile table strategies.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.13.0 — internal

Release level: **minor**

- Added the backwards-compatible `dismissible` modal contract.
- Prevented confirm dialogs from closing through the backdrop, Escape, or close button while an action is loading.
- Tightened modal dimensions, header/body/footer spacing, backdrop, alerts, and toast presentation.
- Consumer migration: none required; modals remain dismissible by default.
- Visual review surfaces: task and project modals, destructive confirmations, alerts, toast feedback, keyboard focus, and reduced motion.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.12.0 — internal

Release level: **minor**

- Tightened canonical card padding, radius, shadow, skeleton, and empty-state density.
- Standardized compact badge dimensions and semantic status presentation.
- Added dashboard-scoped compatibility for legacy Bootstrap badges and text-only empty cards.
- Tightened loading, empty, error, success, and permission page-state layouts.
- Consumer migration: none required; existing component contracts and legacy status markup remain compatible.
- Visual review surfaces: dashboards, status badges, loading skeletons, empty results, errors, RTL, and reduced motion.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.11.0 — internal

Release level: **minor**

- Standardized compact operational button and field heights across small, medium, and large sizes.
- Added a scoped compatibility layer for legacy Bootstrap buttons and controls inside the Aqua Tech CS dashboard.
- Unified hover, active, focus-visible, disabled, readonly, success, and danger presentation.
- Consumer migration: none required; canonical Aqua components and existing Bootstrap class usage remain compatible.
- Visual review surfaces: operational forms, inline table actions, workflow actions, disabled controls, RTL, and reduced motion.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.10.0 — internal

Release level: **minor**

- Added a compact operational page-header hierarchy with optional action and metadata regions.
- Replaced the duplicate in-page product brand box with a small workflow-context label.
- Tightened shared form, filter, data-panel, and table spacing using semantic typography and spacing tokens.
- Consumer migration: none required; existing page-header props remain compatible and new regions are optional.
- Visual review surfaces: dashboard page headers, filters, data panels, compact tables, RTL, and mobile stacking.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.9.0 — internal

Release level: **minor**

- Added the canonical operational type-size, line-height, and weight scales.
- Connected Bootstrap body, headings, controls, and the Aqua Tech CS compact shell to semantic typography tokens.
- Removed the legacy Arial body override and duplicate operating-system color-scheme override.
- Consumer migration: none required; the new typography tokens are additive.
- Visual review surfaces: desktop RTL shell, page headings, navigation, form controls, and compact account identity.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.8.0 — internal

Release level: **minor**

- Added `aquaTechCsTheme` as the canonical internal-system product theme.
- Changed the canonical theme ID and CSS selector to `aqua-tech-cs`.
- Kept the deprecated `aquaFlowTheme` export and legacy selector as compatibility aliases.
- Updated generated package source attribution from AquaFlow to Aqua Tech CS.
- Consumer migration: replace `aquaFlowTheme` imports with `aquaTechCsTheme`; the old export remains functional during the compatibility window.
- Visual review surfaces: root product selector, shell, authentication, dashboard, system documents, and generated package examples.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.7.0 — internal

Release level: **minor**

- Added optional product-logo support to `AquaProductTheme`.
- Added the backwards-compatible `showTagline` control to `AquaMark`.
- Updated the validating product identity to `Aqua tech CS`.
- Preserved the initials fallback for consumers that do not provide `logoSrc`.
- Consumer migration: none required; existing themes and `AquaMark` calls remain valid.
- Visual review surfaces: desktop RTL shell, authentication, dashboard hero, system document, and browser icon.
- Quality gate: package sync, lint, typecheck, unit tests, visual contract, and production build.

## 0.6.1 — internal

Release level: **patch**

- Reorganized the in-product Showcase into a focused, accessible section reference.
- Added full-width Showcase shell behavior while retaining the navigation drawer.
- Clarified approved-baseline status versus live quality-gate execution.
- Added compact system-document screen preview and dedicated print flow.
- Fixed `AquaDetailList` contrast inside light `AquaSystemDocument` output.
- No consumer migration and no public prop changes.

## Semantic versioning

### Patch

Use for fixes that do not change a public prop, contract value, CSS selector meaning, or required consumer behavior.

Examples:

- Correct focus visibility.
- Fix RTL logical spacing.
- Correct a print rule without changing document structure.

### Minor

Use for backwards-compatible additions.

Examples:

- Add a component.
- Add an approved variant.
- Add an optional prop.
- Add a token without changing existing token semantics.

### Major

Use for breaking changes.

Examples:

- Remove or rename a component or prop.
- Change CSS import order.
- Change a token's meaning.
- Change default interaction behavior.
- Require a consumer migration.

## Release channels

- `internal`: Aqua Tech CS is the validating consumer.
- `candidate`: at least one second Aqua.Tech product validates the package.
- `stable`: approved for normal use across Aqua.Tech products.

## Required release record

Every release must document:

- Version and channel.
- Added, changed, deprecated, and removed contracts.
- Consumer migration notes.
- Visual review surfaces.
- Quality-gate result.

## Update discipline

Do not manually edit generated files under `packages/aqua-design-system/src` or `packages/aqua-design-system/styles`. Edit canonical source, run `npm run ds:sync`, then review the generated diff.

Do not run `npm run ds:visual:update` to silence a failure. Update the baseline only when the visual change is deliberate and reviewed.
