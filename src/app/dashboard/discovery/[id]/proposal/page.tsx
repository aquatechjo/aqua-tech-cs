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
          email: true,
          phone: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
          stage: true,
          contactName: true,
          companyName: true,
          serviceType: true,
          email: true,
          phone: true,
          project: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              originProposalWorkspaceId: true,
              proposalConvertedAt: true,
              workflow: {
                select: {
                  id: true,
                  templateName: true,
                  templateCode: true,
                  templateVersion: true,
                  status: true,
                },
              },
            },
          },
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
          sentVersion: true,
          sentClientContentHash: true,
          sentAt: true,
          clientRespondedAt: true,
          clientResponseName: true,
          clientResponseEmail: true,
          clientResponseTitle: true,
          clientResponseNotes: true,
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
          deliveries: {
            orderBy: {
              createdAt: "desc",
            },
            take: 12,
            select: {
              id: true,
              channel: true,
              status: true,
              version: true,
              recipientName: true,
              recipientEmail: true,
              recipientPhone: true,
              expiresAt: true,
              sentAt: true,
              firstViewedAt: true,
              lastViewedAt: true,
              viewCount: true,
              failureCode: true,
              createdAt: true,
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
  const canConvert = hasRole(
    user.role,
    ACCESS_ROLES.projectConversion,
  )
  const workflowTemplates =
    canConvert &&
    workspace?.status === "ACCEPTED" &&
    session.opportunity &&
    !session.opportunity.project
      ? await prisma.workflowTemplate.findMany({
          where: {
            companyId: user.companyId,
            isActive: true,
          },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            code: true,
            version: true,
            isDefault: true,
            description: true,
          },
        })
      : []

  return (
    <ProposalWorkspaceClient
      key={`${workspace?.id ?? "new"}-${workspace?.currentVersion ?? 0}`}
      session={{
        id: session.id,
        serviceTrack: session.serviceTrack,
        lead: session.lead,
        opportunity: session.opportunity
          ? {
              ...session.opportunity,
              project: session.opportunity.project
                ? {
                    ...session.opportunity.project,
                    proposalConvertedAt:
                      session.opportunity.project.proposalConvertedAt?.toISOString() ??
                      null,
                  }
                : null,
            }
          : null,
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
              sentAt: workspace.sentAt?.toISOString() ?? null,
              clientRespondedAt:
                workspace.clientRespondedAt?.toISOString() ?? null,
              createdAt: workspace.createdAt.toISOString(),
              updatedAt: workspace.updatedAt.toISOString(),
              versions,
              deliveries: workspace.deliveries.map((delivery) => ({
                ...delivery,
                expiresAt: delivery.expiresAt.toISOString(),
                sentAt: delivery.sentAt?.toISOString() ?? null,
                firstViewedAt:
                  delivery.firstViewedAt?.toISOString() ?? null,
                lastViewedAt:
                  delivery.lastViewedAt?.toISOString() ?? null,
                createdAt: delivery.createdAt.toISOString(),
              })),
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
      canDeliver={hasRole(
        user.role,
        ACCESS_ROLES.proposalDelivery,
      )}
      canConvert={canConvert}
      workflowTemplates={workflowTemplates}
      recipient={{
        name:
          session.opportunity?.contactName ??
          session.lead.contactName,
        email:
          session.opportunity?.email ??
          session.lead.email ??
          "",
        phone:
          session.opportunity?.phone ??
          session.lead.phone ??
          "",
      }}
      timeZone={user.company.timezone}
    />
  )
}
