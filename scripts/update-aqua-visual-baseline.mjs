import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const sources = [
  "src/design-system/component-contracts.ts",
  "src/design-system/pattern-contracts.ts",
  "src/design-system/public-contracts.ts",
  "src/design-system/shell-contracts.ts",
  "src/design-system/package-contracts.ts",
  "src/design-system/showcase-spec.ts",
  "src/styles/aqua-tokens.css",
  "src/styles/aqua-bootstrap.css",
  "src/styles/aqua-primitives.css",
  "src/styles/aqua-shell.css",
  "src/styles/aqua-patterns.css",
  "src/styles/aqua-public.css",
  "src/styles/aqua-showcase.css",
  "src/app/dashboard/design-system/DesignSystemShowcase.tsx",
]

function normalize(text) {
  return text.replace(/\r\n/gu, "\n")
}

const hash = createHash("sha256")
for (const source of sources) {
  hash.update(`${source}\n`)
  hash.update(normalize(await readFile(path.join(root, source), "utf8")))
  hash.update("\n---\n")
}

const packageContracts = await readFile(
  path.join(root, "src/design-system/package-contracts.ts"),
  "utf8"
)
const version = packageContracts.match(/aquaDesignSystemVersion = "([^"]+)"/u)?.[1]
if (!version) throw new Error("Unable to resolve Design System version")

const baseline = {
  schemaVersion: 1,
  designSystemVersion: version,
  algorithm: "sha256",
  sourceHash: hash.digest("hex"),
  sources,
  reviewSurfaces: [
    "desktop-rtl",
    "mobile-rtl",
    "keyboard-focus",
    "reduced-motion",
    "system-document-print",
  ],
}

await writeFile(
  path.join(root, "tests/visual/aqua-design-system-baseline.json"),
  `${JSON.stringify(baseline, null, 2)}\n`,
  "utf8"
)

console.log(`Updated Aqua Design System visual baseline ${baseline.sourceHash}`)
