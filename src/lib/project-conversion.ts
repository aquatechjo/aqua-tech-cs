import { z } from "zod"

import type { ProposalVersionContent } from "@/lib/proposal"

export const acceptedProposalProjectConversionInputSchema = z.object({
  projectName: z.string().trim().min(3).max(300),
  workflowTemplateId: z.string().trim().min(10).max(191),
  acceptanceConfirmed: z.literal(true),
})

export type AcceptedProposalProjectConversionInput = z.infer<
  typeof acceptedProposalProjectConversionInputSchema
>

export type AcceptedProposalConversionSnapshot = {
  workspaceStatus: string
  sentVersion: number | null
  sentClientContentHash: string | null
  version: {
    version: number
    contentHash: string
    clientContentHash: string
  } | null
  response: {
    id: string
    decision: string
    version: number
    clientContentHash: string
    authorityConfirmed: boolean
  } | null
}

export function acceptedProposalConversionIssues(
  snapshot: AcceptedProposalConversionSnapshot,
) {
  const issues: string[] = []

  if (snapshot.workspaceStatus !== "ACCEPTED") {
    issues.push("يجب أن يكون العرض مقبولًا من العميل")
  }
  if (!snapshot.sentVersion || !snapshot.sentClientContentHash) {
    issues.push("مرجع الإصدار المرسل غير مكتمل")
  }
  if (!snapshot.response || snapshot.response.decision !== "ACCEPTED") {
    issues.push("رد القبول الموثق غير موجود")
  } else if (!snapshot.response.authorityConfirmed) {
    issues.push("صلاحية ممثل العميل غير مؤكدة")
  }
  if (!snapshot.version) {
    issues.push("إصدار العرض المقبول غير موجود")
  }

  if (
    snapshot.sentVersion &&
    snapshot.response &&
    snapshot.response.version !== snapshot.sentVersion
  ) {
    issues.push("رد العميل لا يطابق الإصدار المرسل")
  }
  if (
    snapshot.sentVersion &&
    snapshot.version &&
    snapshot.version.version !== snapshot.sentVersion
  ) {
    issues.push("نسخة العرض لا تطابق الإصدار المرسل")
  }
  if (
    snapshot.sentClientContentHash &&
    snapshot.response &&
    snapshot.response.clientContentHash !==
      snapshot.sentClientContentHash
  ) {
    issues.push("رد العميل لا يطابق محتوى النسخة المرسلة")
  }
  if (
    snapshot.sentClientContentHash &&
    snapshot.version &&
    snapshot.version.clientContentHash !==
      snapshot.sentClientContentHash
  ) {
    issues.push("Hash نسخة العميل لا يطابق النسخة المرسلة")
  }

  return issues
}

export type ClientCandidateResolution =
  | { status: "NONE"; clientId: null }
  | { status: "MATCHED"; clientId: string }
  | { status: "AMBIGUOUS"; clientId: null }

export function resolveClientCandidateIds(
  candidateIds: readonly string[],
): ClientCandidateResolution {
  const uniqueIds = [
    ...new Set(candidateIds.map((id) => id.trim()).filter(Boolean)),
  ]

  if (uniqueIds.length === 0) {
    return { status: "NONE", clientId: null }
  }
  if (uniqueIds.length === 1) {
    return { status: "MATCHED", clientId: uniqueIds[0] }
  }
  return { status: "AMBIGUOUS", clientId: null }
}

export function acceptedProposalProjectCode(proposalNumber: string) {
  const normalized = proposalNumber.trim().toUpperCase()
  return normalized.startsWith("PROP")
    ? normalized.replace(/^PROP/, "PRJ")
    : `PRJ-${normalized}`
}

export function acceptedProposalProjectDescription({
  proposalNumber,
  version,
  content,
}: {
  proposalNumber: string
  version: number
  content: ProposalVersionContent
}) {
  const clientSummary = content.sections
    .filter(
      (section) =>
        section.audience === "CLIENT" &&
        ["SUMMARY", "OBJECTIVES", "APPROACH"].includes(section.kind),
    )
    .slice(0, 3)
    .map((section) => `${section.title}\n${section.body}`)
    .join("\n\n")
    .slice(0, 4000)

  return [
    `مرجع العرض المقبول: ${proposalNumber} · الإصدار ${version}`,
    `عنوان العرض: ${content.title}`,
    content.estimatedDuration
      ? `المدة التقديرية: ${content.estimatedDuration}`
      : null,
    clientSummary || null,
  ]
    .filter(Boolean)
    .join("\n\n")
}
