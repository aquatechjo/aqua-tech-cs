import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

import baseline from "../visual/aqua-design-system-baseline.json"
import { aquaDesignSystemVersion } from "../../src/design-system/package-contracts"

function normalize(text: string) {
  return text.replace(/\r\n/gu, "\n")
}

function buildSourceHash(sources: readonly string[]) {
  const hash = createHash("sha256")

  for (const source of sources) {
    hash.update(`${source}\n`)
    hash.update(normalize(readFileSync(source, "utf8")))
    hash.update("\n---\n")
  }

  return hash.digest("hex")
}

test("DS-06 visual contract baseline matches governed source", () => {
  assert.equal(baseline.schemaVersion, 1)
  assert.equal(baseline.algorithm, "sha256")
  assert.equal(baseline.designSystemVersion, aquaDesignSystemVersion)
  assert.equal(buildSourceHash(baseline.sources), baseline.sourceHash)
})

test("visual review surfaces include responsive, focus, motion, and print", () => {
  assert.deepEqual(baseline.reviewSurfaces, [
    "desktop-rtl",
    "mobile-rtl",
    "keyboard-focus",
    "reduced-motion",
    "system-document-print",
  ])
})
