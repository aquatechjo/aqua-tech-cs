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

