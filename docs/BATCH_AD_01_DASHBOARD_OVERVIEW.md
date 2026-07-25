# AD-01 — Dashboard Overview Adoption

## Purpose

AD-01 starts the product-adoption phase after the shared Aqua.Tech Design System foundation was completed. The dashboard overview is the first operational page migrated as a full reference because it combines hierarchy, metrics, navigation, system state, activity history, responsive behavior, and role-aware content.

## Scope

- Rebuild `/dashboard` using canonical Aqua components instead of legacy Bootstrap recipe classes.
- Preserve the existing database queries and access-control behavior.
- Present team, session, and notification metrics with one consistent card contract.
- Add a clear operational hero with product identity, current role, timezone, and pending-notification state.
- Add role-aware quick links to daily work, tasks, projects, and sales.
- Rebuild the recent activity feed using `AquaDataPanel` and `AquaEmptyState`.
- Format activity timestamps using the company timezone and Latin digits.
- Add a product-specific `aqua-dashboard.css` adoption layer without expanding the shared package API.
- Add tests that prevent the dashboard from regressing to legacy utility-class recipes.

## Non-goals

- No schema or migration changes.
- No new API routes.
- No new shared Design System component.
- No change to activity visibility or role permissions.
- No additional dashboard analytics queries beyond the current metrics.

## Acceptance gates

- `npm run ds:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build`
- Visual review at desktop, tablet, and mobile widths.
- Confirm company timezone and Latin-digit timestamps.
- Confirm the sales quick link remains permission-aware.
