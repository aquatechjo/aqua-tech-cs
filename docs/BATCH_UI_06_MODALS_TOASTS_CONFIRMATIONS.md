# UI-06 — Modals, Toasts, and Confirmations

## Goal

Create one compact, accessible feedback and confirmation language without changing workflow outcomes.

## Implemented

- Tightened modal widths, radius, shadow, backdrop, and header/body/footer spacing.
- Tightened alert and toast density.
- Added the backwards-compatible `dismissible` modal contract.
- Prevented backdrop, Escape, and close-button dismissal while a confirmation action is loading.
- Preserved focus trapping, focus restoration, body scroll lock, RTL/LTR, and reduced motion.

## Follow-up

- Page-specific browser-native confirmations remain explicitly tracked for later component adoption.

## Verification

- Design System package synchronization.
- UI-06 modal and primitive contract coverage.
- Lint, typecheck, unit tests, visual baseline, and production build through `npm run check`.
