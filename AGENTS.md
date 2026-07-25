<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Aqua.Tech Design System Rules

Before changing any user interface, read:

- `docs/AQUA_TECH_DESIGN_DNA_V1.md`
- `docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md`
- `src/design-system/tokens.ts`
- `src/design-system/product-theme.ts`

Mandatory rules:

1. Treat Aqua.Tech DNA and product personality as separate layers.
2. Do not add arbitrary colors, radius values, spacing values, or motion durations when an approved token exists.
3. Bootstrap is the shared layout and component foundation for AquaFlow.
4. New shared primitives must use semantic CSS classes and design tokens rather than product-specific Tailwind utility strings.
5. Product accents may not redefine success, warning, danger, or information meaning.
6. Every component change must cover focus-visible, disabled, loading, responsive, RTL/LTR, and reduced-motion behavior where applicable.
7. Do not convert a one-off page style into a shared rule without documenting and tokenizing it.
8. Preserve the 70% shared DNA / 30% product personality model.
9. Dashboard routes must use the canonical application shell; do not create page-specific fixed sidebars or topbars.
10. Shell layout and navigation CSS must use logical RTL/LTR properties and the approved compact/comfortable density contract.

11. Data-heavy pages must use the DS-04 data-panel, filter, table, pagination, and state patterns instead of page-specific table wrappers.
12. Destructive or state-changing actions that need confirmation must use the canonical accessible confirmation dialog; do not use `window.confirm`.
13. Mobile tables must explicitly choose `scroll` or `stack` strategy, and stacked cells must provide `data-label` values.
14. Shared workflow patterns belong in `aqua-patterns.css`; do not add new cross-page table, modal, tabs, or filter rules to `aqua-bootstrap.css`.
