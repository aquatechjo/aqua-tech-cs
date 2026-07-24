# Aqua.Tech Design Reference Audit

Date: 2026-07-25  
Sources reviewed:

- Aqua.Tech website source
- Viresto source
- AquaFlow current source

## Executive finding

The three projects already contain the raw ingredients for a recognizable Aqua.Tech family, but they do not yet share one enforceable design system.

The correct synthesis is:

- **Aqua.Tech website:** brand signature and marketing language.
- **Viresto:** mature product UX patterns and state coverage.
- **AquaFlow:** canonical Bootstrap implementation and future starter base.

## Aqua.Tech website

Strengths:

- Strong technical signature: dark navy, aqua light, cyan action, grid/circuit layers, glass surfaces, terminal/code motifs.
- Clear mother-brand language: Growth • Software • AI.
- Good separation between strong text, muted text, and action color.
- Marketing sections already communicate Aqua.Tech as a software and automation company.

Conflicts to resolve:

- The configured font system and the actually loaded font system are inconsistent.
- Radius values vary significantly between Tailwind configuration, utility classes, and embedded CSS.
- Brand colors appear in several nearby but non-identical palettes.
- A large amount of visual logic lives in embedded page CSS rather than reusable tokens.

Decision:

Use the website as the brand source, not as a dashboard component source.

## Viresto

Strengths:

- Mature CSS variable layer with light and dark modes.
- Broad component coverage: forms, buttons, badges, tables, modals, loading, empty states, alerts, navigation, tabs, filters, print, and responsive rules.
- Strong product personality through deep teal and copper.
- Reusable motion durations and reduced-motion handling.
- Operational experience with dense SaaS workflows.

Conflicts to resolve:

- Many hard-coded color values remain outside the central variable layer.
- Tailwind utilities and custom global classes overlap.
- Some components still encode product-specific color decisions directly.
- The component system is mature but not yet portable as a neutral Aqua.Tech core.

Decision:

Reuse interaction patterns and state coverage, but keep teal/copper as Viresto product personality.

## AquaFlow

Strengths:

- Bootstrap is already installed and used across operational pages.
- Existing Aqua components, brand document, CSS variables, and dark technical direction provide a good implementation base.
- The application is Arabic-first and already exercises real operational modules.

Conflicts to resolve:

- Shared primitives currently mix Tailwind utility classes with Bootstrap.
- Typography falls back to Arial while the other references use stronger brand typography.
- The main stylesheet has accumulated repeated selector definitions and page-specific patches.
- Brand tokens, product tokens, and semantic state tokens are not clearly separated.

Decision:

AquaFlow becomes the first canonical implementation, but migration must be staged to avoid UI regressions.

## Approved synthesis

Fixed:

- Typography logic
- Spacing scale
- Radius scale
- Motion rules
- Interaction states
- Accessibility
- Responsive behavior
- RTL/LTR rules
- Icon family
- Semantic state meaning
- Content tone
- Shared component contracts

Variable:

- Product name and mark
- Accent palette
- Surface mode
- Density
- Personality
- Illustration style
- Domain-specific navigation

## Immediate implementation

DS-01 adds the governance and token foundation without redesigning feature pages.  
DS-02 migrates shared primitives to Bootstrap semantic classes.  
Later stages consolidate application-shell and workflow patterns.
