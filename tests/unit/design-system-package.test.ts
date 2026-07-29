import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  aquaDesignSystemComponentGroups,
  aquaDesignSystemCssLayers,
  aquaDesignSystemPackageName,
  aquaDesignSystemReleaseChannels,
  aquaDesignSystemReleaseLevels,
  aquaDesignSystemVersion,
  aquaStarterDensities,
  aquaStarterRequiredFiles,
  aquaStarterSurfaceModes,
} from "../../src/design-system/package-contracts"
import { aquaDesignSystemShowcase } from "../../src/design-system/showcase-spec"

const packageRoot = "packages/aqua-design-system"
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8")
) as {
  name: string
  version: string
  exports: Record<string, unknown>
  private: boolean
}
const manifest = JSON.parse(
  readFileSync(path.join(packageRoot, "manifest.json"), "utf8")
) as {
  packageName: string
  version: string
  cssImportOrder: string[]
}
const syncScript = readFileSync("scripts/sync-aqua-design-system.mjs", "utf8")
const starterScript = readFileSync("scripts/create-aqua-product-starter.mjs", "utf8")
const showcasePage = readFileSync(
  "src/app/dashboard/design-system/DesignSystemShowcase.tsx",
  "utf8"
)

function fileNames(directory: string, extension: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(extension))
    .sort()
}

test("DS-06 exposes constrained package, starter, and release contracts", () => {
  assert.equal(aquaDesignSystemPackageName, "@aqua-tech/design-system")
  assert.match(aquaDesignSystemVersion, /^0\.8\.\d+$/u)
  assert.deepEqual(aquaDesignSystemCssLayers, [
    "tokens",
    "bootstrap",
    "primitives",
    "shell",
    "patterns",
    "public",
  ])
  assert.deepEqual(aquaDesignSystemReleaseLevels, ["patch", "minor", "major"])
  assert.deepEqual(aquaDesignSystemReleaseChannels, [
    "internal",
    "candidate",
    "stable",
  ])
  assert.deepEqual(aquaStarterSurfaceModes, ["light", "dark", "adaptive"])
  assert.deepEqual(aquaStarterDensities, [
    "compact",
    "comfortable",
    "spacious",
  ])
  assert.equal(aquaStarterRequiredFiles.length, 7)
})

test("generated package metadata matches canonical contracts", () => {
  assert.equal(packageJson.name, aquaDesignSystemPackageName)
  assert.equal(packageJson.version, aquaDesignSystemVersion)
  assert.equal(packageJson.private, true)
  assert.equal(manifest.packageName, aquaDesignSystemPackageName)
  assert.equal(manifest.version, aquaDesignSystemVersion)
  assert.deepEqual(
    manifest.cssImportOrder,
    aquaDesignSystemCssLayers.map((layer) => `aqua-${layer}.css`)
  )
  assert.ok(packageJson.exports["."])
  assert.ok(packageJson.exports["./styles.css"])
  assert.ok(packageJson.exports["./manifest"])
})

test("generated package contains every canonical Aqua component and contract", () => {
  assert.deepEqual(
    fileNames(path.join(packageRoot, "src/components"), ".tsx"),
    fileNames("src/components/aqua", ".tsx")
  )
  assert.deepEqual(
    fileNames(path.join(packageRoot, "src/design-system"), ".ts"),
    fileNames("src/design-system", ".ts")
  )

  const manifestComponents = Object.values(aquaDesignSystemComponentGroups).flat()
  assert.ok(manifestComponents.includes("AquaButton"))
  assert.ok(manifestComponents.includes("AquaSystemDocument"))
})

test("package synchronization and starter scripts enforce safe boundaries", () => {
  for (const token of [
    "--check",
    "out of sync",
    "rewriteComponentSource",
    "Aqua Tech CS canonical sources",
  ]) {
    assert.match(syncScript, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  for (const token of [
    "Starter directory is not empty",
    "Invalid surface mode",
    "transpilePackages",
    "product-theme.css",
    "@aqua-tech/design-system",
  ]) {
    assert.match(starterScript, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("the in-product Showcase covers every governed section", () => {
  for (const section of aquaDesignSystemShowcase.sections) {
    assert.ok(
      showcasePage.includes(`activeSection === "${section.id}"`),
      `Missing focused Showcase renderer for ${section.id}`
    )
  }

  assert.match(showcasePage, /data-aqua-showcase-version/u)
  assert.match(showcasePage, /className="aqua-showcase__hero"/u)
  assert.match(showcasePage, /role="tablist"/u)
  assert.match(showcasePage, /role="tabpanel"/u)
  assert.match(showcasePage, /npm run ds:check/u)
  assert.match(showcasePage, /npm run test:visual/u)
})
