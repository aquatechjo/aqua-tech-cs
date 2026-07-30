import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { ApiError } from "@/lib/api-response"
import { evaluateProjectReadiness } from "@/lib/project-readiness"

type ReadinessDb = Pick<
  Prisma.TransactionClient,
  "payment" | "projectReadiness"
>

export async function projectRecordedPaymentAmount(
  db: ReadinessDb,
  {
    companyId,
    projectId,
    currency,
  }: {
    companyId: string
    projectId: string
    currency: string
  },
) {
  const aggregate = await db.payment.aggregate({
    where: {
      companyId,
      status: "POSTED",
      currency,
      invoice: {
        companyId,
        projectId,
      },
    },
    _sum: {
      amount: true,
    },
  })

  return aggregate._sum.amount?.toString() ?? "0"
}

export async function getProjectReadinessSnapshot(
  db: ReadinessDb,
  {
    companyId,
    projectId,
    projectStatus,
    workflowStatus,
  }: {
    companyId: string
    projectId: string
    projectStatus: string
    workflowStatus: string | null
  },
) {
  const readiness = await db.projectReadiness.findFirst({
    where: {
      companyId,
      projectId,
    },
    include: {
      contractVerifiedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      paymentConfiguredBy: {
        select: {
          id: true,
          name: true,
        },
      },
      overrideGrantedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      activatedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!readiness) {
    throw new ApiError(
      "بوابة جاهزية المشروع غير موجودة",
      409,
      "PROJECT_READINESS_MISSING",
    )
  }

  const paidAmount = await projectRecordedPaymentAmount(db, {
    companyId,
    projectId,
    currency: readiness.currency,
  })
  const evaluation = evaluateProjectReadiness({
    projectStatus,
    workflowStatus,
    contractRequired: readiness.contractRequired,
    contractStatus: readiness.contractStatus,
    paymentRequired: readiness.paymentRequired,
    requiredPaymentAmount:
      readiness.requiredPaymentAmount?.toString() ?? null,
    paidAmount,
    overrideGrantedAt: readiness.overrideGrantedAt,
    activatedAt: readiness.activatedAt,
  })

  return {
    readiness,
    paidAmount,
    evaluation,
  }
}

export async function assertProjectExecutionActivated(
  db: Pick<Prisma.TransactionClient, "projectReadiness">,
  {
    companyId,
    projectId,
  }: {
    companyId: string
    projectId: string
  },
) {
  const readiness = await db.projectReadiness.findFirst({
    where: {
      companyId,
      projectId,
    },
    select: {
      activatedAt: true,
    },
  })

  if (!readiness?.activatedAt) {
    throw new ApiError(
      "أكمل بوابة الجاهزية وفعّل المشروع قبل توزيع الفريق أو بدء التنفيذ",
      409,
      "PROJECT_READINESS_REQUIRED",
    )
  }

  return readiness
}
