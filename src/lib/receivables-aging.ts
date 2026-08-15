export const RECEIVABLE_BUCKETS = ["CURRENT", "DUE_1_30", "DUE_31_60", "DUE_61_90", "OVER_90", "UNSCHEDULED"] as const
export type ReceivableBucket = (typeof RECEIVABLE_BUCKETS)[number]

export const receivableBucketLabels: Record<ReceivableBucket, string> = {
  CURRENT: "غير مستحقة",
  DUE_1_30: "متأخرة 1–30 يومًا",
  DUE_31_60: "متأخرة 31–60 يومًا",
  DUE_61_90: "متأخرة 61–90 يومًا",
  OVER_90: "متأخرة أكثر من 90 يومًا",
  UNSCHEDULED: "دون تاريخ استحقاق",
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function receivableBucketWhere(bucket: ReceivableBucket, asOf: Date) {
  if (bucket === "CURRENT") return { dueDate: { gte: asOf } }
  if (bucket === "DUE_1_30") return { dueDate: { gte: addDays(asOf, -30), lt: asOf } }
  if (bucket === "DUE_31_60") return { dueDate: { gte: addDays(asOf, -60), lt: addDays(asOf, -30) } }
  if (bucket === "DUE_61_90") return { dueDate: { gte: addDays(asOf, -90), lt: addDays(asOf, -60) } }
  if (bucket === "OVER_90") return { dueDate: { lt: addDays(asOf, -90) } }
  return { dueDate: null }
}

export function receivableAgeBucket(dueDate: Date | string | null, asOf: Date): ReceivableBucket {
  if (!dueDate) return "UNSCHEDULED"
  const daysOverdue = Math.ceil((asOf.getTime() - new Date(dueDate).getTime()) / (24 * 60 * 60 * 1000))
  if (daysOverdue <= 0) return "CURRENT"
  if (daysOverdue <= 30) return "DUE_1_30"
  if (daysOverdue <= 60) return "DUE_31_60"
  if (daysOverdue <= 90) return "DUE_61_90"
  return "OVER_90"
}

export function isReceivableBucket(value: string | undefined): value is ReceivableBucket {
  return Boolean(value && (RECEIVABLE_BUCKETS as readonly string[]).includes(value))
}
