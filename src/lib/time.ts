import { ApiError } from "@/lib/api-response"
import { localDateKey } from "@/lib/finance"

export const MAX_MANUAL_MINUTES = 24 * 60
export const MAX_TIMER_MINUTES = 7 * 24 * 60

export type TimesheetStatusValue =
  | "OPEN"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"

export function dateKeyToUtc(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError("صيغة التاريخ غير صحيحة", 400, "INVALID_DATE")
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError("التاريخ غير صحيح", 400, "INVALID_DATE")
  }

  return date
}

export function weekStartDate(value: Date, timeZone: string) {
  const dateKey = localDateKey(value, timeZone)
  const localDate = dateKeyToUtc(dateKey)
  const day = localDate.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday)
  return localDate
}

export function weekStartFromDateKey(value: string) {
  const date = dateKeyToUtc(value)
  const day = date.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date
}

export function weekEndDate(weekStart: Date) {
  const end = new Date(weekStart)
  end.setUTCDate(end.getUTCDate() + 7)
  return end
}

export function normalizeDurationMinutes(
  value: unknown,
  maxMinutes = MAX_MANUAL_MINUTES,
) {
  const minutes =
    typeof value === "string" && value.trim()
      ? Number(value)
      : typeof value === "number"
        ? value
        : Number.NaN

  if (
    !Number.isInteger(minutes) ||
    minutes <= 0 ||
    minutes > maxMinutes
  ) {
    throw new ApiError(
      `المدة يجب أن تكون عدد دقائق صحيحًا بين 1 و${maxMinutes}`,
      400,
      "INVALID_DURATION",
    )
  }

  return minutes
}

export function durationMinutesBetween(startedAt: Date, endedAt: Date) {
  const milliseconds = endedAt.getTime() - startedAt.getTime()
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new ApiError("وقت الإيقاف يجب أن يكون بعد وقت البدء", 409, "INVALID_TIMER_RANGE")
  }

  return normalizeDurationMinutes(
    Math.max(1, Math.round(milliseconds / 60_000)),
    MAX_TIMER_MINUTES,
  )
}

export function canTransitionTimesheet(
  current: TimesheetStatusValue,
  next: TimesheetStatusValue,
) {
  const transitions: Record<TimesheetStatusValue, readonly TimesheetStatusValue[]> = {
    OPEN: ["SUBMITTED"],
    SUBMITTED: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: ["OPEN", "SUBMITTED"],
  }

  return transitions[current].includes(next)
}

export function assertTimesheetEditable(status: TimesheetStatusValue) {
  if (status === "SUBMITTED" || status === "APPROVED") {
    throw new ApiError(
      status === "APPROVED"
        ? "سجل الساعات معتمد ومقفل"
        : "سجل الساعات مرسل للاعتماد ولا يمكن تعديله",
      409,
      status === "APPROVED" ? "TIMESHEET_APPROVED_LOCKED" : "TIMESHEET_SUBMITTED_LOCKED",
    )
  }
}

export function utilizationPercent(
  trackedMinutes: number,
  capacityHours: number,
) {
  if (!Number.isFinite(capacityHours) || capacityHours <= 0) return 0
  return Math.round((trackedMinutes / (capacityHours * 60)) * 1000) / 10
}

export function amountForMinutes(
  minutes: number,
  hourlyAmount: number,
) {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error("INVALID_MINUTES")
  }
  if (!Number.isFinite(hourlyAmount) || hourlyAmount < 0) {
    throw new Error("INVALID_HOURLY_AMOUNT")
  }

  return Math.round((minutes / 60) * hourlyAmount * 100) / 100
}

export function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${hours}:${remainder.toString().padStart(2, "0")}`
}
