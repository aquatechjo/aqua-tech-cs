import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  aquaDataDensities,
  aquaDetailColumns,
  aquaModalSizes,
  aquaPageStateVariants,
  aquaTableMobileStrategies,
  aquaTabVariants,
} from "../../src/design-system/pattern-contracts"

const patternsCss = readFileSync("src/styles/aqua-patterns.css", "utf8")
const modal = readFileSync("src/components/aqua/AquaModal.tsx", "utf8")
const table = readFileSync("src/components/aqua/AquaTable.tsx", "utf8")
const clientsPage = readFileSync(
  "src/app/dashboard/clients/ClientsClient.tsx",
  "utf8"
)

test("DS-04 exposes constrained data and workflow contracts", () => {
  assert.deepEqual(aquaDataDensities, ["comfortable", "compact"])
  assert.deepEqual(aquaTableMobileStrategies, ["scroll", "stack"])
  assert.deepEqual(aquaModalSizes, ["sm", "md", "lg", "xl"])
  assert.deepEqual(aquaTabVariants, ["line", "pill"])
  assert.deepEqual(aquaPageStateVariants, [
    "loading",
    "empty",
    "error",
    "success",
    "permission",
  ])
  assert.deepEqual(aquaDetailColumns, [1, 2, 3])
})

test("workflow CSS covers responsive tables, modal states, RTL, and reduced motion", () => {
  for (const token of [
    'data-aqua-mobile-strategy="stack"',
    "content: attr(data-label)",
    "padding-inline",
    "inset-inline",
    ":focus-visible",
    "prefers-reduced-motion",
    "aqua-modal-layer",
    "aqua-page-state--permission",
    "@media (max-width: 767.98px)",
  ]) {
    assert.match(
      patternsCss,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  }
})

test("canonical modal manages focus, Escape, scroll lock, and restoration", () => {
  for (const token of [
    'role="dialog"',
    'aria-modal="true"',
    "focusableSelector",
    'event.key === "Escape"',
    'event.key !== "Tab"',
    'document.body.style.overflow = "hidden"',
    "previousActiveElement?.focus()",
    "createPortal",
  ]) {
    assert.match(
      modal,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  }

  assert.match(
    patternsCss,
    /\.aqua-modal\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/u
  )
  assert.match(
    patternsCss,
    /\.aqua-modal__body\s*\{[\s\S]*overflow-y:\s*auto;/u
  )
})

test("canonical table requires an explicit mobile strategy contract", () => {
  assert.match(table, /data-aqua-mobile-strategy/u)
  assert.match(table, /data-aqua-density/u)
  assert.match(table, /visually-hidden/u)
  assert.match(
    patternsCss,
    /\.aqua-table-shell\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*hidden;/u
  )
})

test("Clients CRM is the first DS-04 reference implementation", () => {
  for (const component of [
    "AquaFormSection",
    "AquaFilterBar",
    "AquaDataPanel",
    "AquaTable",
    "AquaTableStateRow",
    "AquaConfirmDialog",
  ]) {
    assert.match(clientsPage, new RegExp(component))
  }

  assert.match(clientsPage, /mobileStrategy="stack"/u)
  assert.match(clientsPage, /data-label="العميل"/u)
  assert.equal(clientsPage.includes("window.confirm"), false)
  assert.equal(clientsPage.includes("aqua-crm-table-scroll"), false)
})
