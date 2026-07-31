import { ActivityAction } from "@/generated/prisma/enums"
import { ACCESS_ROLES, assertRole } from "@/lib/access-control"
import { logActivity } from "@/lib/activity"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import {
  normalizeClientContactEmail,
  normalizeClientContactPhone,
} from "@/lib/client-contact"
import { ensureClientContactFromSnapshot } from "@/lib/client-contact-server"
import { syncLeadForServiceRequest } from "@/lib/crm-lead-server"
import { prisma } from "@/lib/prisma"
import {
  acceptedProposalConversionIssues,
  acceptedProposalProjectCode,
  acceptedProposalProjectConversionInputSchema,
  acceptedProposalProjectDescription,
  resolveClientCandidateIds,
} from "@/lib/project-conversion"
import { acceptedProposalDeliverableSeeds } from "@/lib/project-deliverable"
import { createProjectWithWorkflow } from "@/lib/project-workflow-server"
import { proposalVersionContentSchema } from "@/lib/proposal"
import {
  proposalClientContentHash,
  proposalContentHash,
} from "@/lib/proposal-server"
import { assertSameOrigin } from "@/lib/request-security"
import { wonOpportunityState } from "@/lib/sales"

const MAX_CONVERSION_BODY_BYTES = 12 * 1024

async function readOptionalConversionBody(request: Request) {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_CONVERSION_BODY_BYTES) {
    throw new ApiError(
      "بيانات التحويل أكبر من الحد المسموح",
      413,
      "CONVERSION_BODY_TOO_LARGE",
    )
  }
  if (!text.trim()) return {}

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ApiError(
      "بيانات التحويل ليست JSON صالحًا",
      400,
      "INVALID_CONVERSION_JSON",
    )
  }
}

