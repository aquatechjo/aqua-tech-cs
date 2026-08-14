# UI-05 — Cards, Status Badges, and Page States

## Goal

Create one compact visual language for containers and system feedback without changing data or workflow behavior.

## Implemented

- Tightened canonical card padding, radius, shadow, and glow.
- Standardized badge dimensions and semantic status colors.
- Reduced skeleton-card height and empty-state visual weight.
- Unified loading, empty, error, success, and permission state hierarchy.
- Added dashboard-scoped compatibility for legacy badges and text-only empty cards.
- Preserved status meaning, accessibility announcements, RTL/LTR, and reduced motion.

## Verification

- Design System package synchronization.
- UI-05 primitive and workflow pattern contract coverage.
- Lint, typecheck, unit tests, visual baseline, and production build through `npm run check`.
