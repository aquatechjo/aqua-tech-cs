# BATCH UI-21 — Operational Header and Form Clarity

## Scope

- Compact the shared operational page header without changing the design-system showcase.
- Reset window scroll position after dashboard route changes.
- Replace Bootstrap's light invoice summary treatment with semantic Aqua Tech totals.

## Constraints

- No permission, data, API, or database behavior changes.
- Existing design tokens and shared semantic classes remain the source of truth.
- RTL, responsive behavior, and reduced-motion rules remain intact.

## Verification

- `npm run ds:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
