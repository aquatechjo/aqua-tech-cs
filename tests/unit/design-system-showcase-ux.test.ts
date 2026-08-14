import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const showcase = readFileSync(
  "src/app/dashboard/design-system/DesignSystemShowcase.tsx",
  "utf8"
)
const showcaseCss = readFileSync("src/styles/aqua-showcase.css", "utf8")
const shell = readFileSync("src/components/layout/AquaDashboardShell.tsx", "utf8")
const shellCss = readFileSync("src/styles/aqua-shell.css", "utf8")
const publicCss = readFileSync("src/styles/aqua-public.css", "utf8")
const packageContracts = readFileSync(
  "src/design-system/package-contracts.ts",
  "utf8"
)

test("DS-06.1 uses one accessible focused Showcase panel", () => {
  assert.match(showcase, /role="tablist"/u)
  assert.match(showcase, /aria-orientation="vertical"/u)
  assert.match(showcase, /role="tabpanel"/u)
  assert.match(showcase, /handleNavigationKeyDown/u)
  assert.match(showcase, /activeSection === "overview"/u)
  assert.match(showcase, /window\.location\.hash/u)
  assert.match(showcase, /hashchange/u)
  assert.match(showcase, /scrollIntoView/u)
  assert.match(showcase, /preventScroll: true/u)
  assert.doesNotMatch(showcase, /aqua-showcase__index/u)
})

test("DS-06.1 explains the package workflow in plain language", () => {
  for (const term of [
    "حزمة موحّدة",
    "مزامنة تلقائية",
    "بداية جاهزة",
    "حوكمة بصرية",
  ]) {
    assert.match(showcase, new RegExp(term, "u"))
  }

  assert.match(showcase, /ليست قراءة لحظية/u)
  assert.match(showcase, /جميع البوابات ناجحة/u)
})

test("Showcase focus mode removes the desktop sidebar without losing the drawer", () => {
  assert.match(shell, /usePathname/u)
  assert.match(shell, /aqua-shell--showcase/u)
  assert.match(
    shellCss,
    /\.aqua-shell--showcase \.aqua-shell__layer > \.aqua-sidebar--desktop/u
  )
  assert.match(shellCss, /\.aqua-shell--showcase \.aqua-topbar__menu-button/u)
})

test("Showcase layout covers responsive navigation, document preview, print, and motion", () => {
  assert.match(showcaseCss, /\.aqua-showcase__workspace/u)
  assert.match(showcaseCss, /\.aqua-showcase__navigation/u)
  assert.match(showcaseCss, /\.aqua-showcase__document-preview/u)
  assert.match(showcaseCss, /body\.aqua-printing-system-document/u)
  assert.match(showcaseCss, /prefers-reduced-motion/u)
  assert.match(showcaseCss, /max-width: 639\.98px/u)
  assert.match(showcaseCss, /hero-status > div:first-child/u)
  assert.match(showcaseCss, /surface-grid[\s\S]*align-self: start/u)
  assert.doesNotMatch(
    showcaseCss,
    /aqua-showcase__rail[\s\S]*?overflow-y:\s*auto/u
  )
})

test("light system documents override dark detail-list colors", () => {
  assert.match(
    publicCss,
    /\.aqua-system-document \.aqua-detail-list__item/u
  )
  assert.match(
    publicCss,
    /\.aqua-system-document \.aqua-detail-list__value \{\s*color: #0f172a;/u
  )
  assert.match(packageContracts, /aquaDesignSystemVersion = "0\.10\.0"/u)
})
