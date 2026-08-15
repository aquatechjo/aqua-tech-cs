# UI-16 — Notifications and Authentication Polish

## Goal

Align the notification center and internal authentication journey with the compact Aqua Tech CS visual language while preserving security and behavior.

## Scope

- Notification summary metrics, read states, timestamps, feed spacing, and empty state.
- Login, forgot-password, and reset-password layout density.
- Authentication story, form card, security notes, password guidance, and responsive behavior.
- Logical RTL accents and reduced-motion handling.

## Preserved behavior

- Notifications remain scoped to the authenticated user and company.
- Individual and bulk read operations remain unchanged.
- Notification grouping, ordering, and pagination remain server-owned.
- Login validation, password-reset token handling, password requirements, and session revocation remain unchanged.
- No API, Prisma schema, email delivery, session, or authorization change is included.

## Verification

- Design System package synchronization.
- UI-16 public and notification source contract coverage.
- Lint, typecheck, unit tests, and production build through `npm run check`.