function opportunityClientSource(source: string) {
  if (source === "MANUAL") return "DIRECT" as const
  if (source === "OTHER") return "OTHER" as const
  if (
    source === "WEBSITE" ||
    source === "WHATSAPP" ||
    source === "INSTAGRAM" ||
    source === "FACEBOOK" ||
    source === "REFERRAL"
  ) {
    return source
  }
  return "OTHER" as const
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    assertRole(user.role, ACCESS_ROLES.salesManagement)
    const { id } = await params
    const payload = await readOptionalConversionBody(request)
    const meta = await getRequestMeta()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "SalesOpportunity"
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
        FOR UPDATE
      `

      const opportunity = await tx.salesOpportunity.findFirst({
        where: { id, companyId: user.companyId },
        include: {
          serviceRequest: true,
          lead: {
            select: {
              id: true,
              clientId: true,
            },
          },
          client: { select: { id: true, status: true } },
          project: {
            select: {
              id: true,
              name: true,
              originProposalWorkspaceId: true,
              originProposalResponseId: true,
              originProposalVersion: true,
              originProposalContentHash: true,
              originClientContentHash: true,
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
          proposalWorkspace: {
            select: {
              id: true,
              proposalNumber: true,
              status: true,
              sentVersion: true,
              sentClientContentHash: true,
              responses: {
                where: {
                  decision: "ACCEPTED",
                },
                orderBy: {
                  respondedAt: "desc",
                },
                select: {
                  id: true,
                  decision: true,
                  version: true,
                  clientContentHash: true,
                  responderName: true,
                  responderEmail: true,
                  responderTitle: true,
                  authorityConfirmed: true,
                  respondedAt: true,
                },
              },
              versions: {
                orderBy: {
                  version: "desc",
                },
                select: {
                  version: true,
                  content: true,
                  contentHash: true,
                  clientContentHash: true,
                },
              },
            },
          },
        },
      })

      if (!opportunity) {
        throw new ApiError(
          "فرصة البيع غير موجودة",
          404,
          "OPPORTUNITY_NOT_FOUND",
        )
      }

      if (opportunity.proposalWorkspace) {
        assertRole(
          user.role,
          ACCESS_ROLES.projectConversion,
          "تحويل العرض المقبول إلى مشروع متاح لمالك النظام أو الإدارة فقط",
        )

        const parsedInput =
          acceptedProposalProjectConversionInputSchema.safeParse(payload)
        if (!parsedInput.success) {
          throw new ApiError(
            parsedInput.error.issues[0]?.message ??
              "بيانات تحويل المشروع غير صحيحة",
            400,
            "INVALID_PROJECT_CONVERSION_INPUT",
          )
        }

        const workspace = opportunity.proposalWorkspace
        await tx.$queryRaw`
          SELECT "id"
          FROM "ProposalWorkspace"
          WHERE "id" = ${workspace.id}
            AND "companyId" = ${user.companyId}
          FOR UPDATE
        `

        const response =
          workspace.responses.find(
            (candidate) =>
              candidate.version === workspace.sentVersion,
          ) ?? null
        const version =
          workspace.versions.find(
            (candidate) =>
              candidate.version === workspace.sentVersion,
          ) ?? null
        const readinessIssues = acceptedProposalConversionIssues({
          workspaceStatus: workspace.status,
          sentVersion: workspace.sentVersion,
          sentClientContentHash: workspace.sentClientContentHash,
          version: version
            ? {
                version: version.version,
                contentHash: version.contentHash,
                clientContentHash: version.clientContentHash,
              }
            : null,
          response: response
            ? {
                id: response.id,
                decision: response.decision,
                version: response.version,
                clientContentHash: response.clientContentHash,
                authorityConfirmed: response.authorityConfirmed,
              }
            : null,
        })

        if (readinessIssues.length > 0) {
          throw new ApiError(
            readinessIssues[0],
            409,
            "ACCEPTED_PROPOSAL_CONVERSION_NOT_READY",
          )
        }
        if (!version || !response) {
          throw new ApiError(
            "مرجع العرض المقبول غير مكتمل",
            409,
            "ACCEPTED_PROPOSAL_CONVERSION_NOT_READY",
          )
        }

        const acceptedContent =
          proposalVersionContentSchema.safeParse(version.content)
        if (!acceptedContent.success) {
          throw new ApiError(
            "محتوى إصدار العرض المقبول غير صالح",
            409,
            "ACCEPTED_PROPOSAL_CONTENT_INVALID",
          )
        }
        if (
          proposalContentHash(acceptedContent.data) !==
            version.contentHash ||
          proposalClientContentHash(acceptedContent.data) !==
            version.clientContentHash
        ) {
          throw new ApiError(
            "بصمة محتوى إصدار العرض المقبول لا تطابق السجل المحفوظ",
            409,
            "ACCEPTED_PROPOSAL_HASH_MISMATCH",
          )
        }
        if (opportunity.stage === "LOST") {
          throw new ApiError(
            "أعد فتح الفرصة قبل تحويل العرض المقبول",
            409,
            "LOST_OPPORTUNITY_CANNOT_CONVERT",
          )
        }

        if (opportunity.project) {
          const replayMatches =
            opportunity.project.originProposalWorkspaceId ===
              workspace.id &&
            opportunity.project.originProposalResponseId ===
              response.id &&
            opportunity.project.originProposalVersion ===
              version.version &&
            opportunity.project.originProposalContentHash ===
              version.contentHash &&
            opportunity.project.originClientContentHash ===
              version.clientContentHash

          if (!replayMatches) {
            throw new ApiError(
              "الفرصة مرتبطة بمشروع من مصدر مختلف وتحتاج مراجعة إدارية",
              409,
              "OPPORTUNITY_PROJECT_ORIGIN_MISMATCH",
            )
          }

          return {
            opportunityId: opportunity.id,
            leadId: opportunity.leadId,
            clientId: opportunity.clientId,
            contactId: null,
            projectId: opportunity.project.id,
            projectName: opportunity.project.name,
            workflow: opportunity.project.workflow,
            replayed: true,
          }
        }

        const linkedClient = resolveClientCandidateIds([
          opportunity.clientId ?? "",
          opportunity.serviceRequest?.clientId ?? "",
          opportunity.lead?.clientId ?? "",
        ])
        if (linkedClient.status === "AMBIGUOUS") {
          throw new ApiError(
            "الفرصة والطلب والعميل المحتمل مرتبطون بحسابات عملاء مختلفة",
            409,
            "CLIENT_LINK_MISMATCH",
          )
        }

        let clientId = linkedClient.clientId
        if (!clientId) {
          const emails = [
            response.responderEmail,
            opportunity.email,
          ]
            .map(normalizeClientContactEmail)
            .filter((value): value is string => Boolean(value))
          const phones = [opportunity.phone]
            .map(normalizeClientContactPhone)
            .filter((value): value is string => Boolean(value))
          const identityMatches: Array<{
            emailNormalized?: string
            phoneNormalized?: string
          }> = [...new Set(emails)].map((emailNormalized) => ({
            emailNormalized,
          }))
          identityMatches.push(
            ...[...new Set(phones)].map((phoneNormalized) => ({
              phoneNormalized,
            })),
          )

          if (identityMatches.length > 0) {
            const matchingContacts = await tx.clientContact.findMany({
              where: {
                companyId: user.companyId,
                archivedAt: null,
                OR: identityMatches,
              },
              select: {
                clientId: true,
                client: {
                  select: {
                    status: true,
                  },
                },
              },
            })
            const activeMatches = resolveClientCandidateIds(
              matchingContacts
                .filter(
                  (contact) =>
                    contact.client.status !== "ARCHIVED",
                )
                .map((contact) => contact.clientId),
            )
            const archivedMatches = resolveClientCandidateIds(
              matchingContacts
                .filter(
                  (contact) =>
                    contact.client.status === "ARCHIVED",
                )
                .map((contact) => contact.clientId),
            )

            if (activeMatches.status === "AMBIGUOUS") {
              throw new ApiError(
                "يوجد أكثر من عميل مطابق للبريد أو الهاتف؛ اربط الفرصة بالحساب الصحيح أولًا",
                409,
                "CLIENT_MATCH_AMBIGUOUS",
              )
            }
            if (activeMatches.status === "MATCHED") {
              clientId = activeMatches.clientId
            } else if (archivedMatches.status !== "NONE") {
              throw new ApiError(
                "يوجد حساب عميل مؤرشف مطابق؛ استرجعه واربطه بالفرصة قبل التحويل",
                409,
                "ARCHIVED_CLIENT_MATCH_REQUIRES_REVIEW",
              )
            }
          }
        }

        let clientCreated = false
        if (clientId) {
          const client = await tx.client.findFirst({
            where: { id: clientId, companyId: user.companyId },
            select: { id: true, status: true },
          })
          if (!client) {
            throw new ApiError(
              "العميل المرتبط غير موجود",
              404,
              "CLIENT_NOT_FOUND",
            )
          }
          if (client.status === "ARCHIVED") {
            throw new ApiError(
              "استرجع حساب العميل المؤرشف قبل تحويل العرض",
              409,
              "ARCHIVED_CLIENT_REQUIRES_RESTORE",
            )
          }
          if (client.status !== "ACTIVE") {
            await tx.client.update({
              where: { id: client.id },
              data: { status: "ACTIVE" },
            })
            await logActivity({
              db: tx,
              companyId: user.companyId,
              userId: user.id,
              action: ActivityAction.CLIENT_UPDATED,
              entityType: "Client",
              entityId: client.id,
              message: "تم تفعيل حساب العميل عند تحويل العرض المقبول",
              metadata: {
                opportunityId: opportunity.id,
                proposalWorkspaceId: workspace.id,
              },
              ...meta,
            })
          }
        } else {
          const client = await tx.client.create({
            data: {
              companyId: user.companyId,
              name:
                opportunity.companyName?.trim() ||
                opportunity.contactName,
              email: opportunity.email,
              phone: opportunity.phone,
              type: opportunity.companyName
                ? "COMPANY"
                : "INDIVIDUAL",
              status: "ACTIVE",
              source: opportunityClientSource(opportunity.source),
              notes: opportunity.notes,
            },
          })
          clientId = client.id
          clientCreated = true

          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.CLIENT_CREATED,
            entityType: "Client",
            entityId: client.id,
            message: `تم إنشاء حساب العميل من العرض المقبول: ${client.name}`,
            metadata: {
              opportunityId: opportunity.id,
              proposalWorkspaceId: workspace.id,
            },
            ...meta,
          })
        }

        const loggedContactIds = new Set<string>()
        const salesContact = await ensureClientContactFromSnapshot({
          db: tx,
          companyId: user.companyId,
          clientId,
          name: opportunity.contactName,
          email: opportunity.email,
          phone: opportunity.phone,
          notes: `جهة اتصال من فرصة البيع ${opportunity.title}`,
        })
        if (salesContact.created) {
          loggedContactIds.add(salesContact.contact.id)
          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.CONTACT_CREATED,
            entityType: "ClientContact",
            entityId: salesContact.contact.id,
            message: `تمت إضافة جهة اتصال عند تحويل العرض: ${salesContact.contact.name}`,
            metadata: {
              clientId,
              opportunityId: opportunity.id,
              isPrimary: salesContact.contact.isPrimary,
            },
            ...meta,
          })
        }

        const acceptedContact =
          await ensureClientContactFromSnapshot({
            db: tx,
            companyId: user.companyId,
            clientId,
            name: response.responderName,
            email: response.responderEmail,
            notes: `ممثل العميل الذي قبل العرض ${workspace.proposalNumber}`,
          })
        if (
          acceptedContact.created &&
          !loggedContactIds.has(acceptedContact.contact.id)
        ) {
          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.CONTACT_CREATED,
            entityType: "ClientContact",
            entityId: acceptedContact.contact.id,
            message: `تمت إضافة ممثل العميل الذي قبل العرض: ${acceptedContact.contact.name}`,
            metadata: {
              clientId,
              opportunityId: opportunity.id,
              proposalWorkspaceId: workspace.id,
            },
            ...meta,
          })
        }
        if (!acceptedContact.contact.isDecisionMaker) {
          await tx.clientContact.update({
            where: { id: acceptedContact.contact.id },
            data: {
              isDecisionMaker: true,
              jobTitle:
                acceptedContact.contact.jobTitle ??
                response.responderTitle,
            },
          })
        }

        const convertedAt = new Date()
        const created = await createProjectWithWorkflow(tx, {
          companyId: user.companyId,
          createdById: user.id,
          workflowTemplateId: parsedInput.data.workflowTemplateId,
          templateHint: opportunity.serviceType ?? opportunity.title,
          readiness: {
            contractRequired: true,
            paymentRequired: true,
            currency: acceptedContent.data.commercial.currency,
          },
          eventContext: {
            source: "ACCEPTED_PROPOSAL",
            opportunityId: opportunity.id,
            proposalWorkspaceId: workspace.id,
            proposalResponseId: response.id,
            proposalVersion: version.version,
            clientId,
          },
          project: {
            clientId,
            name: parsedInput.data.projectName,
            code: acceptedProposalProjectCode(
              workspace.proposalNumber,
            ),
            description: acceptedProposalProjectDescription({
              proposalNumber: workspace.proposalNumber,
              version: version.version,
              content: acceptedContent.data,
            }),
            status: "PLANNING",
            priority: opportunity.priority,
            budget:
              acceptedContent.data.commercial.totals.grandTotal,
            currency: acceptedContent.data.commercial.currency,
          },
        })
        const project = await tx.project.update({
          where: { id: created.project.id },
          data: {
            originProposalWorkspaceId: workspace.id,
            originProposalResponseId: response.id,
            originProposalVersion: version.version,
            originProposalContentHash: version.contentHash,
            originClientContentHash: version.clientContentHash,
            clientAcceptedAt: response.respondedAt,
            proposalConvertedAt: convertedAt,
          },
        })
        const deliverableSeeds = acceptedProposalDeliverableSeeds({
          workspaceId: workspace.id,
          version: version.version,
          content: acceptedContent.data,
        })
        if (deliverableSeeds.length > 0) {
          await tx.projectDeliverable.createMany({
            data: deliverableSeeds.map((deliverable) => ({
              companyId: user.companyId,
              projectId: project.id,
              createdById: user.id,
              updatedById: user.id,
              source: "ACCEPTED_PROPOSAL",
              ...deliverable,
            })),
            skipDuplicates: true,
          })
          await logActivity({
            db: tx,
            companyId: user.companyId,
            userId: user.id,
            action: ActivityAction.PROJECT_DELIVERABLE_CREATED,
            entityType: "Project",
            entityId: project.id,
            message: `تم إنشاء خط أساس التسليمات من العرض ${workspace.proposalNumber}`,
            metadata: {
              projectId: project.id,
              proposalWorkspaceId: workspace.id,
              proposalVersion: version.version,
              deliverables: deliverableSeeds.map((deliverable) => ({
                title: deliverable.title,
                sourceRef: deliverable.sourceRef,
              })),
            },
            ...meta,
          })
        }

        let leadId = opportunity.leadId
        if (opportunity.serviceRequestId) {
          const convertedRequest = await tx.serviceRequest.update({
            where: { id: opportunity.serviceRequestId },
            data: {
              clientId,
              projectId: project.id,
              status: "CONVERTED",
              convertedAt,
            },
          })
          const synced = await syncLeadForServiceRequest({
            db: tx,
            companyId: user.companyId,
            serviceRequest: convertedRequest,
            actorUserId: user.id,
            now: convertedAt,
          })
          leadId = synced.lead.id
        }
        if (leadId) {
          await tx.lead.update({
            where: { id: leadId },
            data: {
              clientId,
              status: "CONVERTED",
              convertedAt,
              nextAction: null,
              nextActionAt: null,
            },
          })
        }

        const updated = await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: {
            leadId,
            clientId,
            projectId: project.id,
            estimatedValue:
              acceptedContent.data.commercial.totals.grandTotal,
            currency: acceptedContent.data.commercial.currency,
            ...wonOpportunityState(convertedAt),
          },
        })

        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROJECT_CREATED,
          entityType: "Project",
          entityId: project.id,
          message: `تم إنشاء مسودة المشروع من العرض المقبول: ${project.name}`,
          metadata: {
            clientId,
            contactId: acceptedContact.contact.id,
            opportunityId: updated.id,
            workflowId: created.workflow.id,
            workflowTemplateId: created.template.id,
            proposalWorkspaceId: workspace.id,
            proposalVersion: version.version,
            deliverableCount: deliverableSeeds.length,
          },
          ...meta,
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.SALES_OPPORTUNITY_WON,
          entityType: "SalesOpportunity",
          entityId: updated.id,
          message: `تم تسجيل فوز فرصة البيع: ${updated.title}`,
          metadata: {
            clientId,
            projectId: project.id,
            estimatedValue: updated.estimatedValue.toString(),
            currency: updated.currency,
          },
          ...meta,
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.PROPOSAL_CONVERTED_TO_PROJECT,
          entityType: "ProposalWorkspace",
          entityId: workspace.id,
          message: `تم تحويل العرض ${workspace.proposalNumber} إلى مشروع`,
          metadata: {
            clientId,
            clientCreated,
            contactId: acceptedContact.contact.id,
            opportunityId: updated.id,
            projectId: project.id,
            workflowId: created.workflow.id,
            proposalResponseId: response.id,
            proposalVersion: version.version,
            proposalContentHash: version.contentHash,
            clientContentHash: version.clientContentHash,
          },
          ...meta,
        })
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.SALES_OPPORTUNITY_CONVERTED,
          entityType: "SalesOpportunity",
          entityId: updated.id,
          message: `تم تحويل فرصة البيع إلى عميل ومشروع: ${updated.title}`,
          metadata: {
            clientId,
            contactId: acceptedContact.contact.id,
            projectId: project.id,
            source: "ACCEPTED_PROPOSAL",
          },
          ...meta,
        })

        return {
          opportunityId: updated.id,
          leadId,
          clientId,
          contactId: acceptedContact.contact.id,
          projectId: project.id,
          projectName: project.name,
          workflow: {
            id: created.workflow.id,
            templateName: created.template.name,
            templateCode: created.template.code,
            templateVersion: created.template.version,
            status: created.workflow.status,
          },
          replayed: false,
        }
      }

      if (opportunity.stage === "LOST") {
        throw new ApiError(
          "أعد فتح الفرصة قبل تسجيلها كفوز",
          409,
          "LOST_OPPORTUNITY_CANNOT_CONVERT",
        )
      }

      if (
        opportunity.stage === "WON" &&
        opportunity.clientId &&
        opportunity.projectId
      ) {
        return {
          opportunityId: opportunity.id,
          leadId: opportunity.leadId,
          clientId: opportunity.clientId,
          projectId: opportunity.projectId,
          replayed: true,
        }
      }

      let clientId =
        opportunity.clientId ??
        opportunity.serviceRequest?.clientId ??
        null

      if (clientId) {
        const client = await tx.client.findFirst({
          where: { id: clientId, companyId: user.companyId },
          select: { id: true, status: true },
        })
        if (!client) {
          throw new ApiError(
            "العميل المرتبط غير موجود",
            404,
            "CLIENT_NOT_FOUND",
          )
        }
        if (client.status !== "ACTIVE") {
          await tx.client.update({
            where: { id: client.id },
            data: { status: "ACTIVE" },
          })
        }
      } else {
        const client = await tx.client.create({
          data: {
            companyId: user.companyId,
            name:
              opportunity.companyName?.trim() ||
              opportunity.contactName,
            email: opportunity.email,
            phone: opportunity.phone,
            type: opportunity.companyName
              ? "COMPANY"
              : "INDIVIDUAL",
            status: "ACTIVE",
            source: opportunityClientSource(opportunity.source),
            notes: opportunity.notes,
          },
        })
        clientId = client.id
      }

      const ensuredContact = await ensureClientContactFromSnapshot({
        db: tx,
        companyId: user.companyId,
        clientId,
        name: opportunity.contactName,
        email: opportunity.email,
        phone: opportunity.phone,
      })

      if (ensuredContact.created) {
        await logActivity({
          db: tx,
          companyId: user.companyId,
          userId: user.id,
          action: ActivityAction.CONTACT_CREATED,
          entityType: "ClientContact",
          entityId: ensuredContact.contact.id,
          message: `تمت إضافة جهة اتصال عند تحويل فرصة البيع: ${ensuredContact.contact.name}`,
          metadata: {
            clientId,
            opportunityId: opportunity.id,
            isPrimary: ensuredContact.contact.isPrimary,
          },
          ...meta,
        })
      }

      let projectId =
        opportunity.projectId ??
        opportunity.serviceRequest?.projectId ??
        null

      if (projectId) {
        const project = await tx.project.findFirst({
          where: { id: projectId, companyId: user.companyId },
          select: { id: true, clientId: true },
        })
        if (!project) {
          throw new ApiError(
            "المشروع المرتبط غير موجود",
            404,
            "PROJECT_NOT_FOUND",
          )
        }
        if (project.clientId && project.clientId !== clientId) {
          throw new ApiError(
            "المشروع المرتبط يتبع عميلًا مختلفًا",
            409,
            "PROJECT_CLIENT_MISMATCH",
          )
        }
        if (!project.clientId) {
          await tx.project.update({
            where: { id: project.id },
            data: { clientId },
          })
        }
      } else {
        const created = await createProjectWithWorkflow(tx, {
          companyId: user.companyId,
          createdById: user.id,
          templateHint:
            opportunity.serviceType ?? opportunity.title,
          project: {
            clientId,
            name: opportunity.title,
            description: opportunity.notes,
            status: "PLANNING",
            priority: opportunity.priority,
            budget: opportunity.estimatedValue.toString(),
            currency: opportunity.currency,
            startDate: new Date(),
          },
        })
        projectId = created.project.id
      }

      const convertedAt = new Date()
      let leadId = opportunity.leadId

      if (opportunity.serviceRequestId) {
        const convertedRequest = await tx.serviceRequest.update({
          where: { id: opportunity.serviceRequestId },
          data: {
            clientId,
            projectId,
            status: "CONVERTED",
            convertedAt,
          },
        })
        const { lead } = await syncLeadForServiceRequest({
          db: tx,
          companyId: user.companyId,
          serviceRequest: convertedRequest,
          actorUserId: user.id,
          now: convertedAt,
        })
        leadId = lead.id
      }

      const updated = await tx.salesOpportunity.update({
        where: { id: opportunity.id },
        data: {
          leadId,
          clientId,
          projectId,
          ...wonOpportunityState(convertedAt),
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_WON,
        entityType: "SalesOpportunity",
        entityId: updated.id,
        message: `تم تسجيل فوز فرصة البيع: ${updated.title}`,
        metadata: {
          clientId,
          projectId,
          estimatedValue: updated.estimatedValue.toString(),
          currency: updated.currency,
        },
        ...meta,
      })
      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.SALES_OPPORTUNITY_CONVERTED,
        entityType: "SalesOpportunity",
        entityId: updated.id,
        message: `تم تحويل فرصة البيع إلى عميل ومشروع: ${updated.title}`,
        metadata: {
          clientId,
          contactId: ensuredContact.contact.id,
          projectId,
        },
        ...meta,
      })

      return {
        opportunityId: updated.id,
        leadId,
        clientId,
        contactId: ensuredContact.contact.id,
        projectId,
        replayed: false,
      }
    })

    return ok(result)
  } catch (error) {
    return handleApiError(
      error,
      "SALES_OPPORTUNITY_CONVERT_ERROR",
      "تعذر تحويل فرصة البيع",
    )
  }
}
