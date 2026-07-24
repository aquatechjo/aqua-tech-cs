# Aqua.Tech Design System Adoption Roadmap

## DS-01 — Design Foundation

Status: **this batch**

- Approve the 70/30 DNA model.
- Add canonical tokens.
- Add constrained product-theme configuration.
- Add design-system instructions for coding agents.
- Connect AquaFlow to the token layer.
- Preserve current functionality and visual behavior.
- Add unit checks for theme boundaries.

## DS-02 — Bootstrap Primitives

- Migrate AquaButton, AquaInput, AquaCard, AquaBadge, and AquaMark to semantic Bootstrap/CSS classes.
- Add select, textarea, alert, and toast contracts.
- Remove Tailwind dependency from shared primitives.
- Add component-state examples.

## DS-03 — Application Shell

- Standardize sidebar, topbar, page shell, page header, breadcrumbs, and mobile navigation.
- Define compact/comfortable density modes.
- Fix logical RTL/LTR behavior.
- Add responsive navigation tests.

## DS-04 — Data and Workflow Patterns

- Standardize tables, filters, search, pagination, forms, modals, tabs, and detail pages.
- Define mobile table strategy.
- Add loading, empty, error, success, and permission-denied states.
- Consolidate AquaFlow CSS patches into structured layers.

## DS-05 — Auth and Public Surfaces

- Rebuild login, forgot-password, and reset-password using canonical components.
- Define marketing-to-product continuity.
- Standardize branded email templates and system-generated documents.

## DS-06 — Starter and Package

- Extract a reusable Bootstrap theme package.
- Create an Aqua.Tech project starter.
- Add Storybook or an equivalent component showcase.
- Add visual regression testing.
- Add release/versioning rules.

## DS-07 — Viresto Adoption

- Map Viresto tokens to the shared contract.
- Preserve teal/copper product personality.
- Replace duplicated primitives gradually.
- Keep legal-domain UX where it is genuinely domain-specific.

## Release gate for every stage

- Lint
- Typecheck
- Unit tests
- Production build
- Keyboard test
- RTL/LTR review
- Mobile review
- Contrast review
- No unapproved hard-coded product colors in shared primitives
