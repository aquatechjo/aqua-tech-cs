import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  amendmentImpactIssues,
  applyAmendmentImpact,
  projectContractAmendmentMutationSchema,
} from "../../src/lib/project-contract-amendment"

test("accepted amendment impact requires explicit evidence and applies exact snapshots", () => {
  assert.equal(
    projectContractAmendmentMutationSchema.safeParse({
      action: "APPLY_IMPACT",
      reference: "",
    }).success,
    false,
  )
  const result = applyAmendmentImpact({
    projectBudget: "1000.00",
    amendmentAmount: "125.50",
    projectDueDate: "2026-08-10T00:00:00.000Z",
    scheduleImpactDays: 5,
  })
  assert.equal(result.budgetAfter, "1125.50")
  assert.equal(result.dueDateAfter?.toISOString(), "2026-08-15T00:00:00.000Z")
})

test("impact application blocks missing baseline, currency drift, and duplicate application", () => {
  const issues = amendmentImpactIssues({
    impactAppliedAt: new Date(),
    projectBudget: null,
    projectCurrency: "JOD",
    amendmentCurrency: "USD",
    scheduleImpactDays: 2,
    projectDueDate: null,
  })
  assert.equal(issues.length, 4)
})

test("zero-day impact does not require a due date", () => {
  assert.deepEqual(
    amendmentImpactIssues({
      impactAppliedAt: null,
      projectBudget: "100.00",
      projectCurrency: "JOD",
      amendmentCurrency: "JOD",
      scheduleImpactDays: 0,
      projectDueDate: null,
    }),
    [],
  )
})

test("impact persistence is locked, tenant scoped, audited, and non-destructive", () => {
  const route = readFileSync(
    "src/app/api/projects/[id]/change-requests/[changeRequestId]/contract-amendment/route.ts",
    "utf8",
  )
  const migration = readFileSync(
    "prisma/migrations/20260810233000_proj_15_apply_contract_amendment_impact/migration.sql",
    "utf8",
  )
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /companyId: user\.companyId/)
  assert.match(route, /PROJECT_AMENDMENT_IMPACT_APPLIED/)
  assert.match(route, /budgetBeforeSnapshot/)
  assert.match(route, /dueDateAfterSnapshot/)
  assert.match(migration, /impact_application_check/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})
