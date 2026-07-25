import { mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const args = process.argv.slice(2)

function readFlag(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for --${name}`)
  }
  return value
}

function requireMatch(value, pattern, label) {
  if (!pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return value
}

function hexToRgb(hex) {
  const value = hex.slice(1)
  return [0, 2, 4].map((start) => Number.parseInt(value.slice(start, start + 2), 16))
}

function softColor([red, green, blue]) {
  const blend = (channel) => Math.round(channel + (255 - channel) * 0.72)
  return `#${[blend(red), blend(green), blend(blue)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`
}

const name = requireMatch(
  readFlag("name", "aqua-product"),
  /^[a-z][a-z0-9-]{1,49}$/u,
  "project name"
)
const productName = readFlag("product", name)
const mark = requireMatch(readFlag("mark", "AP"), /^[A-Z0-9]{2,4}$/u, "mark")
const accent = requireMatch(readFlag("accent", "#06B6D4"), /^#[0-9A-Fa-f]{6}$/u, "accent")
const secondary = requireMatch(
  readFlag("secondary", "#2563EB"),
  /^#[0-9A-Fa-f]{6}$/u,
  "secondary accent"
)
const mode = readFlag("mode", "dark")
const density = readFlag("density", "comfortable")
const personality = readFlag("personality", "operational")

if (!["light", "dark", "adaptive"].includes(mode)) {
  throw new Error(`Invalid surface mode: ${mode}`)
}
if (!["compact", "comfortable", "spacious"].includes(density)) {
  throw new Error(`Invalid density: ${density}`)
}
if (!["operational", "professional", "intelligent", "expressive"].includes(personality)) {
  throw new Error(`Invalid personality: ${personality}`)
}

const output = path.resolve(readFlag("dir", path.join("..", name)))
await mkdir(output, { recursive: true })
const existing = await readdir(output)
if (existing.length > 0) {
  throw new Error(`Starter directory is not empty: ${output}`)
}

const packageDirectory = path.join(process.cwd(), "packages", "aqua-design-system")
let packageReference = path.relative(output, packageDirectory).replaceAll(path.sep, "/")
if (!packageReference.startsWith(".")) packageReference = `./${packageReference}`

const accentRgb = hexToRgb(accent)
const secondaryRgb = hexToRgb(secondary)
const darkSurface = {
  background: "#020617",
  backgroundSoft: "#07111F",
  card: "#0F172A",
  cardSoft: "#111827",
  border: "rgba(255, 255, 255, 0.10)",
  text: "#F8FAFC",
  muted: "#94A3B8",
  softText: "#64748B",
}
const lightSurface = {
  background: "#F8FAFC",
  backgroundSoft: "#F1F5F9",
  card: "#FFFFFF",
  cardSoft: "#F8FAFC",
  border: "rgba(15, 23, 42, 0.12)",
  text: "#0F172A",
  muted: "#475569",
  softText: "#64748B",
}
const surface = mode === "light" ? lightSurface : darkSurface

const files = {
  ".gitignore": ".next\nnode_modules\n.env*\n!.env.example\n",
  "package.json": `${JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "eslint . --max-warnings=0",
        typecheck: "next typegen && tsc --noEmit --pretty false",
        check: "npm run lint && npm run typecheck && npm run build",
      },
      dependencies: {
        "@aqua-tech/design-system": `file:${packageReference}`,
        bootstrap: "^5.3.8",
        next: "16.2.11",
        react: "19.2.8",
        "react-dom": "19.2.8",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        eslint: "^9",
        "eslint-config-next": "16.2.11",
        typescript: "^5",
      },
    },
    null,
    2
  )}\n`,
  "next.config.ts": `import type { NextConfig } from "next"\n\nconst nextConfig: NextConfig = {\n  transpilePackages: ["@aqua-tech/design-system"],\n}\n\nexport default nextConfig\n`,
  "tsconfig.json": `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2
  )}\n`,
  "next-env.d.ts": `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n`,
  "src/app/layout.tsx": `import type { Metadata } from "next"\nimport "bootstrap/dist/css/bootstrap.min.css"\nimport "@aqua-tech/design-system/styles.css"\nimport "./product-theme.css"\n\nexport const metadata: Metadata = {\n  title: "${productName}",\n  description: "Aqua.Tech product starter",\n}\n\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return (\n    <html lang="ar" dir="rtl" data-aqua-brand="aqua-tech" data-aqua-product="${name}" data-aqua-density="${density}" data-aqua-personality="${personality}">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
  "src/app/page.tsx": `import { AquaBadge, AquaButton, AquaCard, AquaMark } from "@aqua-tech/design-system"\n\nexport default function Home() {\n  return (\n    <main className="aqua-background">\n      <div className="container py-5">\n        <AquaCard glow>\n          <AquaMark theme={{\n            id: "${name}",\n            productName: "${productName}",\n            companyName: "Aqua.Tech",\n            shortMark: "${mark}",\n            accent: { primary: "${accent}", primaryRgb: "${accentRgb.join(", ")}", secondary: "${secondary}", secondaryRgb: "${secondaryRgb.join(", ")}", soft: "${softColor(accentRgb)}", contrast: "#FFFFFF" },\n            surface: { mode: "${mode}", background: "${surface.background}", backgroundSoft: "${surface.backgroundSoft}", card: "${surface.card}", cardSoft: "${surface.cardSoft}", border: "${surface.border}", text: "${surface.text}", muted: "${surface.muted}", softText: "${surface.softText}" },\n            density: "${density}", personality: "${personality}", tagline: "Growth • Software • AI", systemLine: "Build. Launch. Grow."\n          }} />\n          <AquaBadge variant="success" className="mt-4">Starter ready</AquaBadge>\n          <h1 className="mt-3">${productName}</h1>\n          <p>ابدأ من Aqua.Tech Design DNA، ثم أضف شخصية المنتج دون نسخ المكونات.</p>\n          <AquaButton>ابدأ البناء</AquaButton>\n        </AquaCard>\n      </div>\n    </main>\n  )\n}\n`,
  "src/app/product-theme.css": `:root,\n[data-aqua-product="${name}"] {\n  color-scheme: ${mode === "light" ? "light" : "dark"};\n  --at-product-accent: ${accent};\n  --at-product-accent-rgb: ${accentRgb.join(", ")};\n  --at-product-accent-secondary: ${secondary};\n  --at-product-accent-secondary-rgb: ${secondaryRgb.join(", ")};\n  --at-product-accent-soft: ${softColor(accentRgb)};\n  --at-product-accent-contrast: #FFFFFF;\n  --at-product-bg: ${surface.background};\n  --at-product-bg-soft: ${surface.backgroundSoft};\n  --at-product-surface: ${surface.card};\n  --at-product-surface-soft: ${surface.cardSoft};\n  --at-product-border: ${surface.border};\n  --at-product-text: ${surface.text};\n  --at-product-muted: ${surface.muted};\n  --at-product-soft-text: ${surface.softText};\n}\n`,
  "README.md": `# ${productName}\n\nGenerated from Aqua.Tech Product Starter.\n\n- Product id: \`${name}\`\n- Mark: \`${mark}\`\n- Surface mode: \`${mode}\`\n- Density: \`${density}\`\n- Personality: \`${personality}\`\n\nRun \`npm install\`, then \`npm run dev\`.\n`,
}

for (const [relative, content] of Object.entries(files)) {
  const absolute = path.join(output, relative)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, content, "utf8")
}

console.log(`Created Aqua.Tech starter at ${output}`)
