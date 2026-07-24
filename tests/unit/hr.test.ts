import assert from "node:assert/strict"
import test from "node:test"
import {
  attendanceMetrics,
  availableLeaveDays,
  calculateLeaveDays,
  canTransitionLeave,
  checkInStatus,
  localDateTimeToUtc,
  normalizeWorkingDays,
  parseClockMinute,
} from "../../src/lib/hr"

test("working days are unique sorted ISO weekdays", () => {
  assert.deepEqual(normalizeWorkingDays([7, 1, 2, 2, 4, 3]), [1, 2, 3, 4, 7])
  assert.throws(() => normalizeWorkingDays([0, 8]))
})

test("clock input converts to stable minute snapshots", () => {
  assert.equal(parseClockMinute("09:30"), 570)
  assert.equal(parseClockMinute(1020), 1020)
  assert.throws(() => parseClockMinute("24:00"))
})

test("leave duration excludes weekends and company holidays", () => {
  assert.equal(
    calculateLeaveDays({
      startKey: "2026-07-26",
      endKey: "2026-07-30",
      startPortion: "FULL_DAY",
      endPortion: "FULL_DAY",
      workingDays: [7, 1, 2, 3, 4],
      holidayKeys: ["2026-07-28"],
    }),
    4,
  )
  assert.equal(
    calculateLeaveDays({
      startKey: "2026-07-26",
      endKey: "2026-07-26",
      startPortion: "FIRST_HALF",
      endPortion: "FIRST_HALF",
      workingDays: [7, 1, 2, 3, 4],
    }),
    0.5,
  )
})

test("leave balances and transitions preserve approval controls", () => {
  assert.equal(
    availableLeaveDays({ openingDays: 2, accruedDays: 14, adjustedDays: -1, usedDays: 4.5 }),
    10.5,
  )
  assert.equal(canTransitionLeave("PENDING", "APPROVED"), true)
  assert.equal(canTransitionLeave("APPROVED", "REJECTED"), false)
  assert.equal(canTransitionLeave("APPROVED", "CANCELLED"), true)
})

test("manual attendance clock values use the company timezone", () => {
  assert.equal(
    localDateTimeToUtc("2026-07-26", "09:00", "Asia/Amman").toISOString(),
    "2026-07-26T06:00:00.000Z",
  )
})

test("attendance status and minutes use schedule snapshots", () => {
  const onTime = new Date("2026-07-26T05:55:00.000Z") // 08:55 Amman
  const late = new Date("2026-07-26T06:20:00.000Z") // 09:20 Amman
  assert.equal(
    checkInStatus({
      now: onTime,
      timeZone: "Asia/Amman",
      startMinute: 540,
      graceMinutes: 15,
      remote: false,
    }),
    "PRESENT",
  )
  assert.equal(
    checkInStatus({
      now: late,
      timeZone: "Asia/Amman",
      startMinute: 540,
      graceMinutes: 15,
      remote: false,
    }),
    "LATE",
  )
  assert.deepEqual(
    attendanceMetrics({
      checkInAt: new Date("2026-07-26T06:20:00.000Z"),
      checkOutAt: new Date("2026-07-26T15:20:00.000Z"),
      startMinute: 540,
      endMinute: 1020,
      breakMinutes: 60,
      graceMinutes: 15,
      timeZone: "Asia/Amman",
    }),
    { workedMinutes: 480, lateMinutes: 5, overtimeMinutes: 60 },
  )
})
