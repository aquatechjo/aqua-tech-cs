# UI-15 — Settings, Team, and Activity Workspace Polish

## Goal

Give the administration workspaces one compact, desktop-first visual rhythm without changing permissions, company data, employee identity, or audit behavior.

## Scope

- Company settings form and live identity summary.
- Team account editor and employee directory.
- Activity summary metrics, log table, and pagination surface.
- Logical RTL accents, responsive containment, and reduced-motion handling.

## Preserved behavior

- Only OWNER and ADMIN roles can update company settings or manage accounts.
- Owner email, password, role, and activation protections remain unchanged.
- Access roles remain separate from departments, job roles, and employment profiles.
- Activity counts, tenant scoping, ordering, labels, and pagination remain server-owned.
- No API, Prisma schema, migration, or business workflow changes are included.

## Verification

- Design System package synchronization.
- UI-15 source contract coverage.
- Lint, typecheck, unit tests, and production build through `npm run check`.
