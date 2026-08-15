# UI-17A — Screenshot QA Corrections

## Goal

Correct the concrete visual issues found during the final desktop screenshot review without reopening the broader redesign.

## Corrections

- Prevent the shell's horizontal overflow rule from creating a scroll container that breaks the sticky topbar.
- Add a direct product-logo background fallback to the sidebar mark.
- Reduce sidebar section, link, icon, and header density for better 1080px-height coverage.
- Place Leads workspace actions inside the canonical page header.
- Translate visible Lead terminology and linked Service Request status values.
- Use the approved horizontal RTL arrow for opening an opportunity.

## Preserved behavior

- Navigation destinations, active-route resolution, drawer behavior, and keyboard focus remain unchanged.
- Lead filters, qualification, ownership, duplicate review, and opportunity conversion remain unchanged.
- Service Request synchronization remains unchanged.
- No API, Prisma, database, role, or workflow change is included.

## Verification

- Design System package synchronization.
- Shell and CRM source contracts.
- Lint, typecheck, unit tests, and production build through `npm run check`.
- Follow-up desktop screenshots after application.
