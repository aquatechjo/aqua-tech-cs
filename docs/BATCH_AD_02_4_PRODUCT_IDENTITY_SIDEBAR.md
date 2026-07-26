# AD-02.4 — Product Identity and Sidebar Brand

## Purpose

Apply the approved user-facing project identity `Aqua tech CS` consistently and simplify the desktop sidebar brand area.

## Scope

- Use the official Aqua.Tech logo from the company website as a local application asset.
- Show only the logo and `Aqua tech CS` in the sidebar identity row.
- Remove the `Internal OS` badge and the internal-environment description.
- Centralize the visible product name in the AquaFlow product theme.
- Update authentication, metadata, transactional email, system documents, dashboard copy, and the browser icon.
- Preserve `aquaflow` as the technical identifier for the repository, package name, cookies, headers, and integrations.

## Design System impact

- Add optional `logoSrc` support to `AquaProductTheme`.
- Add the backwards-compatible `showTagline` option to `AquaMark`.
- Keep the existing short-mark fallback for products without a logo asset.
- Release the internal package as `0.7.0`.

## Quality gates

- Design System synchronization and visual-contract update.
- ESLint, TypeScript, unit tests, and production build.
- Desktop RTL sidebar, authentication, system-document, and favicon review.
