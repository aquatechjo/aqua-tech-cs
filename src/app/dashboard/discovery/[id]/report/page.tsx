import { notFound, redirect } from "next/navigation"

import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import {
  discoveryReportContentSchema,
  EMPTY_DISCOVERY_REPORT_CONTENT,
} from "@/lib/discovery-report"
import {
  buildDiscoveryEvidenceSnapshot,
  discoveryEvidenceHash,
  discoveryReportSessionSelect,
} from "@/lib/discovery-report-server"
import { prisma } from "@/lib/prisma"

import DiscoveryReportClient from "./DiscoveryReportClient"

export default async function DiscoveryReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.discoveryReportRead)) {
    redirect("/dashboard")
  }

  const { id } = await params
  const session = await prisma.intakeSession.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
    select: discoveryReportSessionSelect,
  })

  if (!session) notFound()

  const report = await prisma.discoveryReport.findUnique({
    where: {
      intakeSessionId: session.id,
    },
    select: {
      id: true,
      status: true,
      currentVersion: true,
      reviewNotes: true,
      aiAuthorizedAt: true,
      submittedAt: true,
      changesRequestedAt: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      versions: {
        orderBy: {
          version: "desc",
        },
        select: {
          id: true,
          version: true,
          origin: true,
          content: true,
          evidenceInputHash: true,
          promptVersion: true,
          aiProvider: true,
          aiModel: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  const currentVersion =
    report?.versions.find(
      (version) => version.version === report.currentVersion,
    ) ?? null
  const parsedContent = discoveryReportContentSchema.safeParse(
    currentVersion?.content,
  )
  const currentEvidenceHash = discoveryEvidenceHash(
    buildDiscoveryEvidenceSnapshot(session),
  )
  const versions =
    report?.versions.map((version) => {
      const parsed = discoveryReportContentSchema.safeParse(
        version.content,
      )

      return {
        id: version.id,
        version: version.version,
        origin: version.origin,
        content: parsed.success ? parsed.data : null,
        evidenceInputHash: version.evidenceInputHash,
        promptVersion: version.promptVersion,
        aiProvider: version.aiProvider,
        aiModel: version.aiModel,
        createdAt: version.createdAt.toISOString(),
        createdBy: version.createdBy,
      }
    }) ?? []

  return (
    <DiscoveryReportClient
      key={`${report?.id ?? "new"}-${report?.currentVersion ?? 0}`}
      session={{
        id: session.id,
        status: session.status,
        serviceTrack: session.serviceTrack,
        completionScore: session.completionScore,
        lead: {
          id: session.lead.id,
          serviceType: session.lead.serviceType,
        },
        opportunity: session.opportunity,
      }}
      displayName={
        session.lead.companyName || session.lead.contactName
      }
      report={
        report
          ? {
              ...report,
              aiAuthorizedAt:
                report.aiAuthorizedAt?.toISOString() ?? null,
              submittedAt: report.submittedAt?.toISOString() ?? null,
              changesRequestedAt:
                report.changesRequestedAt?.toISOString() ?? null,
              approvedAt: report.approvedAt?.toISOString() ?? null,
              createdAt: report.createdAt.toISOString(),
              updatedAt: report.updatedAt.toISOString(),
              versions,
            }
          : null
      }
      initialContent={
        parsedContent.success
          ? parsedContent.data
          : EMPTY_DISCOVERY_REPORT_CONTENT
      }
      currentVersionOrigin={currentVersion?.origin ?? null}
      currentVersionEvidenceHash={
        currentVersion?.evidenceInputHash ?? null
      }
      currentEvidenceHash={currentEvidenceHash}
      canManage={hasRole(
        user.role,
        ACCESS_ROLES.discoveryReportManagement,
      )}
      canApprove={hasRole(
        user.role,
        ACCESS_ROLES.discoveryReportApproval,
      )}
      aiConfigured={Boolean(process.env.OPENAI_API_KEY?.trim())}
      aiModel={
        process.env.OPENAI_DISCOVERY_MODEL?.trim() || "gpt-5.6-sol"
      }
      timeZone={user.company.timezone}
    />
  )
}
