import { notFound, redirect } from "next/navigation"

import { ACCESS_ROLES, hasRole } from "@/lib/access-control"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import ClientContactsClient from "./ClientContactsClient"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAuth()

  if (!hasRole(user.role, ACCESS_ROLES.clientRead)) {
    redirect("/dashboard")
  }

  const { id } = await params
  const client = await prisma.client.findFirst({
    where: {
      id,
      companyId: user.companyId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      type: true,
      status: true,
      source: true,
      industry: true,
      country: true,
      city: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      contacts: {
        orderBy: [
          {
            archivedAt: "asc",
          },
          {
            isPrimary: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          jobTitle: true,
          department: true,
          email: true,
          phone: true,
          whatsapp: true,
          isPrimary: true,
          isDecisionMaker: true,
          notes: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          projects: true,
          invoices: true,
          salesOpportunities: true,
          leads: true,
          serviceRequests: true,
        },
      },
    },
  })

  if (!client) {
    notFound()
  }

  return (
    <ClientContactsClient
      client={{
        ...client,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString(),
        contacts: client.contacts.map((contact) => ({
          ...contact,
          archivedAt: contact.archivedAt?.toISOString() ?? null,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString(),
        })),
      }}
      canManage={hasRole(user.role, ACCESS_ROLES.clientManagement)}
      timeZone={user.company.timezone}
    />
  )
}
