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

test("AD-02.6 dashboard uses canonical Aqua components without alert duplication", () => {
  for (const component of [
    "AquaBadge",
    "AquaCard",
    "AquaDataPanel",
    "AquaEmptyState",
    "AquaLinkButton",
  ]) {
    assert.match(dashboardPage, new RegExp(component, "u"))
  }

  assert.doesNotMatch(dashboardPage, /aqua-card aqua-hero/u)
  assert.doesNotMatch(dashboardPage, /display-6 fw-black/u)
  assert.doesNotMatch(dashboardPage, /aqua-stat-card/u)
  assert.doesNotMatch(dashboardPage, /AquaMark/u)
  assert.doesNotMatch(dashboardPage, /النظام متصل/u)
  assert.doesNotMatch(dashboardPage, /الجلسات النشطة/u)
  assert.doesNotMatch(dashboardPage, /أعضاء الفريق/u)
  assert.doesNotMatch(dashboardPage, /المرجع التشغيلي الأول/u)
  assert.doesNotMatch(dashboardPage, /مسارات تحتاج مراجعة/u)
  assert.doesNotMatch(dashboardPage, />\s*التنبيهات\s*</u)
  assert.doesNotMatch(dashboardPage, /تنبيهات جديدة/u)
  assert.doesNotMatch(dashboardPage, /Daily focus|Action queue|Recent activity/u)
})

test("AD-02.6 dashboard is employee-first, role-aware, and timezone-aware", () => {
  assert.match(dashboardPage, /ACCESS_ROLES\.activityLog/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.salesRead/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.financeRead/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.financeManagement/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.taskManagement/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.projectManagement/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.serviceRequestManagement/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.timeApproval/u)
  assert.match(dashboardPage, /ACCESS_ROLES\.leaveApproval/u)
  assert.match(dashboardPage, /businessDate\(now, timeZone\)/u)
  assert.match(dashboardPage, /classifyMyDayDueDate/u)
  assert.match(dashboardPage, /followUpBucket/u)
  assert.match(dashboardPage, /user\.role === "OWNER"/u)
  assert.match(dashboardPage, /ar-JO-u-nu-latn/u)
  assert.match(dashboardPage, /recentActivities\.length === 0/u)
  assert.match(dashboardPage, /take: 5/u)
  assert.match(dashboardPage, /user\?\.name \?\? "النظام"/u)
  assert.match(dashboardPage, /مهامي قيد التنفيذ/u)
  assert.match(dashboardPage, /مشاريعي الجارية/u)
  assert.match(dashboardPage, /status: "IN_PROGRESS"/u)
  assert.match(dashboardPage, /status: \{ in: \["ISSUED", "PARTIALLY_PAID"\] \}/u)
})

test("dashboard adoption CSS covers responsive, logical, and reduced-motion states", () => {
  for (const contract of [
    ".aqua-dashboard-summary",
    ".aqua-dashboard-metrics",
    ".aqua-dashboard-workspace",
    ".aqua-dashboard-focus-item",
    ".aqua-dashboard-attention-item",
    ".aqua-dashboard-activity-item",
    "@media (max-width: 1399.98px)",
    "@media (max-width: 1199.98px)",
    "@media (max-width: 767.98px)",
    "@media (prefers-reduced-motion: reduce)",
    "inset-inline-end",
    "inset-block-start",
    "min-inline-size",
  ]) {
    assert.match(dashboardCss, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"))
  }

  assert.match(rootLayout, /@\/styles\/aqua-dashboard\.css/u)
})

test("UI-08 gives the dashboard one final operational hierarchy", () => {
  for (const token of [
    "UI-08 — Dashboard final operational hierarchy",
    "min-block-size: 120px",
    "min-block-size: 92px",
    "font-size: var(--at-text-display)",
    ".aqua-dashboard-metric > .aqua-button .aqua-button__label",
    "grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.5fr)",
  ]) {
    assert.match(
      dashboardCss,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u")
    )
  }
})

test("AD-01 is included in quality gates and the adoption roadmap", () => {
  assert.match(
    packageJson.scripts["test:unit"],
    /design-system-dashboard-adoption\.test\.ts/u
  )
  assert.match(roadmap, /AD-01 — Dashboard Overview Adoption/u)
  assert.match(roadmap, /AD-02\.5 — Dashboard Operations/u)
  assert.match(roadmap, /AD-02\.6 — Employee Dashboard Polish/u)
  assert.match(roadmap, /Status: \*\*implemented\*\*/u)
})
