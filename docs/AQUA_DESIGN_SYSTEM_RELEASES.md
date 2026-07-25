# Aqua.Tech Design System Releases

## Package

- Name: `@aqua-tech/design-system`
- Current internal version: `0.6.1`
- Canonical source: AquaFlow
- Generated package: `packages/aqua-design-system`


## 0.6.1 — internal

Release level: **patch**

- Reorganized the in-product Showcase into a focused, accessible section reference.
- Added full-width Showcase shell behavior while retaining the navigation drawer.
- Clarified approved-baseline status versus live quality-gate execution.
- Added compact system-document screen preview and dedicated print flow.
- Fixed `AquaDetailList` contrast inside light `AquaSystemDocument` output.
- No consumer migration and no public prop changes.

## Semantic versioning

### Patch

Use for fixes that do not change a public prop, contract value, CSS selector meaning, or required consumer behavior.

Examples:

- Correct focus visibility.
- Fix RTL logical spacing.
- Correct a print rule without changing document structure.

### Minor

Use for backwards-compatible additions.

Examples:

- Add a component.
- Add an approved variant.
- Add an optional prop.
- Add a token without changing existing token semantics.

### Major

Use for breaking changes.

Examples:

- Remove or rename a component or prop.
- Change CSS import order.
- Change a token's meaning.
- Change default interaction behavior.
- Require a consumer migration.

## Release channels

- `internal`: AquaFlow is the validating consumer.
- `candidate`: at least one second Aqua.Tech product validates the package.
- `stable`: approved for normal use across Aqua.Tech products.

## Required release record

Every release must document:

- Version and channel.
- Added, changed, deprecated, and removed contracts.
- Consumer migration notes.
- Visual review surfaces.
- Quality-gate result.

## Update discipline

Do not manually edit generated files under `packages/aqua-design-system/src` or `packages/aqua-design-system/styles`. Edit canonical source, run `npm run ds:sync`, then review the generated diff.

Do not run `npm run ds:visual:update` to silence a failure. Update the baseline only when the visual change is deliberate and reviewed.
