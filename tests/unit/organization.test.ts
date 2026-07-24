import assert from "node:assert/strict"
import test from "node:test"
import { ApiError } from "../../src/lib/api-response"
import {
  allocationTotal,
  assertAllocationCapacity,
  normalizeOrganizationCode,
} from "../../src/lib/organization"

test("organization codes are normalized and bounded", () => {
  assert.equal(normalizeOrganizationCode(" product team "), "PRODUCT_TEAM")
  assert.equal(normalizeOrganizationCode("sales---ops"), "SALES_OPS")
  assert.equal(normalizeOrganizationCode("فريق التقنية"), "")
  assert.equal(
    normalizeOrganizationCode("a".repeat(50)).length,
    30
  )
})

test("allocation totals are calculated exactly", () => {
  assert.equal(allocationTotal([20, 35, 45]), 100)
  assert.equal(assertAllocationCapacity([25, 25], 50), 100)
})

test("employee time allocation cannot exceed 100 percent", () => {
  assert.throws(
    () => assertAllocationCapacity([60, 30], 20),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "ALLOCATION_EXCEEDS_CAPACITY"
  )
})
