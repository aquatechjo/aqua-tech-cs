import type { Prisma } from "@/generated/prisma/client"
import type {
  ProjectPriority,
  ProjectStatus,
  WorkflowStatus,
} from "@/generated/prisma/enums"
import { ApiError } from "@/lib/api-response"
import {
  addWorkflowDays,
  parseWorkflowDefinition,
  suggestWorkflowTemplateCode,
} from "@/lib/project-workflow"

type ProjectWorkflowCreateInput = {
  companyId: string
  createdById: string
  workflowTemplateId?: string | null
  templateHint?: string | null
  eventContext?: Record<string, unknown>
  readiness?: {
    contractRequired: boolean
    paymentRequired: boolean
    requiredPaymentAmount?: string | null
    currency?: string
  }
  project: {
    clientId?: string | null
    name: string
    code?: string | null
    description?: string | null
    status: ProjectStatus
    priority: ProjectPriority
    budget?: string | null
    currency: string
    startDate?: Date | null
    dueDate?: Date | null
    completedAt?: Date | null
  }
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function projectStatusToWorkflowStatus(
  status: ProjectStatus
): WorkflowStatus {
  if (status === "IN_PROGRESS") return "ACTIVE"
  if (status === "ON_HOLD") return "PAUSED"
  if (status === "COMPLETED") return "COMPLETED"
  if (status === "CANCELLED" || status === "ARCHIVED") return "CANCELLED"
  return "NOT_STARTED"
}

async function resolveTemplate(
  tx: Prisma.TransactionClient,
  companyId: string,
  workflowTemplateId: string | null | undefined,
  templateHint: string | null | undefined
) {
  if (workflowTemplateId) {
    const template = await tx.workflowTemplate.findFirst({
      where: {
        id: workflowTemplateId,
        companyId,
        isActive: true,
      },
    })

    if (!template) {
      throw new ApiError(
        "قالب سير العمل المحدد غير موجود أو غير مفعّل",
        404,
        "WORKFLOW_TEMPLATE_NOT_FOUND"
      )
    }

    return template
  }

  const suggestedCode = suggestWorkflowTemplateCode(templateHint)
  const suggestedTemplate = await tx.workflowTemplate.findFirst({
    where: {
      companyId,
      isActive: true,
      code: suggestedCode,
    },
  })
  const template =
    suggestedTemplate ??
    (await tx.workflowTemplate.findFirst({
      where: {
        companyId,
        isActive: true,
        isDefault: true,
      },
    }))

  if (!template) {
    throw new ApiError(
      "لا يوجد قالب سير عمل مفعّل لهذه الشركة",
      409,
      "WORKFLOW_TEMPLATE_REQUIRED"
    )
  }

  return template
}

export async function createProjectWithWorkflow(
  tx: Prisma.TransactionClient,
  input: ProjectWorkflowCreateInput
) {
  const template = await resolveTemplate(
    tx,
    input.companyId,
    input.workflowTemplateId,
    input.templateHint
  )
  const definition = parseWorkflowDefinition(template.definition)
  const completedAt =
    input.project.status === "COMPLETED"
      ? input.project.completedAt ?? new Date()
      : null

  const project = await tx.project.create({
    data: {
      companyId: input.companyId,
      clientId: input.project.clientId ?? null,
      name: input.project.name,
      code: input.project.code ?? null,
      description: input.project.description ?? null,
      status: input.project.status,
      priority: input.project.priority,
      budget: input.project.budget ?? null,
      currency: input.project.currency,
      startDate: input.project.startDate ?? null,
      dueDate: input.project.dueDate ?? null,
      completedAt,
    },
  })

  await tx.projectReadiness.create({
    data: {
      companyId: input.companyId,
      projectId: project.id,
      contractRequired:
        input.readiness?.contractRequired ?? false,
      paymentRequired:
        input.readiness?.paymentRequired ?? false,
      requiredPaymentAmount:
        input.readiness?.requiredPaymentAmount ?? null,
      currency:
        input.readiness?.currency ?? input.project.currency,
    },
  })

  const status = projectStatusToWorkflowStatus(project.status)
  const workflow = await tx.projectWorkflow.create({
    data: {
      companyId: input.companyId,
      projectId: project.id,
      templateId: template.id,
      templateName: template.name,
      templateCode: template.code,
      templateVersion: template.version,
      status,
      definitionSnapshot: jsonValue(definition),
      startedAt:
        status === "ACTIVE" || status === "PAUSED" || status === "COMPLETED"
          ? project.startDate ?? new Date()
          : null,
      completedAt: status === "COMPLETED" ? completedAt : null,
    },
  })

  const phaseIds = new Map<string, string>()
  const taskIds = new Map<string, string>()

  for (const [index, stage] of definition.stages.entries()) {
    const phase = await tx.projectPhase.create({
      data: {
        companyId: input.companyId,
        projectId: project.id,
        name: stage.name,
        code: stage.code,
        workflowStageCode: stage.code,
        description: stage.description ?? null,
        status:
          project.status === "COMPLETED"
            ? "COMPLETED"
            : project.status === "IN_PROGRESS" && index === 0
              ? "ACTIVE"
              : "PLANNED",
        progress: project.status === "COMPLETED" ? 100 : 0,
        sortOrder: stage.sortOrder,
        startDate: project.startDate
          ? addWorkflowDays(project.startDate, stage.startOffsetDays)
          : null,
        dueDate: project.startDate
          ? addWorkflowDays(project.startDate, stage.dueOffsetDays)
          : null,
        completedAt: project.status === "COMPLETED" ? completedAt : null,
      },
    })
    phaseIds.set(stage.code, phase.id)
  }

  for (const taskTemplate of definition.tasks) {
    const task = await tx.task.create({
      data: {
        companyId: input.companyId,
        projectId: project.id,
        phaseId: phaseIds.get(taskTemplate.stageCode),
        clientId: project.clientId,
        createdById: input.createdById,
        title: taskTemplate.title,
        description: taskTemplate.description ?? null,
        status: project.status === "COMPLETED" ? "DONE" : "TODO",
        priority: taskTemplate.priority,
        source: "WORKFLOW",
        sourceRef: workflow.id,
        workflowTaskCode: taskTemplate.code,
        workflowOwnerRole: taskTemplate.ownerRole ?? null,
        estimatedHours: taskTemplate.estimatedHours,
        sortOrder: taskTemplate.sortOrder,
        progress: project.status === "COMPLETED" ? 100 : 0,
        dueDate: project.startDate
          ? addWorkflowDays(project.startDate, taskTemplate.dueOffsetDays)
          : null,
        completedAt: project.status === "COMPLETED" ? completedAt : null,
      },
    })
    taskIds.set(taskTemplate.code, task.id)
  }

  for (const taskTemplate of definition.tasks) {
    const taskId = taskIds.get(taskTemplate.code)
    if (!taskId) continue

    for (const dependencyCode of taskTemplate.dependsOnTaskCodes) {
      const dependsOnTaskId = taskIds.get(dependencyCode)
      if (!dependsOnTaskId) continue

      await tx.taskDependency.create({
        data: {
          companyId: input.companyId,
          taskId,
          dependsOnTaskId,
          type: "FINISH_TO_START",
        },
      })
    }
  }

  for (const approval of definition.approvals) {
    await tx.projectWorkflowApproval.create({
      data: {
        companyId: input.companyId,
        workflowId: workflow.id,
        phaseId: approval.stageCode
          ? phaseIds.get(approval.stageCode)
          : null,
        taskId: approval.taskCode
          ? taskIds.get(approval.taskCode)
          : null,
        code: approval.code,
        name: approval.name,
        gate: approval.gate,
        requiredRole: approval.requiredRole ?? null,
      },
    })
  }

  for (const rule of definition.rules) {
    await tx.projectWorkflowRule.create({
      data: {
        companyId: input.companyId,
        workflowId: workflow.id,
        code: rule.code,
        name: rule.name,
        event: rule.event,
        channel: rule.channel,
        eventKey: rule.eventKey,
        configuration: jsonValue(rule.configuration),
      },
    })
  }

  await tx.workflowEvent.create({
    data: {
      companyId: input.companyId,
      workflowId: workflow.id,
      event: "PROJECT_CREATED",
      eventKey: "workflow.project.created",
      payload: jsonValue({
        projectId: project.id,
        projectName: project.name,
        templateCode: template.code,
        templateVersion: template.version,
        ...input.eventContext,
      }),
    },
  })

  return {
    project,
    workflow,
    template,
  }
}
