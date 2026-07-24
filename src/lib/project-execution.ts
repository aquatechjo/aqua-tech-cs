import { ApiError } from "@/lib/api-response"

const MAX_PHASE_CODE_LENGTH = 40

export type DependencyEdge = {
  taskId: string
  dependsOnTaskId: string
}

export type MyDayBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "LATER" | "NO_DUE_DATE"

export function normalizePhaseCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_PHASE_CODE_LENGTH)
}

export function assertProgress(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new ApiError(
      "نسبة الإنجاز يجب أن تكون رقمًا صحيحًا بين 0 و100",
      400,
      "INVALID_PROGRESS"
    )
  }

  return value
}

export function averageProgress(values: readonly number[]) {
  if (values.length === 0) return 0

  const total = values.reduce((sum, value) => sum + assertProgress(value), 0)
  return Math.round(total / values.length)
}

export function wouldCreateDependencyCycle(
  taskId: string,
  dependsOnTaskId: string,
  existingEdges: readonly DependencyEdge[]
) {
  if (taskId === dependsOnTaskId) return true

  const adjacency = new Map<string, string[]>()

  for (const edge of existingEdges) {
    const dependencies = adjacency.get(edge.taskId) ?? []
    dependencies.push(edge.dependsOnTaskId)
    adjacency.set(edge.taskId, dependencies)
  }

  const stack = [dependsOnTaskId]
  const visited = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()

    if (!current || visited.has(current)) continue
    if (current === taskId) return true

    visited.add(current)
    stack.push(...(adjacency.get(current) ?? []))
  }

  return false
}

function dateKeyInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new ApiError("تعذر تحديد التاريخ المحلي", 500, "DATE_FORMAT_ERROR")
  }

  return `${year}-${month}-${day}`
}

function utcDayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

export function classifyMyDayDueDate(
  dueDate: Date | null,
  now: Date,
  timeZone: string,
  upcomingDays = 7
): MyDayBucket {
  if (!dueDate) return "NO_DUE_DATE"

  const difference =
    utcDayNumber(dateKeyInTimeZone(dueDate, timeZone)) -
    utcDayNumber(dateKeyInTimeZone(now, timeZone))

  if (difference < 0) return "OVERDUE"
  if (difference === 0) return "TODAY"
  if (difference <= upcomingDays) return "UPCOMING"
  return "LATER"
}
