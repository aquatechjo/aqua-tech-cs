import assert from "node:assert/strict"
import test from "node:test"
import {
  amountForMinutes,
  canTransitionTimesheet,
  dateKeyToUtc,
  durationMinutesBetween,
  formatMinutes,
  normalizeDurationMinutes,
  utilizationPercent,
  weekEndDate,
  weekStartDate,
  weekStartFromDateKey,
} from "../../src/lib/time"

test("week boundaries follow the company-local business date", () => {
  const instant = new Date("2026-07-26T22:30:00.000Z")
  assert.equal(
    weekStartDate(instant, "Asia/Amman").toISOString(),
    "2026-07-27T00:00:00.000Z",
  )
  assert.equal(
    weekStartDate(instant, "UTC").toISOString(),
    "2026-07-20T00:00:00.000Z",
  )
  assert.equal(
    weekEndDate(new Date("2026-07-20T00:00:00.000Z")).toISOString(),
    "2026-07-27T00:00:00.000Z",
  )
})

test("date keys and week starts are validated", () => {
  assert.equal(
    dateKeyToUtc("2026-07-24").toISOString(),
    "2026-07-24T00:00:00.000Z",
  )
  assert.equal(
    weekStartFromDateKey("2026-07-26").toISOString(),
    "2026-07-20T00:00:00.000Z",
  )
  assert.throws(() => dateKeyToUtc("2026-02-31"), /التاريخ غير صحيح/)
})

test("manual durations require whole positive minutes", () => {
  assert.equal(normalizeDurationMinutes("90"), 90)
  assert.throws(() => normalizeDurationMinutes("1.5"), /المدة/)
  assert.throws(() => normalizeDurationMinutes(0), /المدة/)
  assert.throws(() => normalizeDurationMinutes(1441), /المدة/)
})

test("timer duration rounds to the nearest minute and remains positive", () => {
  assert.equal(
    durationMinutesBetween(
      new Date("2026-07-24T10:00:00.000Z"),
      new Date("2026-07-24T11:29:31.000Z"),
    ),
    90,
  )
  assert.equal(
    durationMinutesBetween(
      new Date("2026-07-24T10:00:00.000Z"),
      new Date("2026-07-24T10:00:10.000Z"),
    ),
    1,
  )
})

test("timesheet transitions preserve the approval lock", () => {
  assert.equal(canTransitionTimesheet("OPEN", "SUBMITTED"), true)
  assert.equal(canTransitionTimesheet("SUBMITTED", "APPROVED"), true)
  assert.equal(canTransitionTimesheet("SUBMITTED", "REJECTED"), true)
  assert.equal(canTransitionTimesheet("APPROVED", "OPEN"), false)
  assert.equal(canTransitionTimesheet("REJECTED", "OPEN"), true)
})

test("utilization and effort economics are stable", () => {
  assert.equal(utilizationPercent(1800, 40), 75)
  assert.equal(utilizationPercent(0, 0), 0)
  assert.equal(amountForMinutes(90, 20), 30)
  assert.equal(formatMinutes(125), "2:05")
})
