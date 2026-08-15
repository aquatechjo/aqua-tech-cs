# UI-17 — Cross-Workspace Visual Closure

## Goal

Close the visual-polish phase with a bounded audit of confirmed cross-workspace inconsistencies rather than another redesign layer.

## Corrections

- Remove duplicated English `Page x / y` metadata from Clients, Leads, Discovery, Pricing, Proposals, and Service Requests while retaining canonical pagination.
- Translate visible company and employee fallback values in Settings and Team.
- Replace directional arrows inside HR and Time date ranges with a direction-neutral range separator.
- Normalize the remaining oversized full-width primary actions in Service Requests and Organization.
- Add a source-level closure contract preventing these regressions.

## Preserved behavior

- Pagination state, item ranges, filters, query parameters, and page links remain unchanged.
- Company, employee, HR, time, organization, CRM, discovery, pricing, and proposal logic remain unchanged.
- No API, database, Prisma, permission, route, or workflow change is included.

## Verification

- Design System package synchronization.
- UI-17 visual closure source contract.
- Lint, typecheck, unit tests, and production build through `npm run check`.
