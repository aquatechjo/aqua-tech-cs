# DS-06.1 — Showcase UX and Visual Polish

Status: **implemented**

## Purpose

DS-06 established the reusable package, starter, Showcase, visual contract, and governance layer. The first Showcase implementation proved the contracts but presented every example in one long operational page. DS-06.1 turns that technical proof into a clear internal reference without changing the underlying component model.

## Changes

- Add a focused full-width Dashboard mode for `/dashboard/design-system` while preserving access to the normal navigation drawer.
- Replace the long single-page Showcase with an accessible tabbed reference using one visible section at a time.
- Add a plain-language overview of Package, Package Sync, Product Starter, and Visual Contract.
- Rebuild foundation, actions, forms, workflows, public surfaces, and governance examples with a consistent information hierarchy.
- Clarify that release-readiness values represent the approved baseline rather than a live workstation status feed.
- Replace the full-height A4 page inside normal flow with a compact screen preview and a dedicated print action.
- Fix shared `AquaDetailList` contrast inside light `AquaSystemDocument` output.
- Preserve RTL, keyboard navigation, mobile horizontal navigation, reduced-motion behavior, and print output.
- Release the internal package patch as `0.6.1` because the document contrast correction changes generated package CSS.

## Release impact

- Package level: `patch`
- Channel: `internal`
- Consumer migration: none
- Public component props: unchanged
- CSS import order: unchanged

## Review surfaces

- Desktop RTL full-width Showcase.
- Tablet horizontal section navigation.
- Mobile single-column examples.
- Keyboard tab and arrow-key section navigation.
- Reduced motion.
- System document screen contrast and A4 print.
