import assert from "node:assert/strict"
import test from "node:test"
import { ApiError } from "../../src/lib/api-response"
import {
  assertProgress,
  averageProgress,
  classifyMyDayDueDate,
  normalizePhaseCode,
  wouldCreateDependencyCycle,
} from "../../src/lib/project-execution"

test("phase codes are normalized and bounded", () => {
  assert.equal(normalizePhaseCode(" discovery phase "), "DISCOVERY_PHASE")
  assert.equal(normalizePhaseCode("مرحلة التحليل"), "")
  assert.equal(normalizePhaseCode("a".repeat(80)).length, 40)
})

test("progress accepts only whole percentages", () => {
  assert.equal(assertProgress(0), 0)
  assert.equal(assertProgress(100), 100)
  assert.equal(averageProgress([10, 40, 100]), 50)

  assert.throws(
    () => assertProgress(101),
    (error: unknown) => error instanceof ApiError && error.code === "INVALID_PROGRESS"
  )
})

test("dependency cycles and self-dependencies are rejected", () => {
  const edges = [
    { taskId: "task-b", dependsOnTaskId: "task-a" },
    { taskId: "task-c", dependsOnTaskId: "task-b" },
  ]

  assert.equal(wouldCreateDependencyCycle("task-a", "task-c", edges), true)
  assert.equal(wouldCreateDependencyCycle("task-c", "task-a", edges), false)
  assert.equal(wouldCreateDependencyCycle("task-a", "task-a", edges), true)
})

test("my day buckets use the configured business timezone", () => {
  const now = new Date("2026-07-24T20:30:00.000Z")

  assert.equal(
    classifyMyDayDueDate(new Date("2026-07-23T10:00:00.000Z"), now, "Asia/Amman"),
    "OVERDUE"
  )
  assert.equal(
    classifyMyDayDueDate(new Date("2026-07-24T10:00:00.000Z"), now, "Asia/Amman"),
    "TODAY"
  )
  assert.equal(
    classifyMyDayDueDate(new Date("2026-07-30T10:00:00.000Z"), now, "Asia/Amman"),
    "UPCOMING"
  )
})
