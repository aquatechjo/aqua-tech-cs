# Batch DS-02 — Bootstrap Primitives

**Status:** Implemented  
**Depends on:** DS-01 Design Foundation

## Objective

Turn the approved Aqua.Tech Design DNA tokens into reusable Bootstrap-first React primitives without redesigning application pages yet.

## Delivered

### Migrated primitives

- `AquaButton`
- `AquaInput`
- `AquaCard`
- `AquaBadge`
- `AquaMark`
- `AquaBackground`
- `AquaTechPattern`

These components now use semantic `aqua-*` classes instead of product-specific Tailwind class recipes.

### New primitives

- `AquaSelect`
- `AquaTextarea`
- `AquaAlert`
- `AquaToastViewport` and `aquaToast`
- `AquaSpinner`
- `AquaSkeleton`
- `AquaEmptyState`

### Shared contracts

`src/design-system/component-contracts.ts` defines the allowed variants and sizes. Product pages may select from these contracts, but may not invent unapproved shared variants.

### State coverage

The primitive layer includes:

- default
- hover
- focus-visible
- active
- disabled
- loading
- invalid/error
- responsive behavior
- RTL/LTR logical layout
- reduced-motion behavior

## Compatibility

- Existing default imports remain valid.
- Existing `variant`, `size`, `glow`, `label`, and `error` APIs remain supported where they existed.
- Legacy page-level Bootstrap classes remain in place and will be migrated gradually in later batches.
- Tailwind remains available to legacy application pages; DS-02 only removes Tailwind recipes from the canonical shared primitives.

## Verification gate

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Also review keyboard focus, disabled/loading behavior, mobile layout, RTL, and contrast before the batch is committed.
