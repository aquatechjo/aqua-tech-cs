import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { projectChangeActionIssues, projectChangeDraftSchema } from "../../src/lib/project-change-request"

test("commercial change drafts require a positive governed amount and ISO currency", () => {
  const base = {
    title: "زيادة نطاق التنفيذ",
    businessReason: "طلب العميل إضافة تسليم جديد",
    scheduleImpactDays: 3,
    commercialImpact: "APPROVED" as const,
    commercialReference: "QUOTE-22",
    clientApprovalRequired: true,
    clientApprovalReference: null,
    items: [{ action: "ADD_DELIVERABLE" as const, title: "تسليم إضافي" }],
  }
  assert.equal(projectChangeDraftSchema.safeParse(base).success, false)
  assert.equal(projectChangeDraftSchema.safeParse({ ...base, financialAmount: 250, financialCurrency: "JOD" }).success, true)
})

test("management approval is blocked until finance approves commercial impact", () => {
  const issues = projectChangeActionIssues({
    status: "IN_REVIEW",
    action: "APPROVE",
    itemCount: 1,
    clientApprovalRequired: false,
    commercialImpact: "APPROVED",
    commercialReference: "QUOTE-22",
    financialApprovalStatus: "PENDING",
  })
  assert.match(issues.join(" "), /اعتماد الأثر المالي/)
})

test("financial decision endpoint is tenant scoped locked and four-eyes protected", () => {
  const route = readFileSync("src/app/api/projects/[id]/change-requests/[changeRequestId]/financial-approval/route.ts", "utf8")
  assert.match(route, /ACCESS_ROLES\.financeManagement/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /companyId: user\.companyId/)
  assert.match(route, /current\.createdById === user\.id/)
  assert.match(route, /PROJECT_CHANGE_FINANCE_APPROVED/)
  assert.match(route, /PROJECT_CHANGE_FINANCE_REJECTED/)
})

test("database constrains financial shape and durable approval evidence", () => {
  const migration = readFileSync("prisma/migrations/20260810190000_proj_13_change_financial_approval/migration.sql", "utf8")
  assert.match(migration, /ProjectChangeRequest_financial_shape_check/)
  assert.match(migration, /ProjectChangeRequest_financial_approval_check/)
  assert.match(migration, /financialApprovedById_fkey/)
})
