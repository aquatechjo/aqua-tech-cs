import assert from "node:assert/strict"
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
