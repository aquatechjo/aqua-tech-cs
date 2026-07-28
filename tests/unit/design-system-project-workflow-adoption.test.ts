import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const files = {
  schema: new URL("../../prisma/schema.prisma", import.meta.url),
  migration: new URL(
    "../../prisma/migrations/20260727213000_project_workflow_templates/migration.sql",
    import.meta.url
  ),
  projectsApi: new URL(
    "../../src/app/api/projects/route.ts",
    import.meta.url
  ),
  projectsPage: new URL(
    "../../src/app/dashboard/projects/page.tsx",
    import.meta.url
  ),
  projectsClient: new URL(
    "../../src/app/dashboard/projects/ProjectsClient.tsx",
    import.meta.url
  ),
  executionPage: new URL(
    "../../src/app/dashboard/projects/[id]/page.tsx",
    import.meta.url
  ),
  executionClient: new URL(
    "../../src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx",
    import.meta.url
  ),
  serviceConvert: new URL(
    "../../src/app/api/service-requests/[id]/convert/route.ts",
    import.meta.url
  ),
  salesConvert: new URL(
    "../../src/app/api/sales/opportunities/[id]/convert/route.ts",
    import.meta.url
  ),
}

test("project workflow adoption is enforced through schema, APIs, and UI", async () => {
  const entries = await Promise.all(
    Object.entries(files).map(async ([key, url]) => [
      key,
      await readFile(url, "utf8"),
    ])
  )
  const source = Object.fromEntries(entries)

  assert.match(source.schema, /model WorkflowTemplate/)
  assert.match(source.schema, /model ProjectWorkflow/)
  assert.match(source.schema, /model ProjectWorkflowApproval/)
  assert.match(source.schema, /model ProjectWorkflowRule/)
  assert.match(source.schema, /model WorkflowEvent/)
  assert.match(source.migration, /migratedExistingProject/)

  assert.match(source.projectsApi, /workflowTemplateId/)
  assert.match(source.projectsApi, /createProjectWithWorkflow/)
  assert.match(source.serviceConvert, /createProjectWithWorkflow/)
  assert.match(source.salesConvert, /createProjectWithWorkflow/)

  assert.match(source.projectsPage, /workflowTemplate\.findMany/)
  assert.match(source.projectsClient, /قالب سير العمل/)
  assert.match(source.projectsClient, /نسخة مستقلة/)
  assert.match(source.executionPage, /pendingApprovalCount/)
  assert.match(source.executionClient, /سير المشروع/)
  assert.match(source.executionClient, /workflowOwnerRole/)
})
