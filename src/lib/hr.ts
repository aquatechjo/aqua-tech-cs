import { ApiError } from "@/lib/api-response"
import { localDateKey } from "@/lib/finance"
import { dateKeyToUtc } from "@/lib/time"

export type LeavePortionValue = "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF"
export type LeaveStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
export type AttendanceStatusValue =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "REMOTE"
  | "HALF_DAY"
  | "ON_LEAVE"
  | "HOLIDAY"

export function normalizeScheduleCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_")
  if (!code || code.length > 32) {
    throw new ApiError("رمز جدول الدوام غير صحيح", 400, "INVALID_SCHEDULE_CODE")
  }
  return code
}

export function normalizeLeaveTypeCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_")
  if (!code || code.length > 32) {
    throw new ApiError("رمز نوع الإجازة غير صحيح", 400, "INVALID_LEAVE_TYPE_CODE")
  }
  return code
}

export function normalizeWorkingDays(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ApiError("أيام الدوام مطلوبة", 400, "INVALID_WORKING_DAYS")
  }

  const days = [...new Set(value.map((item) => Number(item)))].sort((a, b) => a - b)
  if (
    days.length === 0 ||
    days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
  ) {
    throw new ApiError(
      "أيام الدوام يجب أن تكون أرقامًا من 1 إلى 7",
      400,
      "INVALID_WORKING_DAYS",
    )
  }
  return days
}

export function parseClockMinute(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 0 && value <= 1440) return value
  }

  if (typeof value === "string") {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
    if (match) {
      const hours = Number(match[1])
      const minutes = Number(match[2])
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return hours * 60 + minutes
      }
    }
  }

  throw new ApiError("وقت الدوام غير صحيح", 400, "INVALID_CLOCK_TIME")
}

