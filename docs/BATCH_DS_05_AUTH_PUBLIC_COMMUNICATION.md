# DS-05 — Authentication, Public Surfaces, and Communication

Status: **implemented**

## Objective

DS-05 extends the Aqua.Tech Design DNA beyond the authenticated dashboard. It
creates one controlled visual and behavioral layer for authentication journeys,
transactional email, and system-generated documents.

The stage preserves all existing authentication and password-reset security
logic. It changes presentation contracts and communication composition only.

## Canonical public-surface contract

The approved surface kinds are:

- `auth`
- `public`
- `system-document`

The approved authentication journey states are:

- `idle`
- `submitting`
- `success`
- `error`
- `invalid-link`

These values are exported from `src/design-system/public-contracts.ts` and must
not be expanded locally inside a page.

## Authentication surfaces

The following routes now use the same canonical shell and DS-02 primitives:

- `/login`
- `/forgot-password`
- `/reset-password`

The shared implementation is composed from:

- `AuthShell`
- `PasswordInput`
- `AquaInput`
- `AquaButton`
- `AquaLinkButton`
- `AquaAlert`
- `AquaCard`
- `AquaBadge`
- `AquaMark`

### Required behavior

- Arabic is the primary interface direction.
- Email addresses, URLs, and machine values remain `dir="ltr"`.
- Loading states use the canonical button spinner and `aria-busy` behavior.
- Errors use `AquaAlert` with `role="alert"`.
- Success and neutral notices use live status semantics.
- Invalid reset links do not display an unusable password form.
- Password visibility controls expose an accessible Arabic label and pressed
  state.
- Keyboard focus is visible on links, fields, buttons, and the skip link.
- Reduced-motion preferences disable decorative transitions.

## Marketing-to-product continuity

The public shell reuses the same product tokens as the dashboard, while allowing
more expressive composition around the form card. The shared continuity points
are:

- AquaFlow mark and Aqua.Tech lockup
- product accent and secondary accent
- spacing, radius, typography, and focus-ring tokens
- the `Growth • Software • AI` brand line
- grid and glow motifs from the Aqua.Tech visual language

The form remains the primary task. The brand story is hidden below the desktop
breakpoint rather than competing with the authentication flow on small screens.

## Transactional email

`src/lib/email-templates.ts` is the canonical pure template layer.
`src/lib/email.ts` is transport-only and currently sends through Resend.

The password-reset template includes:

- HTML and plain-text alternatives
- RTL document direction
- escaped recipient name and URL output
- an HTTP/HTTPS-only link policy
- a single primary action
- a visible fallback URL
- expiry, one-time-use, and session-revocation guidance
- Aqua.Tech and AquaFlow identification

Future transactional messages must be added as pure template builders before
being connected to a provider.

## System-generated documents

`AquaSystemDocument` defines the browser and print shell for future invoices,
proposals, summaries, and operational exports.

The shell standardizes:

- Aqua.Tech and AquaFlow identification
- document label, reference, and issue date
- comfortable and compact densities
- A4-oriented print dimensions
- neutral white document colors independent of dashboard dark mode
- logical RTL/LTR alignment
- print-safe spacing and footer treatment

Feature modules should supply domain content only. They must not recreate the
brand header or print frame.

## Styling layer

`src/styles/aqua-public.css` is loaded after primitives, the application shell,
and workflow patterns. It owns only public/auth/document composition.

It must not redefine product tokens or duplicate DS-02 component internals.

## Release evidence

DS-05 is covered by `tests/unit/design-system-public.test.ts`, which verifies:

- constrained public and communication contracts
- canonical primitive usage by authentication routes
- public CSS accessibility, RTL-safe positioning, responsive behavior, print
  behavior, and reduced motion
- separation between email transport and template composition
- HTML escaping and unsafe-link rejection
- the reusable system-document shell
