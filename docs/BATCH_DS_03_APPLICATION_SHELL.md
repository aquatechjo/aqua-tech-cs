# Batch DS-03 — Application Shell

**Status:** Implemented  
**Depends on:** DS-01 Design Foundation, DS-02 Bootstrap Primitives

## Objective

Standardize the AquaFlow application shell around the approved Aqua.Tech Design DNA while preserving product permissions and page functionality.

## Delivered

### Canonical shell

- `AquaDashboardShell`
- `AquaSidebar`
- `AquaSidebarNav`
- `AquaTopbar`
- `AquaPageTitle`
- route registry and breadcrumb resolution

The dashboard layout now composes these shared components instead of maintaining a separate page-level shell implementation.

### Navigation structure

Navigation is grouped into:

- daily operations
- business
- people
- system

Existing role checks remain server-side. Unavailable destinations preserve their disabled state instead of becoming active links.

### Density contract

The shell supports two approved density modes:

- `comfortable` — AquaFlow default
- `compact` — for higher-density operational products

Density changes shell spacing and sidebar dimensions without redefining component anatomy.

### Responsive behavior

- fixed desktop sidebar
- mobile navigation drawer
- backdrop dismissal
- Escape dismissal
- focus return to the menu trigger
- keyboard focus containment while the drawer is open
- body scroll locking
- automatic close after navigation

### Accessibility and directionality

- skip link to main content
- `aria-current` for active navigation
- labeled navigation landmarks
- modal semantics for the mobile drawer
- logical CSS properties for RTL/LTR
- `focus-visible` coverage
- reduced-motion behavior

## Compatibility

- Business pages and their data workflows are unchanged.
- Existing product permissions remain unchanged.
- Legacy page-level CSS remains available and will be consolidated in DS-04.
- Auth and public pages are intentionally deferred to DS-05.

## Verification gate

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Then review:

- desktop sidebar scrolling
- mobile drawer opening and closing
- Escape and Tab keyboard behavior
- active route indication on nested pages
- Arabic RTL layout
- narrow mobile topbar
- compact and comfortable density attributes