export function clockLabel(minutes: number) {
  const safe = Math.max(0, Math.min(1440, Math.round(minutes)))
  const hours = Math.floor(safe / 60) % 24
  const remainder = safe % 60
  return `${hours.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
}

export function assertScheduleWindow({
  startMinute,
  endMinute,
  breakMinutes,
  graceMinutes,
}: {
  startMinute: number
  endMinute: number
  breakMinutes: number
  graceMinutes: number
}) {
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > 1440 ||
    endMinute <= startMinute
  ) {
    throw new ApiError("بداية الدوام يجب أن تسبق نهايته", 400, "INVALID_SCHEDULE_WINDOW")
  }
  if (
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 0 ||
    breakMinutes >= endMinute - startMinute
  ) {
    throw new ApiError("مدة الاستراحة غير صحيحة", 400, "INVALID_BREAK_MINUTES")
  }
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 180) {
    throw new ApiError("فترة السماح غير صحيحة", 400, "INVALID_GRACE_MINUTES")
  }
}

export function isoWeekday(dateKey: string) {
  const date = dateKeyToUtc(dateKey)
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

export function addDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtc(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dateKeysBetween(startKey: string, endKey: string) {
  const start = dateKeyToUtc(startKey)
  const end = dateKeyToUtc(endKey)
  if (end < start) {
    throw new ApiError("تاريخ النهاية يسبق تاريخ البداية", 400, "INVALID_DATE_RANGE")
  }
  if (end.getTime() - start.getTime() > 366 * 86_400_000) {
    throw new ApiError("مدة الطلب تتجاوز سنة", 400, "DATE_RANGE_TOO_LONG")
  }

  const keys: string[] = []
  for (let cursor = startKey; cursor <= endKey; cursor = addDateKey(cursor, 1)) {
    keys.push(cursor)
  }
  return keys
}

function portionValue(portion: LeavePortionValue) {
  return portion === "FULL_DAY" ? 1 : 0.5
}

export function calculateLeaveDays({
  startKey,
  endKey,
  startPortion,
  endPortion,
  workingDays,
  holidayKeys = [],
}: {
  startKey: string
  endKey: string
  startPortion: LeavePortionValue
  endPortion: LeavePortionValue
  workingDays: readonly number[]
  holidayKeys?: readonly string[]
}) {
  const holidays = new Set(holidayKeys)
  const eligible = dateKeysBetween(startKey, endKey).filter(
    (key) => workingDays.includes(isoWeekday(key)) && !holidays.has(key),
  )

  if (eligible.length === 0) return 0
  if (eligible.length === 1) {
    if (startKey === endKey) {
      return startPortion === "FULL_DAY" && endPortion === "FULL_DAY" ? 1 : 0.5
    }
    const key = eligible[0]
    if (key === startKey) return portionValue(startPortion)
    if (key === endKey) return portionValue(endPortion)
    return 1
  }

  let total = eligible.length
  if (eligible[0] === startKey && startPortion !== "FULL_DAY") total -= 0.5
  if (eligible.at(-1) === endKey && endPortion !== "FULL_DAY") total -= 0.5
  return total
}

export function availableLeaveDays({
  openingDays,
  accruedDays,
  adjustedDays,
  usedDays,
}: {
  openingDays: number
  accruedDays: number
  adjustedDays: number
  usedDays: number
}) {
  return Math.round((openingDays + accruedDays + adjustedDays - usedDays) * 100) / 100
}

export function canTransitionLeave(current: LeaveStatusValue, next: LeaveStatusValue) {
  const transitions: Record<LeaveStatusValue, readonly LeaveStatusValue[]> = {
    PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["CANCELLED"],
    REJECTED: [],
    CANCELLED: [],
  }
  return transitions[current].includes(next)
}

export function localDateTimeToUtc(
  dateKey: string,
  clockValue: string,
  timeZone: string,
) {
  dateKeyToUtc(dateKey)
  const minuteOfDay = parseClockMinute(clockValue)
  if (minuteOfDay === 1440) {
    throw new ApiError("وقت الحضور غير صحيح", 400, "INVALID_CLOCK_TIME")
  }

  const [year, month, day] = dateKey.split("-").map(Number)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = desiredAsUtc
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidate))
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value)
    const renderedAsUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    )
    const difference = desiredAsUtc - renderedAsUtc
    candidate += difference
    if (difference === 0) break
  }

  const result = new Date(candidate)
  if (
    localDateKey(result, timeZone) !== dateKey ||
    localClockMinute(result, timeZone) !== minuteOfDay
  ) {
    throw new ApiError(
      "الوقت المحدد غير موجود في منطقة الشركة الزمنية",
      400,
      "INVALID_LOCAL_DATETIME",
    )
  }
  return result
}

export function localClockMinute(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value)
  const hour = Number(parts.find((part) => part.type === "hour")?.value)
  const minute = Number(parts.find((part) => part.type === "minute")?.value)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("CLOCK_FORMAT_ERROR")
  }
  return hour * 60 + minute
}

export function checkInStatus({
  now,
  timeZone,
  startMinute,
  graceMinutes,
  remote,
}: {
  now: Date
  timeZone: string
  startMinute: number
  graceMinutes: number
  remote: boolean
}): AttendanceStatusValue {
  if (remote) return "REMOTE"
  return localClockMinute(now, timeZone) > startMinute + graceMinutes ? "LATE" : "PRESENT"
}

export function attendanceMetrics({
  checkInAt,
  checkOutAt,
  startMinute,
  endMinute,
  breakMinutes,
  graceMinutes,
  timeZone,
}: {
  checkInAt: Date
  checkOutAt: Date
  startMinute: number
  endMinute: number
  breakMinutes: number
  graceMinutes: number
  timeZone: string
}) {
  const elapsed = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60_000)
  if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > 24 * 60) {
    throw new ApiError("وقت الانصراف يجب أن يلي وقت الحضور", 409, "INVALID_ATTENDANCE_RANGE")
  }

  const workedMinutes = Math.max(0, elapsed - breakMinutes)
  const plannedMinutes = Math.max(0, endMinute - startMinute - breakMinutes)
  const lateMinutes = Math.max(
    0,
    localClockMinute(checkInAt, timeZone) - startMinute - graceMinutes,
  )
  const overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes)

  return { workedMinutes, lateMinutes, overtimeMinutes }
}

export function currentBusinessYear(now: Date, timeZone: string) {
  return Number(localDateKey(now, timeZone).slice(0, 4))
}
