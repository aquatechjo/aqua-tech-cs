import { z } from "zod"

export const PROJECT_CHANGE_REQUEST_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "APPLIED",
  "CANCELLED",
] as const

export type ProjectChangeRequestStatus =
  (typeof PROJECT_CHANGE_REQUEST_STATUSES)[number]

export const PROJECT_CHANGE_COMMERCIAL_IMPACTS = [
  "NONE",
  "REQUIRES_QUOTE",
  "APPROVED",
] as const

export type ProjectChangeCommercialImpact =
  (typeof PROJECT_CHANGE_COMMERCIAL_IMPACTS)[number]

export const PROJECT_CHANGE_ITEM_ACTIONS = [
  "ADD_DELIVERABLE",
  "MODIFY_DELIVERABLE",
  "CANCEL_DELIVERABLE",
] as const

export type ProjectChangeItemAction =
  (typeof PROJECT_CHANGE_ITEM_ACTIONS)[number]

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable()

const baseDeliverableFields = {
  description: optionalText(4000),
  acceptanceCriteria: optionalText(4000),
  phaseId: z.string().trim().min(1).optional().nullable(),
  dueDate: z.iso.date().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}

export const projectChangeItemInputSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("ADD_DELIVERABLE"),
      title: z.string().trim().min(3).max(300),
      ...baseDeliverableFields,
    }),
    z.object({
      action: z.literal("MODIFY_DELIVERABLE"),
      targetDeliverableId: z.string().trim().min(1),
      title: z.string().trim().min(3).max(300),
      ...baseDeliverableFields,
    }),
    z.object({
      action: z.literal("CANCEL_DELIVERABLE"),
      targetDeliverableId: z.string().trim().min(1),
      reason: z.string().trim().min(3).max(1000),
    }),
  ],
)

export type ProjectChangeItemInput = z.infer<
  typeof projectChangeItemInputSchema
>

const projectChangeDraftObject = z.object({
  title: z.string().trim().min(3).max(300),
  businessReason: z.string().trim().min(3).max(4000),
  scheduleImpactDays: z.number().int().min(-3650).max(3650),
  commercialImpact: z.enum(PROJECT_CHANGE_COMMERCIAL_IMPACTS),
  commercialReference: optionalText(500),
  clientApprovalRequired: z.boolean(),
  clientApprovalReference: optionalText(500),
  items: z.array(projectChangeItemInputSchema).min(1).max(50),
})

type ProjectChangeDraftValue = z.infer<typeof projectChangeDraftObject>

function validateProjectChangeDraft(
  value: ProjectChangeDraftValue,
  context: z.RefinementCtx,
) {
  const targetIds = value.items.flatMap((item) =>
    "targetDeliverableId" in item
      ? [item.targetDeliverableId]
      : [],
  )

  const duplicateTarget = targetIds.find(
    (targetId, index) => targetIds.indexOf(targetId) !== index,
  )
  if (duplicateTarget) {
    context.addIssue({
      code: "custom",
      path: ["items"],
      message:
        "لا يمكن تعديل التسليم نفسه أو إلغاؤه أكثر من مرة داخل طلب واحد",
    })
  }

  if (
    value.commercialImpact === "APPROVED" &&
    (value.commercialReference?.trim().length ?? 0) < 3
  ) {
    context.addIssue({
      code: "custom",
      path: ["commercialReference"],
      message: "أدخل مرجع الأثر التجاري المعتمد",
    })
  }
}

export const projectChangeDraftSchema =
  projectChangeDraftObject.superRefine(validateProjectChangeDraft)

const projectChangeDraftMutationSchema = projectChangeDraftObject
  .extend({
    action: z.literal("UPDATE_DRAFT"),
  })
  .superRefine(validateProjectChangeDraft)

export const projectChangeMutationSchema = z.union([
  projectChangeDraftMutationSchema,
  z.object({ action: z.literal("SUBMIT") }),
  z.object({
    action: z.literal("REQUEST_CHANGES"),
    reviewNotes: z.string().trim().min(3).max(4000),
  }),
  z.object({
    action: z.literal("APPROVE"),
    reviewNotes: optionalText(4000),
    clientApprovalReference: optionalText(500),
  }),
  z.object({
    action: z.literal("REJECT"),
    reviewNotes: z.string().trim().min(3).max(4000),
  }),
  z.object({ action: z.literal("APPLY") }),
  z.object({
    action: z.literal("CANCEL"),
    reviewNotes: z.string().trim().min(3).max(4000),
  }),
])

export type ProjectChangeMutation = z.infer<
  typeof projectChangeMutationSchema
>

const ACTION_ALLOWED_FROM: Record<
  Exclude<ProjectChangeMutation["action"], "UPDATE_DRAFT">,
  readonly ProjectChangeRequestStatus[]
> = {
  SUBMIT: ["DRAFT", "CHANGES_REQUESTED"],
  REQUEST_CHANGES: ["IN_REVIEW"],
  APPROVE: ["IN_REVIEW"],
  REJECT: ["IN_REVIEW"],
  APPLY: ["APPROVED"],
  CANCEL: ["DRAFT", "CHANGES_REQUESTED", "IN_REVIEW"],
}

export function projectChangeActionIssues({
  status,
  action,
  itemCount,
  clientApprovalRequired,
  clientApprovalReference,
  commercialImpact,
  commercialReference,
}: {
  status: ProjectChangeRequestStatus
  action: Exclude<ProjectChangeMutation["action"], "UPDATE_DRAFT">
  itemCount: number
  clientApprovalRequired: boolean
  clientApprovalReference?: string | null
  commercialImpact: ProjectChangeCommercialImpact
  commercialReference?: string | null
}) {
  const issues: string[] = []

  if (!ACTION_ALLOWED_FROM[action].includes(status)) {
    issues.push(`لا يمكن تنفيذ ${action} من حالة ${status}`)
  }

  if (action === "SUBMIT" && itemCount < 1) {
    issues.push("أضف بند تغيير واحدًا على الأقل قبل الإرسال")
  }

  if (
    action === "APPROVE" &&
    clientApprovalRequired &&
    (clientApprovalReference?.trim().length ?? 0) < 3
  ) {
    issues.push("يتطلب الاعتماد مرجع موافقة العميل")
  }

  if (
    action === "APPROVE" &&
    commercialImpact === "REQUIRES_QUOTE"
  ) {
    issues.push("لا يمكن اعتماد الطلب قبل إكمال التسعير التجاري")
  }

  if (
    action === "APPROVE" &&
    commercialImpact === "APPROVED" &&
    (commercialReference?.trim().length ?? 0) < 3
  ) {
    issues.push("يتطلب الأثر التجاري المعتمد مرجعًا واضحًا")
  }

  return issues
}

export function projectChangeTargetIssues({
  action,
  targetStatus,
}: {
  action: ProjectChangeItemAction
  targetStatus?: string | null
}) {
  if (action === "ADD_DELIVERABLE") return []
  if (!targetStatus) return ["التسليم المستهدف غير موجود داخل المشروع"]
  if (["ACCEPTED", "CANCELLED"].includes(targetStatus)) {
    return ["لا يمكن تغيير تسليم معتمد أو ملغى"]
  }
  return []
}

export function projectChangeResultSourceRef(
  changeRequestId: string,
  itemId: string,
) {
  return `change:${changeRequestId}:item:${itemId}`
}
