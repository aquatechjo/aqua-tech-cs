import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const myDayPage = readFileSync("src/app/dashboard/my-day/page.tsx", "utf8")
const myDayCss = readFileSync("src/styles/aqua-my-day.css", "utf8")
const shellCss = readFileSync("src/styles/aqua-operational-shell.css", "utf8")
const topbar = readFileSync("src/components/layout/AquaTopbar.tsx", "utf8")
const sidebar = readFileSync("src/components/layout/AquaSidebar.tsx", "utf8")
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>
}
const roadmap = readFileSync("docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md", "utf8")

test("AD-02.2 derives the My Day operational state from live task data", () => {
  assert.match(myDayPage, /items\.length === 0/u)
  assert.match(myDayPage, /لا توجد مهام نشطة/u)
  assert.match(myDayPage, /attentionCount > 0/u)
  assert.match(myDayPage, /operationalState\.variant/u)
  assert.match(myDayPage, /<h1>أولويات اليوم<\/h1>/u)
})

test("AD-02.2 reduces hero, metric, empty-state, and focus density", () => {
  for (const token of [
    "AD-02.2 — Operational density and dynamic states",
    "font-size: clamp(1.35rem, 2vw, 1.85rem)",
    "min-block-size: 92px",
    "min-block-size: 170px",
    ".aqua-my-day-focus-panel",
    ".aqua-my-day-links-panel",
  ]) {
    assert.match(myDayCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"))
  }

  assert.doesNotMatch(myDayPage, /Daily focus/u)
  assert.doesNotMatch(myDayPage, /Quick links/u)
})

test("AD-02.2 balances the account chip and compacts the navigation shell", () => {
  assert.match(topbar, /roleLabel/u)
  assert.match(topbar, /aqua-topbar__account-label/u)
  assert.ok(topbar.includes("title={`الحساب: ${userEmail}`}"))
  assert.match(sidebar, /بيئة التشغيل الداخلية/u)

  for (const token of [
    "--aqua-shell-sidebar-width: 256px",
    "min-block-size: 64px",
    "min-block-size: 36px",
    ".aqua-topbar__account-label",
    "min-height: 980px",
  ]) {
    assert.match(shellCss, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"))
  }
})

test("AD-02.2 is part of the adoption quality gate", () => {
  assert.match(
    packageJson.scripts["test:unit"],
    /tests\/unit\/design-system-operational-density-dynamic-states\.test\.ts/u
  )
  assert.match(roadmap, /## AD-02\.2 — Operational Density and Dynamic States/u)
})
