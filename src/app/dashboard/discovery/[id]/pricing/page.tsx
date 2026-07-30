import { notFound, redirect } from "next/navigation"

import {
  ACCESS_ROLES,
  canApprovePricing,
  hasRole,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { discoveryReportContentSchema } from "@/lib/discovery-report"
import {
  createInitialPricingDraft,
  pricingVersionContentSchema,
} from "@/lib/pricing"
import { prisma } from "@/lib/prisma"

import PricingWorkspaceClient from "./PricingWorkspaceClient"

export default async function PricingWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.pricingRead)) {
    redirect("/dashboard")
  }

  const { id } = await params
  const session = await prisma.intakeSession.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
    select: {
      id: true,
      status: true,
      serviceTrack: true,
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          serviceType: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
          stage: true,
        },
      },
      report: {
        select: {
          id: true,
          status: true,
          currentVersion: true,
          versions: {
            orderBy: {
              version: "desc",
            },
            take: 1,
            select: {
              version: true,
              content: true,
              contentHash: true,
            },
          },
        },
      },
      pricingWorkspace: {
        select: {
          id: true,
          status: true,
          currentVersion: true,
          reviewNotes: true,
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
              content: true,
              discoveryReportVersion: true,
              discoveryContentHash: true,
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
      },
    },
  })

  if (!session) notFound()

  if (
    session.status !== "COMPLETED" ||
    session.report?.status !== "APPROVED"
  ) {
    redirect(`/dashboard/discovery/${session.id}/report`)
  }

  const reportVersion = session.report.versions[0]
  const reportContent = discoveryReportContentSchema.safeParse(
    reportVersion?.content,
  )

  if (
    !reportVersion ||
    reportVersion.version !== session.report.currentVersion ||
    !reportContent.success
  ) {
    notFound()
  }

  const displayName =
    session.lead.companyName || session.lead.contactName
  const workspace = session.pricingWorkspace
  const versions =
    workspace?.versions.map((version) => {
      const content = pricingVersionContentSchema.safeParse(
        version.content,
      )

      return {
        id: version.id,
        version: version.version,
        content: content.success ? content.data : null,
        discoveryReportVersion: version.discoveryReportVersion,
        discoveryContentHash: version.discoveryContentHash,
        createdAt: version.createdAt.toISOString(),
        createdBy: version.createdBy,
      }
    }) ?? []
  const currentVersion =
    versions.find(
      (version) => version.version === workspace?.currentVersion,
    ) ?? null

  return (
    <PricingWorkspaceClient
      key={`${workspace?.id ?? "new"}-${workspace?.currentVersion ?? 0}`}
      session={{
        id: session.id,
        serviceTrack: session.serviceTrack,
        lead: session.lead,
        opportunity: session.opportunity,
      }}
      displayName={displayName}
      report={{
        id: session.report.id,
        version: reportVersion.version,
        contentHash: reportVersion.contentHash,
        scopeItems: reportContent.data.scopeItems,
      }}
      workspace={
        workspace
          ? {
              ...workspace,
              submittedAt:
                workspace.submittedAt?.toISOString() ?? null,
              changesRequestedAt:
                workspace.changesRequestedAt?.toISOString() ?? null,
              approvedAt: workspace.approvedAt?.toISOString() ?? null,
              createdAt: workspace.createdAt.toISOString(),
              updatedAt: workspace.updatedAt.toISOString(),
              versions,
            }
          : null
      }
      initialDraft={
        currentVersion?.content ??
        createInitialPricingDraft({
          report: reportContent.data,
          currency: user.company.currency,
          displayName,
        })
      }
      canManage={hasRole(user.role, ACCESS_ROLES.pricingManagement)}
      canApprove={canApprovePricing(
        user,
        currentVersion?.createdBy?.id ?? null,
      )}
      approvalBlockedBySelf={
        Boolean(currentVersion?.createdBy?.id) &&
        currentVersion?.createdBy?.id === user.id &&
        user.role !== "OWNER"
      }
      timeZone={user.company.timezone}
    />
  )
}
