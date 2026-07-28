import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const page = readFileSync(
  "src/app/dashboard/projects/page.tsx",
  "utf8"
)
const detailPage = readFileSync(
  "src/app/dashboard/projects/[id]/page.tsx",
  "utf8"
)
const client = readFileSync(
  "src/app/dashboard/projects/ProjectsClient.tsx",
  "utf8"
)
const executionClient = readFileSync(
  "src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx",
  "utf8"
)
const css = readFileSync(
  "src/app/dashboard/projects/Projects.module.css",
  "utf8"
)
const executionCss = readFileSync(
  "src/app/dashboard/projects/[id]/ProjectExecution.module.css",
  "utf8"
)
const listApi = readFileSync(
  "src/app/api/projects/route.ts",
  "utf8"
)
const detailApi = readFileSync(
  "src/app/api/projects/[id]/route.ts",
  "utf8"
)
const executionApi = readFileSync(
  "src/app/api/projects/[id]/execution/route.ts",
  "utf8"
)
const memberApi = readFileSync(
  "src/app/api/projects/[id]/members/route.ts",
  "utf8"
)
const participantApi = readFileSync(
  "src/app/api/tasks/[id]/participants/route.ts",
  "utf8"
)
const aquaInput = readFileSync(
  "src/components/aqua/AquaInput.tsx",
  "utf8"
)
const aquaSelect = readFileSync(
  "src/components/aqua/AquaSelect.tsx",
  "utf8"
)
const packageJson = JSON.parse(
  readFileSync("package.json", "utf8")
) as {
  scripts: Record<string, string>
}
const roadmap = readFileSync(
  "docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md",
  "utf8"
)

test("AD-04 Projects uses canonical data and workflow components", () => {
  for (const component of [
    "AquaAlert",
    "AquaBadge",
    "AquaButton",
    "AquaConfirmDialog",
    "AquaDataPanel",
    "AquaDatePicker",
    "AquaFilterBar",
    "AquaModal",
    "AquaTable",
    "AquaTableStateRow",
  ]) {
    assert.match(client, new RegExp(component, "u"))
  }

  assert.match(executionClient, /AquaDataPanel/u)
  assert.match(executionClient, /AquaConfirmDialog/u)
  assert.match(client, /mobileStrategy="stack"/u)
  assert.match(executionClient, /mobileStrategy="stack"/u)
  assert.match(client, /data-label=/u)
  assert.match(executionClient, /data-label=/u)
  assert.match(client, /className="aqua-form-grid"/u)
  assert.equal(
    (
      client.match(
        /className=\{styles\.dateField\} data-aqua-span="6"/gu
      ) ?? []
    ).length,
    2
  )
  assert.doesNotMatch(client, /window\.confirm/u)
  assert.doesNotMatch(executionClient, /window\.confirm/u)
  assert.match(client, /stats\.totalPages > 1/u)
})

test("AD-04 applies project and task visibility before rendering summaries", () => {
  assert.match(page, /resolveTaskAccessScope\(user\)/u)
  assert.match(page, /projectScopeFromTaskScope\(/u)
  assert.match(page, /buildProjectVisibilityWhere\(scope\)/u)
  assert.match(page, /buildTaskVisibilityWhere\(taskScope\)/u)
  assert.match(page, /\.\.\.taskVisibilityWhere/u)
  assert.match(detailPage, /buildProjectVisibilityWhere\(projectScope\)/u)
  assert.match(detailPage, /buildTaskVisibilityWhere\(taskScope\)/u)
  assert.match(detailPage, /assignableUserIds/u)
  assert.match(listApi, /buildProjectVisibilityWhere\(scope\)/u)
  assert.match(detailApi, /buildProjectVisibilityWhere\(scope\)/u)
  assert.match(executionApi, /buildTaskVisibilityWhere\(taskScope\)/u)
})

test("AD-04 separates metadata execution finance and assignment permissions", () => {
  assert.match(detailApi, /ACCESS_ROLES\.projectManagement/u)
  assert.doesNotMatch(
    detailApi,
    /requireProjectExecutionManager\(user, id\)/u
  )
  assert.match(listApi, /scope\.canViewProjectBudgets/u)
  assert.match(detailApi, /scope\.canViewProjectBudgets/u)
  assert.match(
    executionApi,
    /projectScope\.canViewProjectBudgets/u
  )
  assert.match(memberApi, /canAssignTaskTo\(scope, employee\.userId\)/u)
  assert.match(
    memberApi,
    /PROJECT_MEMBER_SCOPE_FORBIDDEN/u
  )
  assert.match(
    participantApi,
    /TASK_PARTICIPANT_SCOPE_FORBIDDEN/u
  )
})

test("AD-04 supports compact field sizes without native size conflicts", () => {
  assert.match(
    aquaInput,
    /Omit<[\s\S]*InputHTMLAttributes<HTMLInputElement>[\s\S]*"size"/u
  )
  assert.match(
    aquaSelect,
    /Omit<[\s\S]*SelectHTMLAttributes<HTMLSelectElement>[\s\S]*"size"/u
  )
})

test("AD-04 styling covers responsive logical and reduced-motion behavior", () => {
  for (const source of [css, executionCss]) {
    for (const contract of [
      ".page",
      ".intro",
      ".metrics",
      "@media (max-width: 767.98px)",
      "@media (max-width: 575.98px)",
      "@media (prefers-reduced-motion: reduce)",
      "inline-size",
      "block-size",
    ]) {
      assert.match(
        source,
        new RegExp(
          contract.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
          "u"
        )
      )
    }
  }
  assert.match(client, /className=\{styles\.projectModal\}/u)
  assert.match(
    css,
    /\.projectModal\s*\{[\s\S]*block-size:\s*min\(900px, 90vh\);/u
  )
  assert.match(css, /block-size:\s*min\(900px, 90dvh\);/u)
})

test("AD-04 is included in quality gates and the adoption roadmap", () => {
  assert.match(
    packageJson.scripts["test:unit"],
    /project-scope\.test\.ts/u
  )
  assert.match(
    packageJson.scripts["test:unit"],
    /design-system-projects-adoption\.test\.ts/u
  )
  assert.match(roadmap, /## AD-04 — Projects Adoption/u)
  assert.match(roadmap, /Status: \*\*implemented\*\*/u)
})
