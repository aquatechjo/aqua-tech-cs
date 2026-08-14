# UI-04 — Buttons, Forms, and Interaction States

## Goal

Create one compact and predictable interaction language across Aqua Tech CS without changing workflow behavior.

## Implemented

- Standardized small, medium, and large button heights and padding.
- Standardized input, select, and textarea density from semantic tokens.
- Added dashboard-scoped compatibility for existing Bootstrap button and field classes.
- Unified hover, active, focus-visible, disabled, readonly, success, danger, and loading presentation.
- Preserved existing handlers, validation, permissions, RTL/LTR, and reduced-motion behavior.

## Verification

- Design System package synchronization.
- UI-04 primitive contract coverage.
- Lint, typecheck, unit tests, visual baseline, and production build through `npm run check`.
