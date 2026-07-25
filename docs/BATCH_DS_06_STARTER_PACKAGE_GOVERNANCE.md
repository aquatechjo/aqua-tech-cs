# DS-06 — Starter, Package, Showcase, and Governance

## Objective

Turn the Aqua.Tech Design DNA from an AquaFlow-only implementation into a governed, reusable internal product platform without adding heavy documentation or browser-testing dependencies to the operational application.

## Delivered

- Synchronized package: `packages/aqua-design-system`.
- Package name: `@aqua-tech/design-system`.
- Initial internal version: `0.6.0`.
- Components, contracts, product theme, and ordered CSS layers exported from one package.
- Management-only live Showcase at `/dashboard/design-system`.
- Product starter generator through `npm run ds:starter`.
- Package drift guard through `npm run ds:check`.
- Deterministic visual-contract baseline through `npm run test:visual`.
- Release and migration governance documentation.

## Source-of-truth model

The canonical sources remain:

- `src/components/aqua`
- `src/design-system`
- `src/styles/aqua-*.css`

Run `npm run ds:sync` after an approved Design System change. The generated package is committed so it can be installed internally through a Git or file reference. `npm run ds:check` fails when the generated package differs from canonical source.

## Visual regression scope

The visual-contract baseline hashes the ordered Design System CSS, constrained contracts, Showcase specification, and shared Aqua component source. This detects unreviewed structural or styling changes without introducing Playwright or Storybook into AquaFlow production dependencies.

It is deliberately not described as pixel-level browser regression. Before an external stable package release, review browser screenshots for:

- Desktop and mobile.
- RTL and LTR.
- Compact and comfortable density.
- Keyboard focus.
- Reduced motion.
- Print output for system documents.

## Release gate

1. `npm run ds:sync` after intentional Design System edits.
2. `npm run ds:visual:update` only after visual review and approval.
3. `npm run check`.
4. Review `/dashboard/design-system` manually.
5. Record the release and migration impact.
