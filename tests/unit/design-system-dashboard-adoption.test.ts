import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const dashboardPage = readFileSync(
  "src/app/dashboard/page.tsx",
  "utf8"
)
const dashboardCss = readFileSync(
  "src/styles/aqua-dashboard.css",
  "utf8"
)
const rootLayout = readFileSync("src/app/layout.tsx", "utf8")
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}
const roadmap = readFileSync(
  "docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md",
  "utf8"
)

test("AD-01 dashboard uses canonical Aqua components", () => {
  for (const component of [
    "AquaBadge",
    "AquaCard",
    "AquaDataPanel",
    "AquaEmptyState",
    "AquaLinkButton",
    "AquaMark",
  ]) {
    assert.match(dashboardPage, new RegExp(component, "u"))
  }

  assert.doesNotMatch(dashboardPage, /aqua-card aqua-hero/u)
  assert.doesNotMatch(dashboardPage, /display-6 fw-black/u)
  assert.doesNotMatch(dashboardPage, /aqua-stat-card/u)
})

test("AD-01 preserves role-aware and timezone-aware behavior", () => {
  assert.match(dashboardPage, /ACCESS_ROLES\.activityLog/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.salesRead/u)
  assert.match(dashboardPage, /user\.company\.timezone/u)
  assert.match(dashboardPage, /ar-JO-u-nu-latn/u)
  assert.match(dashboardPage, /recentActivities\.length === 0/u)
})

test("dashboard adoption CSS covers responsive, logical, and reduced-motion states", () => {
  for (const contract of [
    ".aqua-dashboard-hero",
    ".aqua-dashboard-metrics",
    ".aqua-dashboard-workspace",
    ".aqua-dashboard-activity-item",
    ".aqua-dashboard-quick-links",
    "@media (max-width: 1199.98px)",
    "@media (max-width: 767.98px)",
    "@media (prefers-reduced-motion: reduce)",
    "inset-inline-end",
    "min-inline-size",
  ]) {
    assert.match(dashboardCss, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"))
  }

  assert.match(rootLayout, /@\/styles\/aqua-dashboard\.css/u)
})

test("AD-01 is included in quality gates and the adoption roadmap", () => {
  assert.match(
    packageJson.scripts["test:unit"],
    /design-system-dashboard-adoption\.test\.ts/u
  )
  assert.match(roadmap, /AD-01 — Dashboard Overview Adoption/u)
  assert.match(roadmap, /Status: \*\*implemented\*\*/u)
})
