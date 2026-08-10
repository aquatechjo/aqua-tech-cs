import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  contractAmendmentActionIssues,
  projectContractAmendmentMutationSchema,
} from "../../src/lib/project-contract-amendment"
import { projectChangeActionIssues } from "../../src/lib/project-change-request"

test("contract amendment lifecycle is ordered and four-eyes protected", () => {
  assert.deepEqual(
    contractAmendmentActionIssues({
      status: "DRAFT",
      action: "READY_FOR_REVIEW",
      creatorUserId: "admin-1",
      actor: { id: "admin-1", role: "ADMIN" },
    }),
    [],
  )
  assert.match(
    contractAmendmentActionIssues({
      status: "READY_FOR_REVIEW",
      action: "INTERNALLY_APPROVE",
      creatorUserId: "admin-1",
      actor: { id: "admin-1", role: "ADMIN" },
    }).join(" "),
    /أنشأ الملحق/,
  )
  assert.deepEqual(
    contractAmendmentActionIssues({
      status: "READY_FOR_REVIEW",
      action: "INTERNALLY_APPROVE",
      creatorUserId: "owner-1",
      actor: { id: "owner-1", role: "OWNER" },
    }),
    [],
  )
})

test("evidence is required for approval delivery and client decision", () => {
  assert.equal(
    projectContractAmendmentMutationSchema.safeParse({
      action: "INTERNALLY_APPROVE",
      reference: "",
    }).success,
    false,
  )
  assert.equal(
    projectContractAmendmentMutationSchema.safeParse({
      action: "ACCEPT",
      reference: "CLIENT-SIGN-14",
    }).success,
    true,
  )
})

test("commercial scope cannot apply before client accepts the amendment", () => {
  const blocked = projectChangeActionIssues({
    status: "APPROVED",
    action: "APPLY",
    itemCount: 1,
    clientApprovalRequired: true,
    clientApprovalReference: "CLIENT-APPROVAL",
    commercialImpact: "APPROVED",
    commercialReference: "QUOTE-14",
    financialApprovalStatus: "APPROVED",
    contractAmendmentStatus: "SENT",
  })
  assert.match(blocked.join(" "), /قبول ملحق العقد/)
})

test("amendment persistence freezes scope and is tenant scoped and locked", () => {
  const route = readFileSync(
    "src/app/api/projects/[id]/change-requests/[changeRequestId]/contract-amendment/route.ts",
    "utf8",
  )
  const migration = readFileSync(
    "prisma/migrations/20260810213000_proj_14_governed_contract_amendments/migration.sql",
    "utf8",
  )
  assert.match(route, /itemsSnapshot/)
  assert.match(route, /financialAmountSnapshot/)
  assert.match(route, /companyId: user\.companyId/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /PROJECT_AMENDMENT_INTERNALLY_APPROVED/)
  assert.match(migration, /ProjectContractAmendment_state_evidence_check/)
  assert.match(migration, /changeRequestId_key/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})
