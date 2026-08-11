import { z } from "zod"

export const PROJECT_CONTRACT_AMENDMENT_STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "INTERNALLY_APPROVED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
] as const

export type ProjectContractAmendmentStatus =
  (typeof PROJECT_CONTRACT_AMENDMENT_STATUSES)[number]

export const projectContractAmendmentMutationSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("CREATE"),
      internalNotes: z.string().trim().max(4000).optional().nullable(),
    }),
    z.object({ action: z.literal("READY_FOR_REVIEW") }),
    z.object({
      action: z.literal("INTERNALLY_APPROVE"),
      reference: z.string().trim().min(3).max(500),
    }),
    z.object({
      action: z.literal("MARK_SENT"),
      reference: z.string().trim().min(3).max(500),
    }),
    z.object({
      action: z.enum(["ACCEPT", "REJECT"]),
      reference: z.string().trim().min(3).max(500),
      notes: z.string().trim().max(4000).optional().nullable(),
    }),
    z.object({
      action: z.literal("APPLY_IMPACT"),
      reference: z.string().trim().min(3).max(500),
    }),
  ],
)

export type ProjectContractAmendmentMutation = z.infer<
  typeof projectContractAmendmentMutationSchema
>

const allowedFrom: Record<
  Exclude<ProjectContractAmendmentMutation["action"], "CREATE">,
  readonly ProjectContractAmendmentStatus[]
> = {
  READY_FOR_REVIEW: ["DRAFT"],
  INTERNALLY_APPROVE: ["READY_FOR_REVIEW"],
  MARK_SENT: ["INTERNALLY_APPROVED"],
  ACCEPT: ["SENT"],
  REJECT: ["SENT"],
  APPLY_IMPACT: ["ACCEPTED"],
}

export function amendmentImpactIssues({
  impactAppliedAt,
  projectBudget,
  projectCurrency,
  amendmentCurrency,
  scheduleImpactDays,
  projectDueDate,
}: {
  impactAppliedAt?: Date | string | null
  projectBudget?: string | number | null
  projectCurrency: string
  amendmentCurrency: string
  scheduleImpactDays: number
  projectDueDate?: Date | string | null
}) {
  const issues: string[] = []
  if (impactAppliedAt) issues.push("تم تطبيق أثر هذا الملحق مسبقًا")
  if (projectBudget === null || projectBudget === undefined) {
    issues.push("يجب تثبيت ميزانية أساس للمشروع قبل تطبيق الملحق")
  }
  if (projectCurrency !== amendmentCurrency) {
    issues.push("عملة الملحق لا تطابق عملة ميزانية المشروع")
  }
  if (scheduleImpactDays !== 0 && !projectDueDate) {
    issues.push("يجب تثبيت تاريخ استحقاق للمشروع قبل تطبيق الأثر الزمني")
  }
  return issues
}

export function applyAmendmentImpact({
  projectBudget,
  amendmentAmount,
  projectDueDate,
  scheduleImpactDays,
}: {
  projectBudget: string | number
  amendmentAmount: string | number
  projectDueDate?: Date | string | null
  scheduleImpactDays: number
}) {
  const toMinor = (value: string | number) => {
    const normalized = String(value)
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
    if (!match) throw new Error("Invalid monetary snapshot")
    return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"))
  }
  const minor = toMinor(projectBudget) + toMinor(amendmentAmount)
  const budgetAfter = `${minor / BigInt(100)}.${String(minor % BigInt(100)).padStart(2, "0")}`
  const dueDateAfter = projectDueDate ? new Date(projectDueDate) : null
  if (dueDateAfter) dueDateAfter.setUTCDate(dueDateAfter.getUTCDate() + scheduleImpactDays)
  return { budgetAfter, dueDateAfter }
}

export function contractAmendmentActionIssues({
  status,
  action,
  creatorUserId,
  actor,
}: {
  status: ProjectContractAmendmentStatus
  action: Exclude<ProjectContractAmendmentMutation["action"], "CREATE">
  creatorUserId?: string | null
  actor: { id: string; role: string }
}) {
  const issues: string[] = []
  if (!allowedFrom[action].includes(status)) {
    issues.push(`لا يمكن تنفيذ ${action} من حالة ${status}`)
  }
  if (
    action === "INTERNALLY_APPROVE" &&
    actor.role !== "OWNER" &&
    creatorUserId === actor.id
  ) {
    issues.push("لا يمكن لمن أنشأ الملحق اعتماده داخليًا")
  }
  return issues
}
