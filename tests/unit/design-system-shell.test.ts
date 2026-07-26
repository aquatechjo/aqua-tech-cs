import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { aquaShellDensities } from "../../src/design-system/shell-contracts"
import { resolveAquaRoute } from "../../src/components/layout/aqua-route-registry"

const shellCss = readFileSync("src/styles/aqua-shell.css", "utf8")
const dashboardShell = readFileSync(
  "src/components/layout/AquaDashboardShell.tsx",
  "utf8"
)
const sidebar = readFileSync("src/components/layout/AquaSidebar.tsx", "utf8")
const topbar = readFileSync("src/components/layout/AquaTopbar.tsx", "utf8")

test("DS-03 exposes only approved application shell densities", () => {
  assert.deepEqual(aquaShellDensities, ["compact", "comfortable"])
})

test("route resolution preserves exact and nested dashboard context", () => {
  assert.deepEqual(resolveAquaRoute("/dashboard/finance/invoices"), {
    path: "/dashboard/finance/invoices",
    title: "الفواتير",
    subtitle: "إصدار الفواتير ومتابعة التحصيل والمدفوعات",
    isNested: false,
  })

  assert.deepEqual(
    resolveAquaRoute("/dashboard/sales/opportunities/opportunity-1"),
    {
      path: "/dashboard/sales/opportunities",
      title: "فرص المبيعات",
      subtitle: "متابعة تفاصيل الفرص والأنشطة والعروض",
      isNested: true,
    }
  )
})

test("application shell covers responsive navigation and accessibility states", () => {
  for (const token of [
    "data-aqua-density",
    "aqua-skip-link",
    "aria-modal",
    "focusableSelector",
    'event.key === "Escape"',
    'event.key !== "Tab"',
  ]) {
    assert.match(dashboardShell, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  for (const token of [
    "padding-inline-start",
    "inset-inline-start",
    "border-inline-end",
    "aqua-mobile-navigation--open",
    "prefers-reduced-motion",
    'data-aqua-density="compact"',
    "@media (max-width: 1199.98px)",
  ]) {
    assert.match(shellCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("canonical shell components use semantic Aqua classes", () => {
  const tailwindRecipes = [
    "fixed right-0",
    "border-white/10",
    "bg-slate-950",
    "rounded-3xl",
    "backdrop-blur-xl",
    "text-slate-500",
  ]

  for (const source of [sidebar, topbar]) {
    for (const recipe of tailwindRecipes) {
      assert.equal(source.includes(recipe), false)
    }
  }

  assert.match(sidebar, /aqua-sidebar__navigation/)
  assert.match(sidebar, /<AquaMark size="sm" showTagline=\{false\} \/>/u)
  assert.doesNotMatch(sidebar, /aqua-sidebar__company/u)
  assert.match(topbar, /aqua-topbar__inner/)
})
