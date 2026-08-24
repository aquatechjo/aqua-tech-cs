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
const crmSalesCss = readFileSync("src/styles/aqua-crm-sales.css", "utf8")
const discoveryProposalCss = readFileSync(
  "src/styles/aqua-discovery-proposal.css",
  "utf8"
)
const discoveryPage = readFileSync(
  "src/app/dashboard/discovery/DiscoverySessionsClient.tsx",
  "utf8"
)
const discoveryDetailPage = readFileSync(
  "src/app/dashboard/discovery/[id]/DiscoveryIntakeClient.tsx",
  "utf8"
)
const reportPage = readFileSync(
  "src/app/dashboard/discovery/[id]/report/DiscoveryReportClient.tsx",
  "utf8"
)
const pricingPage = readFileSync(
  "src/app/dashboard/discovery/[id]/pricing/PricingWorkspaceClient.tsx",
  "utf8"
)
const proposalPage = readFileSync(
  "src/app/dashboard/discovery/[id]/proposal/ProposalWorkspaceClient.tsx",
  "utf8"
)
const clientsPage = readFileSync(
  "src/app/dashboard/clients/ClientsClient.tsx",
  "utf8"
)
const contactsPage = readFileSync(
  "src/app/dashboard/clients/[id]/ClientContactsClient.tsx",
  "utf8"
)
const leadsPage = readFileSync(
  "src/app/dashboard/leads/LeadsClient.tsx",
  "utf8"
)
const salesPage = readFileSync(
  "src/app/dashboard/sales/SalesPipelineClient.tsx",
  "utf8"
)
const opportunityPage = readFileSync(
  "src/app/dashboard/sales/opportunities/[id]/OpportunityDetailClient.tsx",
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
  assert.match(dashboardPage, /take: 3/u)
  assert.match(dashboardPage, /user\?\.name \?\? "النظام"/u)
  assert.match(dashboardPage, /مهامي قيد التنفيذ/u)
  assert.match(dashboardPage, /مشاريعي الجارية/u)
  assert.match(dashboardPage, /status: "IN_PROGRESS"/u)
  assert.match(dashboardPage, /status: \{ in: \["ISSUED", "PARTIALLY_PAID"\] \}/u)
})

test("dashboard adoption CSS covers responsive, logical, and reduced-motion states", () => {
  for (const contract of [
    ".aqua-dashboard-metric-link",
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

test("UI-18 keeps the dashboard compact and operational", () => {
  for (const token of [
    ".aqua-dashboard-metric-link",
    "min-block-size: 64px",
    ".aqua-dashboard-quiet-state",
    ".aqua-dashboard-metric-link:focus-visible",
    "grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.5fr)",
  ]) {
    assert.match(
      dashboardCss,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u")
    )
  }

  assert.doesNotMatch(dashboardPage, /ما يحتاج انتباهك اليوم/u)
  assert.doesNotMatch(dashboardPage, /ملخص التشغيل/u)
  assert.match(dashboardCss, /font-family: var\(--at-font-latin\)/u)
  assert.match(dashboardPage, /actions=\{/u)
  assert.doesNotMatch(dashboardPage, /عرض سجل النشاط/u)
})

test("UI-09 applies one CRM and Sales workspace contract", () => {
  assert.match(rootLayout, /@\/styles\/aqua-crm-sales\.css/u)
  assert.match(clientsPage, /aqua-crm-page/u)
  assert.match(contactsPage, /aqua-crm-detail-page/u)
  assert.match(leadsPage, /aqua-crm-metrics/u)
  assert.match(salesPage, /aqua-sales-page/u)
  assert.match(salesPage, /aqua-sales-stage/u)
  assert.match(salesPage, /aqua-sales-opportunity-card/u)
  assert.match(opportunityPage, /aqua-opportunity-page/u)
  assert.match(opportunityPage, /aqua-opportunity-metrics/u)

  for (const token of [
    ".aqua-crm-actions",
    ".aqua-crm-metric",
    ".aqua-sales-stage",
    ".aqua-sales-opportunity-card",
    ".aqua-opportunity-page",
    "inset-inline-end",
    "min-inline-size",
    "@media (max-width: 767.98px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.match(
      crmSalesCss,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u")
    )
  }
})

test("UI-10 applies one Discovery, Pricing, and Proposal workspace contract", () => {
  assert.match(rootLayout, /@\/styles\/aqua-discovery-proposal\.css/u)
  assert.match(discoveryPage, /aqua-discovery-page/u)
  assert.match(discoveryDetailPage, /aqua-discovery-detail-page/u)
  assert.match(reportPage, /aqua-report-page/u)
  assert.match(pricingPage, /aqua-pricing-page/u)
  assert.match(proposalPage, /aqua-proposal-page/u)

  for (const token of [
    ".aqua-workspace-actions",
    ".aqua-workspace-metrics",
    ".aqua-workspace-metric",
    ".aqua-discovery-public__workspace",
    ".aqua-proposal-public__decision-grid",
    "inset-inline-end",
    "min-inline-size",
    "@media (max-width: 767.98px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.match(
      discoveryProposalCss,
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
