import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { ApiError } from "@/lib/api-response"
import { clientContactIdentity } from "@/lib/client-contact"
import { prisma } from "@/lib/prisma"

type DatabaseClient = Prisma.TransactionClient | typeof prisma

export function nullableClientContactText(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export async function requireClientAccount(
  db: DatabaseClient,
  companyId: string,
  clientId: string,
) {
  const client = await db.client.findFirst({
    where: {
      id: clientId,
      companyId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
    },
  })

  if (!client) {
    throw new ApiError("العميل غير موجود", 404, "CLIENT_NOT_FOUND")
  }

  return client
}

export async function syncClientPrimaryContact(
  db: DatabaseClient,
  companyId: string,
  clientId: string,
) {
  const primaryContact = await db.clientContact.findFirst({
    where: {
      companyId,
      clientId,
      isPrimary: true,
      archivedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  })

  await db.client.updateMany({
    where: {
      id: clientId,
      companyId,
    },
    data: {
      email: primaryContact?.email ?? null,
      phone: primaryContact?.phone ?? null,
    },
  })

  return primaryContact
}

export async function makePrimaryClientContact(
  db: DatabaseClient,
  companyId: string,
  clientId: string,
  contactId: string,
) {
  const contact = await db.clientContact.findFirst({
    where: {
      id: contactId,
      companyId,
      clientId,
      archivedAt: null,
    },
  })

  if (!contact) {
    throw new ApiError(
      "جهة الاتصال غير موجودة أو مؤرشفة",
      404,
      "CLIENT_CONTACT_NOT_FOUND",
    )
  }

  await db.clientContact.updateMany({
    where: {
      companyId,
      clientId,
      isPrimary: true,
      id: {
        not: contact.id,
      },
    },
    data: {
      isPrimary: false,
    },
  })

  const primaryContact = await db.clientContact.update({
    where: {
      id: contact.id,
    },
    data: {
      isPrimary: true,
    },
  })

  await syncClientPrimaryContact(db, companyId, clientId)

  return primaryContact
}

export async function chooseReplacementPrimaryContact(
  db: DatabaseClient,
  companyId: string,
  clientId: string,
  excludedContactId?: string,
) {
  const replacement = await db.clientContact.findFirst({
    where: {
      companyId,
      clientId,
      archivedAt: null,
      ...(excludedContactId
        ? {
            id: {
              not: excludedContactId,
            },
          }
        : {}),
    },
    orderBy: [
      {
        isDecisionMaker: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
    },
  })

  if (replacement) {
    return makePrimaryClientContact(
      db,
      companyId,
      clientId,
      replacement.id,
    )
  }

  await syncClientPrimaryContact(db, companyId, clientId)
  return null
}

export async function ensureClientContactFromSnapshot({
  db,
  companyId,
  clientId,
  name,
  email,
  phone,
  notes,
}: {
  db: DatabaseClient
  companyId: string
  clientId: string
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}) {
  const existingPrimary = await db.clientContact.findFirst({
    where: {
      companyId,
      clientId,
      isPrimary: true,
      archivedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  const identity = clientContactIdentity({
    email,
    phone,
  })

  const matchingContact =
    identity.emailNormalized || identity.phoneNormalized
      ? await db.clientContact.findFirst({
          where: {
            companyId,
            clientId,
            archivedAt: null,
            name: {
              equals: name.trim(),
              mode: "insensitive",
            },
            OR: [
              ...(identity.emailNormalized
                ? [{ emailNormalized: identity.emailNormalized }]
                : []),
              ...(identity.phoneNormalized
                ? [{ phoneNormalized: identity.phoneNormalized }]
                : []),
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
        })
      : null

  if (matchingContact) {
    const contact = existingPrimary
      ? matchingContact
      : await makePrimaryClientContact(
          db,
          companyId,
          clientId,
          matchingContact.id,
        )

    return {
      contact,
      created: false,
    }
  }

  const contact = await db.clientContact.create({
    data: {
      companyId,
      clientId,
      name: name.trim(),
      email: nullableClientContactText(email),
      phone: nullableClientContactText(phone),
      notes: nullableClientContactText(notes),
      isPrimary: !existingPrimary,
      ...identity,
    },
  })

  if (contact.isPrimary) {
    await syncClientPrimaryContact(db, companyId, clientId)
  }

  return {
    contact,
    created: true,
  }
}
