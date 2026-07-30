export type ProjectReadinessSnapshot = {
  projectStatus: string
  workflowStatus: string | null
  contractRequired: boolean
  contractStatus: "PENDING" | "SIGNED"
  paymentRequired: boolean
  requiredPaymentAmount: string | null
  paidAmount: string
  overrideGrantedAt: Date | string | null
  activatedAt: Date | string | null
}

export type ProjectReadinessState =
  | "BLOCKED"
  | "READY"
  | "ACTIVATED"

function decimalMinorUnits(value: string | null | undefined) {
  if (!value) return null
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null

  const normalized = `${match[1]}${(match[2] ?? "").padEnd(2, "0")}`
    .replace(/^0+(?=\d)/, "")
  return normalized || "0"
}

function decimalAtLeast(
  value: string,
  required: string,
) {
  if (value.length !== required.length) {
    return value.length > required.length
  }
  return value >= required
}

export function projectReadinessIssues(
  snapshot: ProjectReadinessSnapshot,
) {
  const issues: string[] = []

  if (snapshot.activatedAt) return issues

  if (snapshot.projectStatus !== "PLANNING") {
    issues.push("يجب أن يكون المشروع في حالة التخطيط قبل التفعيل")
  }
  if (!snapshot.workflowStatus) {
    issues.push("سير عمل المشروع غير موجود")
  } else if (snapshot.workflowStatus !== "NOT_STARTED") {
    issues.push("يجب أن يكون سير العمل في حالة غير مبدوء")
  }

  if (!snapshot.overrideGrantedAt) {
    if (
      snapshot.contractRequired &&
      snapshot.contractStatus !== "SIGNED"
    ) {
      issues.push("العقد المطلوب غير موقّع أو غير موثّق")
    }

    if (snapshot.paymentRequired) {
      const required = decimalMinorUnits(
        snapshot.requiredPaymentAmount,
      )
      const paid = decimalMinorUnits(snapshot.paidAmount) ?? "0"

      if (required === null || required === "0") {
        issues.push("مبلغ الدفعة المطلوبة غير محدد")
      } else if (!decimalAtLeast(paid, required)) {
        issues.push("الدفعة المسجلة أقل من المبلغ المطلوب للبدء")
      }
    }
  }

  return issues
}

export function evaluateProjectReadiness(
  snapshot: ProjectReadinessSnapshot,
) {
  const issues = projectReadinessIssues(snapshot)
  const contractSatisfied =
    !snapshot.contractRequired ||
    snapshot.contractStatus === "SIGNED" ||
    Boolean(snapshot.overrideGrantedAt)
  const required =
    decimalMinorUnits(snapshot.requiredPaymentAmount) ?? "0"
  const paid = decimalMinorUnits(snapshot.paidAmount) ?? "0"
  const paymentSatisfied =
    !snapshot.paymentRequired ||
    Boolean(snapshot.overrideGrantedAt) ||
    (required !== "0" && decimalAtLeast(paid, required))

  const state: ProjectReadinessState = snapshot.activatedAt
    ? "ACTIVATED"
    : issues.length === 0
      ? "READY"
      : "BLOCKED"

  return {
    state,
    issues,
    contractSatisfied,
    paymentSatisfied,
    readyToActivate: state === "READY",
  }
}

export function projectExecutionNeedsActivation({
  assignedToId,
  progress,
  status,
}: {
  assignedToId?: string | null
  progress?: number
  status?: string
}) {
  return (
    Boolean(assignedToId) ||
    Boolean(progress && progress > 0) ||
    Boolean(
      status &&
        !["TODO", "PLANNED", "CANCELLED", "ARCHIVED"].includes(
          status,
        ),
    )
  )
}

export function projectExecutionIsActivated(
  readiness: { activatedAt: Date | string | null } | null,
) {
  return Boolean(readiness?.activatedAt)
}
