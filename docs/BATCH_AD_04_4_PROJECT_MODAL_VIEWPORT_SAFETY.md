# AD-04.4 — Project Modal Viewport Safety

## Outcome

The project create/edit modal now remains usable when its form is taller than the browser viewport. Its header and footer stay visible while the canonical modal body provides the vertical scroll area.

## Scope

- Add an explicit header/body/footer row contract to the shared modal grid.
- Give the long project form a viewport-bounded block size using `vh` with a dynamic-viewport `dvh` enhancement.
- Keep the project cancel and save actions in the existing modal footer.
- Preserve focus trapping, Escape handling, body scroll locking, responsive sheet behavior, logical RTL/LTR layout, and reduced motion.

## Non-goals

- No project form redesign.
- No workflow, permission, database, API, or validation changes.
- No repository or package rename.

## Verification

- Design System package synchronization check.
- Modal and Projects adoption contract tests.
- ESLint, TypeScript, complete unit suite, and production build.
- Manual desktop check at the target laptop viewport before closing AD-04.
