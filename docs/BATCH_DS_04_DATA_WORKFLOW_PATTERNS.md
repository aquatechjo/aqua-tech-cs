# Batch DS-04 — Data and Workflow Patterns

## Purpose

Turn Aqua.Tech Design DNA into repeatable patterns for operational forms, searchable data, responsive tables, detail surfaces, and confirmation workflows.

## Added contracts

- Data density: `comfortable | compact`
- Mobile table strategy: `scroll | stack`
- Modal size: `sm | md | lg | xl`
- Tabs style: `line | pill`
- Page state: `loading | empty | error | success | permission`
- Detail columns: `1 | 2 | 3`

## Added components

- `AquaFormSection`
- `AquaFilterBar`
- `AquaDataPanel`
- `AquaTable`
- `AquaTableStateRow`
- `AquaPageState`
- `AquaPagination` enhanced contract
- `AquaModal`
- `AquaConfirmDialog`
- `AquaTabs`
- `AquaDetailList`
- `AquaLinkButton`

## Accessibility and interaction rules

- Dialogs use `role="dialog"`, `aria-modal`, labelled titles, Escape close, focus trapping, focus restoration, and body scroll locking.
- Destructive workflows use a confirmation dialog rather than browser-native confirmation.
- Table captions remain available to assistive technology.
- Current pagination and tab states use `aria-current` and `aria-selected`.
- Stacked mobile tables require a `data-label` on each data cell.
- Reduced-motion preferences disable modal and pattern transitions.

## First implementation

The Clients CRM page is migrated to the canonical form, filters, data panel, responsive stacked table, semantic badges, pagination, feedback alert, and archive confirmation workflow.

## Deferred migration

Other existing pages remain functional and will move to DS-04 patterns incrementally. Their older CSS is not removed in this batch to avoid a broad visual regression.
