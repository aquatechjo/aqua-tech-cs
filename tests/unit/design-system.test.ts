import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  allowedProductThemeKeys,
  aquaFlowTheme,
  aquaTechCsTheme,
  aquaTechDesignTokens,
} from "../../src/design-system"

test("Aqua.Tech DNA exposes the approved fixed scales", () => {
  assert.deepEqual(Object.values(aquaTechDesignTokens.radius), [
    8,
    12,
    16,
    20,
    24,
    32,
    999,
  ])

  assert.equal(aquaTechDesignTokens.space[4], 16)
  assert.equal(aquaTechDesignTokens.motion.durationMs.fast, 180)
  assert.equal(aquaTechDesignTokens.color.brand.cyan, "#00B4FF")
  assert.deepEqual(Object.values(aquaTechDesignTokens.typography.sizePx), [
    12,
    13,
    14,
    16,
    18,
    22,
    28,
  ])
  assert.equal(aquaTechDesignTokens.typography.lineHeight.body, 1.65)
  assert.equal(aquaTechDesignTokens.typography.weight.bold, 700)
})

test("Aqua tech CS product theme stays within the approved theme boundary", () => {
  assert.deepEqual(Object.keys(aquaTechCsTheme).sort(), [...allowedProductThemeKeys].sort())
  assert.equal(aquaTechCsTheme.id, "aqua-tech-cs")
  assert.equal(aquaTechCsTheme.companyName, "Aqua.Tech")
  assert.equal(aquaTechCsTheme.productName, "Aqua tech CS")
  assert.equal(aquaTechCsTheme.logoSrc, "/aqua-tech-logo.webp")
  assert.equal(aquaTechCsTheme.surface.mode, "dark")
  assert.equal(aquaTechCsTheme.personality, "operational")

  assert.equal(aquaFlowTheme.id, "aquaflow")
  assert.equal(aquaFlowTheme.productName, aquaTechCsTheme.productName)
})

test("UI-15 keeps settings, team, and activity inside the admin workspace contract", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8")
  const settings = readFileSync(
    "src/app/dashboard/settings/SettingsClient.tsx",
    "utf8",
  )
  const team = readFileSync(
    "src/app/dashboard/team/TeamClient.tsx",
    "utf8",
  )
  const activity = readFileSync(
    "src/app/dashboard/activity/page.tsx",
    "utf8",
  )
  const styles = readFileSync(
    "src/styles/aqua-admin-governance.css",
    "utf8",
  )

  assert.match(layout, /aqua-admin-governance\.css/)
  assert.match(settings, /aqua-settings-workspace/)
  assert.match(team, /aqua-team-admin-workspace/)
  assert.match(activity, /aqua-activity-metrics/)
  assert.doesNotMatch(activity, /Page \{currentPage\} \/ \{totalPages\}/)
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /inset-inline-end: 0/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
})
