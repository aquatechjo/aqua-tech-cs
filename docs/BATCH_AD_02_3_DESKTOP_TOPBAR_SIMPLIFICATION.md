# AD-02.3 — Desktop Topbar Simplification

## Purpose

Reduce the AquaFlow application topbar to the controls and context needed during desktop operations.

## Scope

- Show the exact project label `Aqua tech CS`.
- Show only the title of the current page; remove breadcrumbs and route subtitles from the topbar.
- Keep the system-language entry, account identity, and logout action together.
- Connect the language entry to the existing company-language setting.
- Preserve the mobile navigation trigger and the existing account/logout behavior.

## Translation boundary

The current application stores a company language preference, but its page copy is still Arabic-only. This batch does not claim full English localization. Complete bilingual dictionaries and page-level translation remain a separate adoption batch.

## Quality gates

- Design System package synchronization.
- ESLint and TypeScript.
- Unit tests including the topbar composition contract.
- Production build.
- Desktop RTL, focus-visible, spacing, and contrast review.
