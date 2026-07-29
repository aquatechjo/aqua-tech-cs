# Aqua.Tech Design DNA v1

**Status:** Approved foundation  
**Owner:** Aqua.Tech  
**Applies to:** Aqua Tech CS, Viresto, Aqua.Tech website, future SaaS products, client dashboards, internal systems, reports, presentations, and landing pages.

## 1. Operating model

Every Aqua.Tech product follows a 70/30 model:

- **70% fixed Aqua.Tech DNA:** components, spacing, typography logic, motion, interaction states, accessibility, responsive behavior, RTL/LTR behavior, icon style, content tone, and technical quality.
- **30% product personality:** product name, logo, accent palette, density, visual mood, illustrations, and domain-specific navigation.

Products must feel related without looking like duplicated templates.

## 2. Reference hierarchy

1. **Aqua.Tech website:** mother-brand identity, tone, signature visuals, and marketing expression.
2. **Viresto:** mature SaaS interaction patterns, data-heavy layouts, responsive behavior, motion, loading, empty, error, and success states.
3. **Aqua Tech CS:** first canonical implementation and proving ground for the shared system.

When references conflict, use this priority:

1. Usability and accessibility.
2. Aqua.Tech brand identity.
3. Shared component consistency.
4. Product personality.

## 3. Fixed DNA

### 3.1 Brand character

The shared character is:

- Technical
- Clear
- Practical
- Fast
- Growth-oriented
- AI-ready
- Scalable
- Business-friendly

Avoid generic SaaS styling, decorative overload, random gradients, and different interaction rules between products.

### 3.2 Typography

Canonical families:

- **Arabic UI/body:** IBM Plex Sans Arabic
- **Latin UI/body:** Inter
- **Technical labels/code:** JetBrains Mono

Fallbacks must remain functional when brand fonts are unavailable.

Rules:

- Page title: 700–900 weight, compact line-height.
- Body text: 400–500 weight, readable line-height.
- Labels: 600–700 weight.
- Technical kickers may use the mono family.
- Do not mix more than three font families in one product.
- Arabic and English numerals use Latin digits in operational products unless a client explicitly requires otherwise.

### 3.3 Core brand palette

The mother brand owns these fixed colors:

| Token | Value | Purpose |
|---|---:|---|
| Brand Ink | `#051424` | Aqua.Tech deep background |
| Brand Deep | `#010F1F` | deepest technical surface |
| Brand Aqua | `#89CEFF` | signature light aqua |
| Brand Cyan | `#00B4FF` | signature action cyan |
| Brand Blue | `#2563EB` | scalable secondary blue |
| Text Strong | `#F8FAFC` | dark-surface primary text |
| Text Muted | `#94A3B8` | dark-surface secondary text |

Product themes may map these colors differently, but must preserve an Aqua.Tech signature element.

### 3.4 Semantic colors

Semantic meaning is fixed across products:

- Success: green
- Warning: amber
- Danger: red
- Information: blue
- Neutral: slate

A product accent must never replace semantic meaning.

### 3.5 Shape language

Canonical radius scale:

- XS: 8px
- SM: 12px
- MD: 16px
- LG: 20px
- XL: 24px
- 2XL: 32px
- Pill: 999px

Defaults:

- Controls: 16px
- Cards: 24px
- Modals: 24px
- Compact badges: pill
- Large hero surfaces: up to 32px

### 3.6 Spacing

Use a 4px base system:

`4, 8, 12, 16, 24, 32, 48, 64, 96, 120`

Do not introduce arbitrary values unless a documented component constraint requires one.

### 3.7 Motion

Canonical durations:

- Instant: 120ms
- Fast: 180ms
- Normal: 260ms
- Slow: 420ms
- Success sequence: up to 600ms

Rules:

- Motion explains hierarchy or state; it is not decoration.
- Page transitions should be subtle.
- Hover movement is limited to 1–2px.
- Respect `prefers-reduced-motion`.
- Do not animate layout-critical dimensions without a clear reason.

### 3.8 Icons

- Use one outlined icon family per product.
- Lucide is the default for React products.
- Technical symbols such as `</>`, `{}`, `API`, `SQL`, and `0101` are signature accents, not replacements for clear navigation icons.
- Emojis are not primary product icons.

### 3.9 Interaction states

Every interactive component must define:

- Default
- Hover
- Focus-visible
- Active/selected
- Disabled
- Loading
- Error when applicable

Focus must remain visible with keyboard navigation.

### 3.10 Responsive behavior

Required breakpoints follow Bootstrap conventions unless a product documents a stronger constraint:

- `<576px`
- `≥576px`
- `≥768px`
- `≥992px`
- `≥1200px`
- `≥1400px`

Rules:

- Desktop tables must have a deliberate mobile representation or safe horizontal scroll.
- Navigation must remain usable without hover.
- Primary actions must not fall below a 44px hit target.
- No page may depend on a fixed viewport height without a mobile fallback.

### 3.11 RTL/LTR

- Direction is set at document or product-shell level.
- Icons with directional meaning must mirror.
- Email, phone, code, IDs, currency values, and date-machine values may use `dir="ltr"` inside RTL pages.
- Layout must use logical properties where possible.
- Alignment may not be hard-coded to left/right when start/end is intended.

### 3.12 Accessibility

Minimum requirements:

- WCAG AA color contrast.
- Semantic HTML.
- Visible focus.
- Labels for inputs.
- Keyboard-operable dialogs and menus.
- Reduced-motion support.
- Status messages announced when appropriate.
- Icons with text alternatives where meaning is not redundant.

### 3.13 Content tone

Arabic:

- واضح
- عملي
- مباشر
- بدون مبالغة
- يشرح النتيجة والعمل التالي

English:

- Clear
- Concise
- Operational
- Outcome-focused

Avoid superlatives without evidence.

## 4. Product personality

A product may configure only approved theme dimensions:

- Product name
- Product mark/logo
- Primary and secondary accents
- Background mode: light, dark, or adaptive
- Surface tone
- Density: compact, comfortable, spacious
- Personality: operational, professional, intelligent, expressive
- Illustration style
- Domain-specific navigation

Examples:

- **Aqua Tech CS:** Aqua/cyan + blue, dark, operational, technical.
- **Viresto:** deep teal + copper, adaptive, professional, legal.
- **Future AI product:** Aqua + violet accent, dark/adaptive, intelligent.

## 5. Shared component contract

Canonical components:

- AquaButton
- AquaInput
- AquaSelect
- AquaTextarea
- AquaCard
- AquaBadge
- AquaAlert
- AquaToast
- AquaModal
- AquaTable
- AquaPagination
- AquaSidebar
- AquaTopbar
- AquaPageHeader
- AquaEmptyState
- AquaSkeleton
- AquaLoader
- AquaTabs
- AquaDatePicker

A component may accept product-theme variables but may not redefine interaction rules independently.

## 6. Technical implementation

For Aqua Tech CS and future Bootstrap products:

- Bootstrap is the layout and behavior foundation.
- CSS custom properties are the design-token transport.
- Shared React components consume semantic CSS classes.
- Tailwind utilities may remain temporarily in legacy screens, but new shared primitives must not depend on them.
- Product-specific hard-coded colors must stay outside shared primitives.
- Theme configuration must be declarative and constrained.

## 7. Governance

A new visual rule becomes fixed DNA only after:

1. It solves a repeated need.
2. It is usable in at least two product contexts.
3. It has responsive, RTL/LTR, accessibility, and state coverage.
4. It is documented and represented as a token or component contract.

One-off page styling does not become a shared rule automatically.
