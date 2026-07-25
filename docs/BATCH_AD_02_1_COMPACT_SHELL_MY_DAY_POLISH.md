# AD-02.1 — Compact Shell and My Day Polish

## Goal

Convert the first adoption screens from presentation-heavy layouts into a denser operational interface while preserving the canonical Aqua components and all business behavior.

## Scope

- Reduce My Day hero scale, copy length, metric height, and empty-state footprint.
- Separate action groups so buttons do not collide or compete with headings.
- Introduce a compact AquaFlow product-level shell override without changing the reusable Design System package.
- Reduce desktop sidebar width and navigation row height.
- Simplify the company card and technical footer.
- Compact the topbar page heading, account identity, and logout area.
- Preserve the mobile drawer, keyboard focus trap, RTL logical properties, and reduced-motion behavior.

## Non-goals

- No API, database, authentication, permission, task-classification, or timezone changes.
- No Design System package version bump; this is AquaFlow Product Personality and operational density adoption.
- No changes to the Design System Showcase focus layout.

## Validation

- Design System synchronization.
- Focused AD-02.1 shell and My Day tests.
- Full lint, typecheck, unit-test, and production-build gate.
- Desktop, mobile, RTL, overflow, and button-spacing review.
