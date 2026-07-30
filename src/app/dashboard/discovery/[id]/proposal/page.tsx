import { notFound, redirect } from "next/navigation"

import {
  ACCESS_ROLES,
  canApproveProposal,
  hasRole,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { discoveryReportContentSchema } from "@/lib/discovery-report"
import { pricingVersionContentSchema } from "@/lib/pricing"
import {
  createInitialProposalDraft,
  proposalVersionContentSchema,
} from "@/lib/proposal"
import { prisma } from "@/lib/prisma"

import ProposalWorkspaceClient from "./ProposalWorkspaceClient"

export default async function ProposalWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.proposalRead)) {
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
          versions: {
            orderBy: {
              version: "desc",
            },
            take: 1,
            select: {
              version: true,
              content: true,
              contentHash: true,
              discoveryReportVersion: true,
              discoveryContentHash: true,
            },
          },
        },
      },
      proposalWorkspace: {
        select: {
          id: true,
          proposalNumber: true,
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
              clientContentHash: true,
              pricingVersion: true,
              pricingContentHash: true,
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
    session.pricingWorkspace?.status !== "APPROVED" ||
    session.pricingWorkspace.currentVersion < 1
  ) {
    redirect(`/dashboard/discovery/${session.id}/pricing`)
  }

  const reportVersion = session.report?.versions[0]
  const pricingVersion = session.pricingWorkspace.versions[0]
  const reportContent = discoveryReportContentSchema.safeParse(
    reportVersion?.content,
  )
  const pricingContent = pricingVersionContentSchema.safeParse(
    pricingVersion?.content,
  )

  if (
    !session.report ||
    !reportVersion ||
    reportVersion.version !== session.report.currentVersion ||
    !reportContent.success ||
    !pricingVersion ||
    pricingVersion.version !==
      session.pricingWorkspace.currentVersion ||
    !pricingContent.success
  ) {
    notFound()
  }

  const displayName =
    session.lead.companyName || session.lead.contactName
  const workspace = session.proposalWorkspace
  const versions =
    workspace?.versions.map((version) => {
      const content = proposalVersionContentSchema.safeParse(
        version.content,
      )

      return {
        ...version,
        content: content.success ? content.data : null,
        createdAt: version.createdAt.toISOString(),
      }
    }) ?? []
  const currentVersion =
    versions.find(
      (version) => version.version === workspace?.currentVersion,
    ) ?? null

  return (
    <ProposalWorkspaceClient
      key={`${workspace?.id ?? "new"}-${workspace?.currentVersion ?? 0}`}
      session={{
        id: session.id,
        serviceTrack: session.serviceTrack,
        lead: session.lead,
        opportunity: session.opportunity,
      }}
      displayName={displayName}
      source={{
        reportVersion: reportVersion.version,
        reportContentHash: reportVersion.contentHash,
        pricingVersion: pricingVersion.version,
        pricingContentHash: pricingVersion.contentHash,
      }}
      pricing={pricingContent.data}
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
        currentVersion?.content
          ? {
              title: currentVersion.content.title,
              validityDays: currentVersion.content.validityDays,
              estimatedDuration:
                currentVersion.content.estimatedDuration,
              sections: currentVersion.content.sections,
              paymentMilestones:
                currentVersion.content.paymentMilestones,
            }
          : createInitialProposalDraft({
              report: reportContent.data,
              pricing: pricingContent.data,
              displayName,
            })
      }
      canManage={hasRole(
        user.role,
        ACCESS_ROLES.proposalManagement,
      )}
      canApprove={canApproveProposal(
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
