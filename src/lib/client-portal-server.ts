import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashOpaqueValue } from '@/lib/request-security';
import {
  CLIENT_PORTAL_TOKEN_BYTES,
  clientPortalIsActive,
  isValidClientPortalToken,
} from '@/lib/client-portal';
import { isProposalPublicAccessActive } from '@/lib/proposal-delivery';
import {
  publicProposalDeliverySelect,
  serializePublicProposal,
} from '@/lib/proposal-delivery-server';

export function createClientPortalAccess() {
  const token = crypto.randomBytes(CLIENT_PORTAL_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashOpaqueValue(token) };
}

export async function findClientPortalByToken(token: string, now = new Date()) {
  if (!isValidClientPortalToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientPortalAccess" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const access = await tx.clientPortalAccess.findUnique({
        where: { tokenHash },
        include: {
          client: {
            include: {
              company: { select: { name: true, email: true } },
              invoices: {
                where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] } },
                orderBy: { issueDate: 'desc' },
              },
              projects: {
                select: {
                  feedback: {
                    select: {
                      projectId: true,
                      status: true,
                      npsScore: true,
                      satisfactionScore: true,
                      publicSubmittedAt: true,
                      publicTokenHash: true,
                      publicExpiresAt: true,
                      publicRevokedAt: true,
                      project: { select: { name: true } },
                    },
                  },
                },
              },
              leads: {
                select: {
                  intakeSession: {
                    select: {
                      id: true,
                      status: true,
                      proposalWorkspace: {
                        select: {
                          id: true,
                          proposalNumber: true,
                          status: true,
                          sentVersion: true,
                          sentClientContentHash: true,
                          deliveries: {
                            orderBy: { version: 'desc' },
                            take: 1,
                            select: {
                              status: true,
                              version: true,
                              clientContentHash: true,
                              expiresAt: true,
                              revokedAt: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (
        !access ||
        !clientPortalIsActive({ tokenHash: access.tokenHash, revokedAt: access.revokedAt })
      )
        return null;

      await tx.clientPortalAccess.update({
        where: { id: access.id },
        data: { lastAccessedAt: now, accessCount: { increment: 1 } },
      });

      const activeProposals = access.client.leads
        .map((lead) => lead.intakeSession?.proposalWorkspace)
        .filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace))
        .filter((workspace) => {
          const delivery = workspace.deliveries[0];
          if (!delivery) return false;
          return isProposalPublicAccessActive({
            deliveryStatus: delivery.status,
            revokedAt: delivery.revokedAt,
            expiresAt: delivery.expiresAt,
            workspaceStatus: workspace.status,
            deliveryVersion: delivery.version,
            sentVersion: workspace.sentVersion,
            deliveryClientContentHash: delivery.clientContentHash,
            sentClientContentHash: workspace.sentClientContentHash,
            now,
          });
        })
        .map((workspace) => ({
          id: workspace.id,
          proposalNumber: workspace.proposalNumber,
          status: workspace.status,
        }));

      const discoverySessions = access.client.leads
        .map((lead) => lead.intakeSession)
        .filter((session): session is NonNullable<typeof session> => Boolean(session))
        .filter((session) => session.status !== 'ARCHIVED')
        .map((session) => ({ id: session.id, status: session.status }));

      const feedbackRequests = access.client.projects
        .map((project) => project.feedback)
        .filter((feedback): feedback is NonNullable<typeof feedback> => Boolean(feedback))
        .filter((feedback) => feedback.status !== 'WAIVED')
        .map((feedback) => ({
          projectId: feedback.projectId,
          projectName: feedback.project.name,
          status: feedback.status,
          npsScore: feedback.npsScore,
          satisfactionScore: feedback.satisfactionScore,
          submitted: Boolean(feedback.publicSubmittedAt),
          pendingSubmission:
            !feedback.publicSubmittedAt &&
            Boolean(feedback.publicTokenHash) &&
            !feedback.publicRevokedAt &&
            (feedback.publicExpiresAt ? feedback.publicExpiresAt > now : false),
        }));

      return { ...access, activeProposals, discoverySessions, feedbackRequests };
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function findClientPortalInvoice(token: string, invoiceId: string) {
  if (!isValidClientPortalToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);
  const access = await prisma.clientPortalAccess.findUnique({
    where: { tokenHash },
    select: { clientId: true, revokedAt: true },
  });
  if (!access || access.revokedAt) return null;

  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: access.clientId,
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
    },
    include: {
      company: { select: { name: true, email: true } },
      project: { select: { name: true, code: true } },
      client: { select: { name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

export async function findClientPortalProposal(token: string, workspaceId: string) {
  if (!isValidClientPortalToken(token)) return null;
  const tokenHash = hashOpaqueValue(token);
  const access = await prisma.clientPortalAccess.findUnique({
    where: { tokenHash },
    select: { clientId: true, revokedAt: true },
  });
  if (!access || access.revokedAt) return null;

  const delivery = await prisma.proposalDelivery.findFirst({
    where: {
      workspace: { id: workspaceId, intakeSession: { lead: { clientId: access.clientId } } },
    },
    orderBy: { version: 'desc' },
    select: publicProposalDeliverySelect,
  });
  if (!delivery) return null;

  try {
    return serializePublicProposal(delivery);
  } catch {
    return null;
  }
}
