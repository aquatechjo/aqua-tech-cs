# @aqua-tech/design-system

Internal Aqua.Tech Design System package generated from AquaFlow.

## Version

0.6.0

## Next.js usage

Add the package to `transpilePackages`, import Bootstrap first, then import the ordered Design System CSS bundle:

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: ["@aqua-tech/design-system"],
}

export default nextConfig
```

```tsx
import "bootstrap/dist/css/bootstrap.min.css"
import "@aqua-tech/design-system/styles.css"

import { AquaButton, AquaCard } from "@aqua-tech/design-system"
```

## Governance

Do not edit generated package source directly. Edit AquaFlow canonical sources and run `npm run ds:sync`.
