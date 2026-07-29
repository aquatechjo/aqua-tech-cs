import { notFound, redirect } from "next/navigation"

import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import DiscoveryIntakeClient from "./DiscoveryIntakeClient"

export default async function DiscoverySessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.discoveryRead)) {
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
      templateVersion: true,
      status: true,
      completionScore: true,
      currentSection: true,
      internalSummary: true,
      readyForReviewAt: true,
      createdAt: true,
      updatedAt: true,
      lead: {
        select: {
          id: true,
          contactName: true,
          companyName: true,
          email: true,
          phone: true,
          serviceType: true,
          status: true,
          source: true,
          priority: true,
          nextAction: true,
          nextActionAt: true,
          serviceRequest: {
            select: {
              id: true,
              budgetRange: true,
              timeline: true,
              message: true,
            },
          },
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
          stage: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      answers: {
        orderBy: {
          updatedAt: "asc",
        },
        select: {
          id: true,
          questionKey: true,
          questionLabel: true,
          sectionKey: true,
          value: true,
          source: true,
          isUnknown: true,
          capturedAt: true,
          updatedAt: true,
        },
      },
      gaps: {
        orderBy: [
          { status: "asc" },
          { severity: "desc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          questionKey: true,
          title: true,
          severity: true,
          status: true,
          resolution: true,
          resolvedAt: true,
          resolvedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!session) {
    notFound()
  }

  return (
    <DiscoveryIntakeClient
      session={{
        ...session,
        readyForReviewAt:
          session.readyForReviewAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        lead: {
          ...session.lead,
          nextActionAt:
            session.lead.nextActionAt?.toISOString() ?? null,
        },
        answers: session.answers.map((answer) => ({
          ...answer,
          capturedAt: answer.capturedAt.toISOString(),
          updatedAt: answer.updatedAt.toISOString(),
        })),
        gaps: session.gaps.map((gap) => ({
          ...gap,
          resolvedAt: gap.resolvedAt?.toISOString() ?? null,
          createdAt: gap.createdAt.toISOString(),
          updatedAt: gap.updatedAt.toISOString(),
        })),
      }}
      canManage={hasRole(
        user.role,
        ACCESS_ROLES.discoveryManagement,
      )}
      timeZone={user.company.timezone}
    />
  )
}
