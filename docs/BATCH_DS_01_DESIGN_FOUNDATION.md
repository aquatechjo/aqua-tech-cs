# Batch DS-01 — Aqua.Tech Design Foundation

## Purpose

Introduce the enforceable Aqua.Tech Design DNA foundation without redesigning feature pages or changing business logic.

## Included

- Approved 70/30 DNA model.
- Reference audit for Aqua.Tech website, Viresto, and AquaFlow.
- Canonical color, radius, spacing, motion, and typography tokens.
- Constrained AquaFlow product theme.
- CSS token layer connected to Bootstrap and existing AquaFlow variables.
- Product and brand data attributes on the root document.
- Reduced-motion and focus-visible foundation.
- Design-system rules added to `AGENTS.md`.
- Unit tests protecting fixed scales and product-theme boundaries.

## Deliberately deferred

- Full shared-component migration.
- Sidebar/topbar redesign.
- Authentication-page polish.
- Consolidation of the accumulated AquaFlow page CSS.
- Viresto token migration.
- Removal of Tailwind from legacy AquaFlow screens.

These belong to later roadmap stages so DS-01 remains low-risk.

## Verification

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
```
