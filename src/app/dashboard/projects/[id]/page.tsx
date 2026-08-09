import type { Prisma } from "@/generated/prisma/client"
import { notFound } from "next/navigation"

import {
  ACCESS_ROLES,
  canApproveProjectChange,
  canAssignTaskOwner,
  canEditTask,
  canManageProjectExecution,
  canManageProjectLeadership,
  canManageProjectReadiness,
  canManageTaskParticipants,
  canOverrideProjectReadiness,
  hasRole,
} from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { averageProgress } from "@/lib/project-execution"
import { localDateKey } from "@/lib/finance"
import {
  buildProjectVisibilityWhere,
  projectScopeFromTaskScope,
  projectScopeLabel,
} from "@/lib/project-scope"
import { prisma } from "@/lib/prisma"
import { getProjectReadinessSnapshot } from "@/lib/project-readiness-server"
import { buildTaskVisibilityWhere } from "@/lib/task-scope"
import { resolveTaskAccessScope } from "@/lib/task-scope-server"

import ProjectExecutionClient from "./ProjectExecutionClient"

export default async function ProjectExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()
  const { id } = await params
  const taskScope = await resolveTaskAccessScope(user)
  const projectScope = projectScopeFromTaskScope(
    user.role,
    taskScope
  )
  const taskVisibilityWhere =
    buildTaskVisibilityWhere(taskScope)

  const project = await prisma.project.findFirst({
    where: {
      id,
      companyId: user.companyId,
      ...buildProjectVisibilityWhere(projectScope),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      workflow: {
        include: {
          approvals: {
            select: {
              status: true,
            },
          },
          rules: {
            where: {
              isActive: true,
            },
            select: {
              channel: true,
            },
          },
        },
      },
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          employeeProfile: {
            select: {
              id: true,
              employeeNumber: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  isActive: true,
                },
              },
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
              jobRole: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      phases: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      deliverables: {
        orderBy: [
          { sortOrder: "asc" },
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          phase: {
            select: {
              id: true,
              name: true,
            },
          },
          decidedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      changeRequests: {
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          appliedBy: { select: { id: true, name: true } },
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              phase: { select: { id: true, name: true } },
              targetDeliverable: {
                select: { id: true, title: true },
              },
              resultDeliverable: {
                select: { id: true, title: true },
              },
            },
          },
        },
      },
      governanceItems: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          ownerUser: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
          sourceRisk: {
            select: { id: true, referenceNumber: true, title: true },
          },
          materializedIssue: {
            select: { id: true, referenceNumber: true, title: true },
          },
          supersedesDecision: {
            select: { id: true, referenceNumber: true, title: true },
          },
          supersededByDecision: {
            select: { id: true, referenceNumber: true, title: true },
          },
        },
      },
      closure: true,
      feedback: {
        include: {
          followUpTask: {
            select: { id: true, title: true, status: true },
          },
        },
      },
      tasks: {
        where: {
          status: {
            not: "ARCHIVED",
          },
          ...taskVisibilityWhere,
        },
        orderBy: [
          { sortOrder: "asc" },
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
        include: {
          phase: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          participants: {
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
              employeeProfile: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  jobRole: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          dependencies: {
            where: {
              dependsOnTask: taskVisibilityWhere,
            },
            include: {
              dependsOnTask: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  progress: true,
                },
              },
            },
          },
          blockers: {
            orderBy: [
              { status: "asc" },
              { severity: "desc" },
              { createdAt: "desc" },
            ],
            include: {
              reportedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              resolvedBy: {
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

  if (!project) notFound()

  const readinessSnapshot = await getProjectReadinessSnapshot(
    prisma,
    {
      companyId: user.companyId,
      projectId: project.id,
      projectStatus: project.status,
      workflowStatus: project.workflow?.status ?? null,
    },
  )
  const canViewReadinessFinance = hasRole(
    user.role,
    ACCESS_ROLES.financeRead,
  )

  const currentMembership = project.members.find(
    (member) => member.employeeProfile.user.id === user.id
  )
  const canManage = canManageProjectExecution(
    user,
    currentMembership?.role
  )
  const employeeWhere: Prisma.EmployeeProfileWhereInput = {
    companyId: user.companyId,
    status: "ACTIVE",
    user: {
      isActive: true,
      ...(taskScope.canViewCompanyTasks
        ? {}
        : {
            id: {
              in: [...taskScope.assignableUserIds],
            },
          }),
    },
  }
  const employees = await prisma.employeeProfile.findMany({
    where: employeeWhere,
    orderBy: {
      user: {
        name: "asc",
      },
    },
    select: {
      id: true,
      employeeNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      jobRole: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const tasks = project.tasks.map((task) => {
    const accessContext = {
      assignedToId: task.assignedToId,
      createdById: task.createdById,
      participants: task.participants.map((participant) => ({
        userId: participant.employeeProfile.user.id,
        role: participant.role,
      })),
      projectMemberRole: currentMembership?.role,
      managedUserIds: taskScope.managedUserIds,
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      phaseId: task.phaseId,
      phase: task.phase,
      assignedToId: task.assignedToId,
      assignedTo: task.assignedTo,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      estimatedHours:
        task.estimatedHours?.toString() ?? null,
      workflowTaskCode: task.workflowTaskCode,
      workflowOwnerRole: task.workflowOwnerRole,
      dueDate: task.dueDate?.toISOString() ?? null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt:
        task.completedAt?.toISOString() ?? null,
      canEdit: canEditTask(user, accessContext),
      canManageParticipants: canManageTaskParticipants(
        user,
        accessContext
      ),
      canAssignOwner: canAssignTaskOwner(
        user,
        currentMembership?.role
      ),
      participants: task.participants.map((participant) => ({
        id: participant.id,
        role: participant.role,
        employeeProfile: participant.employeeProfile,
      })),
      dependencies: task.dependencies.map((dependency) => ({
        id: dependency.id,
        type: dependency.type,
        dependsOnTaskId: dependency.dependsOnTaskId,
        dependsOnTask: dependency.dependsOnTask,
      })),
      blockers: task.blockers.map((blocker) => ({
        id: blocker.id,
        title: blocker.title,
        description: blocker.description,
        severity: blocker.severity,
        status: blocker.status,
        resolution: blocker.resolution,
        reportedBy: blocker.reportedBy,
        resolvedBy: blocker.resolvedBy,
        resolvedAt:
          blocker.resolvedAt?.toISOString() ?? null,
        createdAt: blocker.createdAt.toISOString(),
      })),
    }
  })

  const phases = project.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    code: phase.code,
    workflowStageCode: phase.workflowStageCode,
    description: phase.description,
    status: phase.status,
    progress: phase.progress,
    sortOrder: phase.sortOrder,
    startDate: phase.startDate?.toISOString() ?? null,
    dueDate: phase.dueDate?.toISOString() ?? null,
    completedAt:
      phase.completedAt?.toISOString() ?? null,
  }))

  return (
    <ProjectExecutionClient
      project={{
        id: project.id,
        name: project.name,
        code: project.code,
        description: project.description,
        status: project.status,
        priority: project.priority,
        client: project.client,
        startDate: project.startDate?.toISOString() ?? null,
        dueDate: project.dueDate?.toISOString() ?? null,
        originProposalWorkspaceId:
          project.originProposalWorkspaceId,
        originProposalVersion: project.originProposalVersion,
        clientAcceptedAt:
          project.clientAcceptedAt?.toISOString() ?? null,
        proposalConvertedAt:
          project.proposalConvertedAt?.toISOString() ?? null,
      }}
      workflow={
        project.workflow
          ? {
              templateName: project.workflow.templateName,
              templateCode: project.workflow.templateCode,
              templateVersion: project.workflow.templateVersion,
              status: project.workflow.status,
              approvalCount: project.workflow.approvals.length,
              pendingApprovalCount:
                project.workflow.approvals.filter(
                  (approval) =>
                    approval.status === "PENDING" ||
                    approval.status === "NOT_REQUESTED"
                ).length,
              notificationRuleCount:
                project.workflow.rules.filter(
                  (rule) => rule.channel !== "N8N_EVENT"
                ).length,
              n8nRuleCount: project.workflow.rules.filter(
                (rule) => rule.channel === "N8N_EVENT"
              ).length,
            }
          : null
      }
      readiness={{
        contractRequired:
          readinessSnapshot.readiness.contractRequired,
        contractStatus:
          readinessSnapshot.readiness.contractStatus,
        contractReference:
          readinessSnapshot.readiness.contractReference,
        contractSignedAt:
          readinessSnapshot.readiness.contractSignedAt?.toISOString() ??
          null,
        contractVerifiedAt:
          readinessSnapshot.readiness.contractVerifiedAt?.toISOString() ??
          null,
        contractVerifiedBy:
          readinessSnapshot.readiness.contractVerifiedBy,
        paymentRequired:
          readinessSnapshot.readiness.paymentRequired,
        requiredPaymentAmount: canViewReadinessFinance
          ? readinessSnapshot.readiness.requiredPaymentAmount?.toString() ??
            null
          : null,
        paidAmount: canViewReadinessFinance
          ? readinessSnapshot.paidAmount
          : null,
        currency: readinessSnapshot.readiness.currency,
        paymentConfiguredAt:
          readinessSnapshot.readiness.paymentConfiguredAt?.toISOString() ??
          null,
        paymentConfiguredBy:
          readinessSnapshot.readiness.paymentConfiguredBy,
        overrideReason:
          readinessSnapshot.readiness.overrideReason,
        overrideGrantedAt:
          readinessSnapshot.readiness.overrideGrantedAt?.toISOString() ??
          null,
        overrideGrantedBy:
          readinessSnapshot.readiness.overrideGrantedBy,
        activatedAt:
          readinessSnapshot.readiness.activatedAt?.toISOString() ??
          null,
        activatedBy:
          readinessSnapshot.readiness.activatedBy,
        state: readinessSnapshot.evaluation.state,
        issues: readinessSnapshot.evaluation.issues,
        contractSatisfied:
          readinessSnapshot.evaluation.contractSatisfied,
        paymentSatisfied:
          readinessSnapshot.evaluation.paymentSatisfied,
        readyToActivate:
          readinessSnapshot.evaluation.readyToActivate,
        businessDate: localDateKey(
          new Date(),
          user.company.timezone,
        ),
      }}
      scope={{
        label: projectScopeLabel(projectScope),
        dataScope: projectScope.dataScope,
        description:
          projectScope.dataScope === "company"
            ? "عرض تنفيذي كامل للمشروع."
            : projectScope.dataScope === "team"
              ? "تظهر مهام فريقك ومسؤولياتك داخل المشروع."
              : "تظهر مهامك ومسؤولياتك داخل المشروع فقط.",
      }}
      members={project.members.map((member) => ({
        id: member.id,
        role: member.role,
        responsibility: member.responsibility,
        employeeProfile: member.employeeProfile,
      }))}
      phases={phases}
      deliverables={project.deliverables.map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        description: deliverable.description,
        acceptanceCriteria: deliverable.acceptanceCriteria,
        status: deliverable.status,
        source: deliverable.source,
        sortOrder: deliverable.sortOrder,
        dueDate: deliverable.dueDate?.toISOString() ?? null,
        submittedAt:
          deliverable.submittedAt?.toISOString() ?? null,
        decidedAt: deliverable.decidedAt?.toISOString() ?? null,
        reviewNotes: deliverable.reviewNotes,
        acceptanceReference: deliverable.acceptanceReference,
        phaseId: deliverable.phaseId,
        phase: deliverable.phase,
        decidedBy: deliverable.decidedBy,
      }))}
      changeRequests={project.changeRequests.map((request) => ({
        id: request.id,
        requestNumber: request.requestNumber,
        title: request.title,
        businessReason: request.businessReason,
        status: request.status,
        scheduleImpactDays: request.scheduleImpactDays,
        commercialImpact: request.commercialImpact,
        commercialReference: request.commercialReference,
        clientApprovalRequired: request.clientApprovalRequired,
        clientApprovalReference: request.clientApprovalReference,
        reviewNotes: request.reviewNotes,
        submittedAt: request.submittedAt?.toISOString() ?? null,
        changesRequestedAt:
          request.changesRequestedAt?.toISOString() ?? null,
        approvedAt: request.approvedAt?.toISOString() ?? null,
        rejectedAt: request.rejectedAt?.toISOString() ?? null,
        appliedAt: request.appliedAt?.toISOString() ?? null,
        cancelledAt: request.cancelledAt?.toISOString() ?? null,
        createdAt: request.createdAt.toISOString(),
        createdBy: request.createdBy,
        reviewedBy: request.reviewedBy,
        appliedBy: request.appliedBy,
        canReview: canApproveProjectChange(
          user,
          request.createdById,
        ),
        items: request.items.map((item) => ({
          id: item.id,
          action: item.action,
          targetDeliverableId: item.targetDeliverableId,
          resultDeliverableId: item.resultDeliverableId,
          title: item.title,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria,
          reason: item.reason,
          phaseId: item.phaseId,
          phase: item.phase,
          targetDeliverable: item.targetDeliverable,
          resultDeliverable: item.resultDeliverable,
          dueDate: item.dueDate?.toISOString() ?? null,
          sortOrder: item.sortOrder,
        })),
      }))}
      governanceItems={project.governanceItems.map((item) => ({
        id: item.id,
        referenceNumber: item.referenceNumber,
        kind: item.kind,
        status: item.status,
        title: item.title,
        description: item.description,
        probability: item.probability,
        impact: item.impact,
        severity: item.severity,
        responsePlan: item.responsePlan,
        contingencyPlan: item.contingencyPlan,
        trigger: item.trigger,
        resolution: item.resolution,
        closureNote: item.closureNote,
        decision: item.decision,
        rationale: item.rationale,
        alternatives: item.alternatives,
        impactSummary: item.impactSummary,
        dueDate: item.dueDate?.toISOString() ?? null,
        decidedAt: item.decidedAt?.toISOString() ?? null,
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
        closedAt: item.closedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        ownerUser: item.ownerUser,
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
        decidedBy: item.decidedBy,
        sourceRisk: item.sourceRisk,
        materializedIssue: item.materializedIssue,
        supersedesDecision: item.supersedesDecision,
        supersededByDecision: item.supersededByDecision,
      }))}
      closure={project.closure ? {
        status: project.closure.status,
        outcome: project.closure.outcome,
        summary: project.closure.summary,
        lessonsLearned: project.closure.lessonsLearned,
        followUpActions: project.closure.followUpActions,
        clientHandoverRef: project.closure.clientHandoverRef,
        internalArchiveRef: project.closure.internalArchiveRef,
        exceptionReason: project.closure.exceptionReason,
      } : null}
      closureBlockers={{
        incompleteDeliverables: project.deliverables.filter((item) => !["ACCEPTED", "CANCELLED"].includes(item.status)).length,
        openChangeRequests: project.changeRequests.filter((item) => ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"].includes(item.status)).length,
        openRisks: project.governanceItems.filter((item) => item.kind === "RISK" && ["OPEN", "MONITORING", "MITIGATED"].includes(item.status)).length,
        openIssues: project.governanceItems.filter((item) => item.kind === "ISSUE" && ["OPEN", "IN_PROGRESS", "RESOLVED"].includes(item.status)).length,
        incompleteTasks: project.tasks.filter((item) => !["DONE", "CANCELLED", "ARCHIVED"].includes(item.status)).length,
      }}
      feedback={project.feedback ? {
        status: project.feedback.status,
        npsScore: project.feedback.npsScore,
        satisfactionScore: project.feedback.satisfactionScore,
        feedbackSummary: project.feedback.feedbackSummary,
        improvementNotes: project.feedback.improvementNotes,
        testimonial: project.feedback.testimonial,
        testimonialApproved: project.feedback.testimonialApproved,
        followUpRequired: project.feedback.followUpRequired,
        followUpAction: project.feedback.followUpAction,
        followUpDueAt: project.feedback.followUpDueAt?.toISOString() ?? null,
        ownerId: project.feedback.ownerId,
        resolutionNote: project.feedback.resolutionNote,
        receivedAt: project.feedback.receivedAt?.toISOString() ?? null,
        publicExpiresAt: project.feedback.publicExpiresAt?.toISOString() ?? null,
        publicRevokedAt: project.feedback.publicRevokedAt?.toISOString() ?? null,
        publicSubmittedAt: project.feedback.publicSubmittedAt?.toISOString() ?? null,
        deliveryRecipientName: project.feedback.deliveryRecipientName,
        deliveryRecipientEmail: project.feedback.deliveryRecipientEmail,
        deliverySentAt: project.feedback.deliverySentAt?.toISOString() ?? null,
        deliveryFailedAt: project.feedback.deliveryFailedAt?.toISOString() ?? null,
        deliveryAttemptCount: project.feedback.deliveryAttemptCount,
        reminderSentAt: project.feedback.reminderSentAt?.toISOString() ?? null,
        reminderFailedAt: project.feedback.reminderFailedAt?.toISOString() ?? null,
        reminderCount: project.feedback.reminderCount,
        reminderAttemptCount: project.feedback.reminderAttemptCount,
        reminderScheduleEnabled: project.feedback.reminderScheduleEnabled,
        reminderNextAt: project.feedback.reminderNextAt?.toISOString() ?? null,
        followUpTask: project.feedback.followUpTask,
      } : null}
      tasks={tasks}
      employees={employees}
      canManage={canManage}
      canManageLeadership={canManageProjectLeadership(
        user,
        currentMembership?.role
      )}
      readinessPermissions={{
        canManageContract: canManageProjectReadiness(user.role),
        canManagePayment: hasRole(
          user.role,
          ACCESS_ROLES.financeManagement,
        ),
        canOverride: canOverrideProjectReadiness(user.role),
        canActivate: canManageProjectReadiness(user.role),
        canViewFinance: canViewReadinessFinance,
      }}
      summary={{
        progress: averageProgress(
          tasks.map((task) => task.progress)
        ),
        totalTasks: tasks.length,
        completedTasks: tasks.filter(
          (task) => task.status === "DONE"
        ).length,
        blockedTasks: tasks.filter(
          (task) =>
            task.status === "BLOCKED" ||
            task.blockers.some(
              (blocker) => blocker.status === "OPEN"
            )
        ).length,
        openBlockers: tasks.reduce(
          (count, task) =>
            count +
            task.blockers.filter(
              (blocker) => blocker.status === "OPEN"
            ).length,
          0
        ),
      }}
    />
  )
}
