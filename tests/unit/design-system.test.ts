import assert from "node:assert/strict"
import test from "node:test"

import {
  allowedProductThemeKeys,
  aquaFlowTheme,
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
  assert.deepEqual(Object.keys(aquaFlowTheme).sort(), [...allowedProductThemeKeys].sort())
  assert.equal(aquaFlowTheme.companyName, "Aqua.Tech")
  assert.equal(aquaFlowTheme.productName, "Aqua tech CS")
  assert.equal(aquaFlowTheme.logoSrc, "/aqua-tech-logo.webp")
  assert.equal(aquaFlowTheme.surface.mode, "dark")
  assert.equal(aquaFlowTheme.personality, "operational")
})
