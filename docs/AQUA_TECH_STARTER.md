# Aqua.Tech Product Starter

## Generate a starter

```powershell
npm run ds:starter -- --name aqua-product --product "Aqua Product" --mark AP --mode dark --density comfortable
```

Optional flags:

- `--dir <path>` output directory.
- `--accent <#RRGGBB>` primary product accent.
- `--secondary <#RRGGBB>` secondary accent.
- `--mode light|dark|adaptive`.
- `--density compact|comfortable|spacious`.
- `--personality operational|professional|intelligent|expressive`.

The generator refuses to overwrite a non-empty directory and validates names, marks, colors, modes, densities, and personalities.

## Generated architecture

The starter uses:

- Next.js App Router.
- Bootstrap.
- `@aqua-tech/design-system` through a local file dependency by default.
- Ordered Design System CSS imports.
- A constrained product-theme CSS layer.
- `transpilePackages` for the internal TypeScript package.

## 70/30 rule

Keep the shared 70% inside the package:

- Component behavior.
- Spacing scale.
- Typography contract.
- Accessibility states.
- RTL/LTR logic.
- Data and workflow patterns.

Keep the product 30% inside `product-theme.css`:

- Primary and secondary accent.
- Surface mode.
- Product name and mark.
- Density and personality.

Do not fork shared components to create product identity. Extend the product theme first; propose a shared contract change only when the need is cross-product.
