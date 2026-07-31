import { z } from "zod"

import type { ProposalVersionContent } from "@/lib/proposal"

export const PROJECT_DELIVERABLE_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "ACCEPTED",
  "CANCELLED",
] as const

export type ProjectDeliverableStatus =
  (typeof PROJECT_DELIVERABLE_STATUSES)[number]

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable()

export const projectDeliverableCreateSchema = z.object({
  title: z.string().trim().min(3).max(300),
  description: optionalText(4000),
  acceptanceCriteria: optionalText(4000),
  phaseId: z.string().trim().min(1).optional().nullable(),
  dueDate: z.iso.date().optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

export const projectDeliverableUpdateSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("UPDATE_DETAILS"),
      title: z.string().trim().min(3).max(300).optional(),
      description: optionalText(4000),
      acceptanceCriteria: optionalText(4000),
      phaseId: z.string().trim().min(1).optional().nullable(),
      dueDate: z.iso.date().optional().nullable(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
    }),
    z.object({
      action: z.literal("TRANSITION"),
      status: z.enum(PROJECT_DELIVERABLE_STATUSES),
      reviewNotes: optionalText(4000),
      acceptanceReference: optionalText(500),
    }),
  ],
)

const TRANSITIONS: Record<
  ProjectDeliverableStatus,
  readonly ProjectDeliverableStatus[]
> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PLANNED", "READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: [
    "IN_PROGRESS",
    "CHANGES_REQUESTED",
    "ACCEPTED",
    "CANCELLED",
  ],
  CHANGES_REQUESTED: ["IN_PROGRESS", "CANCELLED"],
  ACCEPTED: [],
  CANCELLED: [],
}

export function projectDeliverableTransitionIssues({
  currentStatus,
  nextStatus,
  reviewNotes,
  acceptanceReference,
}: {
  currentStatus: ProjectDeliverableStatus
  nextStatus: ProjectDeliverableStatus
  reviewNotes?: string | null
  acceptanceReference?: string | null
}) {
  const issues: string[] = []

  if (currentStatus === nextStatus) {
    issues.push("حالة التسليم لم تتغير")
    return issues
  }

  if (!TRANSITIONS[currentStatus].includes(nextStatus)) {
    issues.push(
      `لا يمكن نقل التسليم من ${currentStatus} إلى ${nextStatus}`,
    )
  }

  const note = reviewNotes?.trim() ?? ""
  if (
    ["CHANGES_REQUESTED", "CANCELLED"].includes(nextStatus) &&
    note.length < 3
  ) {
    issues.push("أدخل ملاحظة توضح سبب القرار")
  }

  if (
    nextStatus === "ACCEPTED" &&
    (acceptanceReference?.trim().length ?? 0) < 3
  ) {
    issues.push("أدخل مرجع اعتماد واضحًا مثل البريد أو محضر الاجتماع")
  }

  return issues
}

export function projectDeliverableNeedsActivation(
  status: ProjectDeliverableStatus,
) {
  return !["PLANNED", "CANCELLED"].includes(status)
}

export function acceptedProposalDeliverableSeeds({
  workspaceId,
  version,
  content,
}: {
  workspaceId: string
  version: number
  content: ProposalVersionContent
}) {
  return content.commercial.items
    .filter((item) => item.kind === "DELIVERABLE")
    .map((item, index) => ({
      title: item.title.trim(),
      description: item.description.trim() || null,
      acceptanceCriteria: null,
      sourceRef: `proposal:${workspaceId}:v${version}:item:${item.id}`,
      sortOrder: index,
    }))
}
