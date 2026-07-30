import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  evaluateProjectReadiness,
  projectExecutionIsActivated,
  projectExecutionNeedsActivation,
} from "../../src/lib/project-readiness"

const readySnapshot = {
  projectStatus: "PLANNING",
  workflowStatus: "NOT_STARTED",
  contractRequired: true,
  contractStatus: "SIGNED" as const,
  paymentRequired: true,
  requiredPaymentAmount: "1000.00",
  paidAmount: "1000.00",
  overrideGrantedAt: null,
  activatedAt: null,
}

test("PROJ-02 blocks execution until contract and payment readiness are real", () => {
  const result = evaluateProjectReadiness({
    ...readySnapshot,
    contractStatus: "PENDING",
    requiredPaymentAmount: null,
    paidAmount: "0",
  })

  assert.equal(result.state, "BLOCKED")
  assert.equal(result.contractSatisfied, false)
  assert.equal(result.paymentSatisfied, false)
  assert.match(result.issues.join(" "), /العقد/)
  assert.match(result.issues.join(" "), /مبلغ/)
})

test("signed contract and posted payment satisfy exact decimal readiness", () => {
  assert.deepEqual(evaluateProjectReadiness(readySnapshot), {
    state: "READY",
    issues: [],
    contractSatisfied: true,
    paymentSatisfied: true,
    readyToActivate: true,
  })

  const largeAmount = evaluateProjectReadiness({
    ...readySnapshot,
    requiredPaymentAmount: "999999999999.99",
    paidAmount: "999999999999.99",
  })
  assert.equal(largeAmount.paymentSatisfied, true)
  assert.equal(largeAmount.state, "READY")

  const insufficient = evaluateProjectReadiness({
    ...readySnapshot,
    paidAmount: "999.99",
  })
  assert.equal(insufficient.paymentSatisfied, false)
  assert.match(insufficient.issues.join(" "), /أقل/)
})

test("documented override bypasses commercial gates but not workflow integrity", () => {
  const override = "2026-07-31T08:00:00.000Z"
  const commercialOverride = evaluateProjectReadiness({
    ...readySnapshot,
    contractStatus: "PENDING",
    requiredPaymentAmount: null,
    paidAmount: "0",
    overrideGrantedAt: override,
  })
  assert.equal(commercialOverride.state, "READY")
  assert.equal(commercialOverride.contractSatisfied, true)
  assert.equal(commercialOverride.paymentSatisfied, true)

  const invalidWorkflow = evaluateProjectReadiness({
    ...readySnapshot,
    contractStatus: "PENDING",
    requiredPaymentAmount: null,
    paidAmount: "0",
    overrideGrantedAt: override,
    workflowStatus: "ACTIVE",
  })
  assert.equal(invalidWorkflow.state, "BLOCKED")
  assert.match(invalidWorkflow.issues.join(" "), /سير العمل/)
})

test("activation is terminal and execution mutations are classified safely", () => {
  const activated = evaluateProjectReadiness({
    ...readySnapshot,
    projectStatus: "IN_PROGRESS",
    workflowStatus: "ACTIVE",
    activatedAt: "2026-07-31T09:00:00.000Z",
  })
  assert.equal(activated.state, "ACTIVATED")
  assert.equal(activated.readyToActivate, false)
  assert.deepEqual(activated.issues, [])
  assert.equal(
    projectExecutionIsActivated({
      activatedAt: "2026-07-31T09:00:00.000Z",
    }),
    true,
  )
  assert.equal(projectExecutionIsActivated(null), false)

  assert.equal(
    projectExecutionNeedsActivation({
      status: "TODO",
      progress: 0,
      assignedToId: null,
    }),
    false,
  )
  assert.equal(
    projectExecutionNeedsActivation({
      status: "IN_PROGRESS",
    }),
    true,
  )
  assert.equal(
    projectExecutionNeedsActivation({
      assignedToId: "employee-1",
    }),
    true,
  )
})

test("readiness persistence is tenant-scoped, constrained, and non-destructive", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731070000_proj_02_project_readiness_gate/migration.sql",
    ),
    "utf8",
  )

  assert.match(schema, /model ProjectReadiness\s*\{/)
  assert.match(schema, /projectId\s+String\s+@unique/)
  assert.match(schema, /overrideReason\s+String\?/)
  assert.match(schema, /activatedAt\s+DateTime\?/)
  assert.match(migration, /ProjectReadiness_override_check/)
  assert.match(migration, /ProjectReadiness_activation_check/)
  assert.match(migration, /originProposalWorkspaceId/)
  assert.match(migration, /INSERT INTO "ProjectReadiness"/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})

test("activation rechecks posted project payments under a row lock", () => {
  const route = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/readiness/route.ts",
    ),
    "utf8",
  )
  const server = readFileSync(
    resolve(process.cwd(), "src/lib/project-readiness-server.ts"),
    "utf8",
  )

  assert.match(route, /assertSameOrigin\(request\)/)
  assert.match(route, /FROM "ProjectReadiness"[\s\S]+FOR UPDATE/)
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(route, /action: z\.literal\("ACTIVATE"\)/)
  assert.match(route, /PROJECT_READINESS_BLOCKED/)
  assert.match(route, /projectLeadEmployeeProfileId/)
  assert.match(route, /status: "IN_PROGRESS"/)
  assert.match(route, /eventKey: "workflow\.project\.started"/)
  assert.doesNotMatch(route, /assignedToId:/)

  assert.match(server, /status: "POSTED"/)
  assert.match(server, /invoice:\s*\{[\s\S]+companyId,[\s\S]+projectId/)
  assert.match(server, /PROJECT_READINESS_REQUIRED/)
})

test("execution APIs enforce activation instead of trusting disabled controls", () => {
  const paths = [
    "src/app/api/projects/[id]/members/route.ts",
    "src/app/api/projects/[id]/members/[memberId]/route.ts",
    "src/app/api/projects/[id]/phases/route.ts",
    "src/app/api/projects/[id]/phases/[phaseId]/route.ts",
    "src/app/api/tasks/route.ts",
    "src/app/api/tasks/[id]/route.ts",
    "src/app/api/tasks/[id]/participants/route.ts",
    "src/app/api/tasks/[id]/participants/[participantId]/route.ts",
    "src/app/api/tasks/[id]/blockers/route.ts",
    "src/app/api/tasks/[id]/blockers/[blockerId]/route.ts",
  ]

  for (const path of paths) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8")
    assert.match(
      source,
      /assertProjectExecutionActivated/,
      `${path} must enforce the readiness gate`,
    )
  }
})

test("new projects remain in planning and accepted proposals require both gates", () => {
  const projectsRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/projects/route.ts"),
    "utf8",
  )
  const conversionRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/sales/opportunities/[id]/convert/route.ts",
    ),
    "utf8",
  )
  const projectsClient = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/ProjectsClient.tsx",
    ),
    "utf8",
  )

  assert.match(projectsRoute, /z\.literal\("PLANNING"\)/)
  assert.match(
    conversionRoute,
    /readiness:\s*\{[\s\S]+contractRequired: true,[\s\S]+paymentRequired: true/,
  )
  assert.match(projectsClient, /يبدأ المشروع في التخطيط/)
  assert.match(projectsClient, /بوابة[\s\S]+الجاهزية/)
})
