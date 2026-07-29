import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  clientContactDuplicateMatch,
  clientContactHasReachableChannel,
  clientContactIdentity,
  normalizeClientContactEmail,
  normalizeClientContactPhone,
} from "../../src/lib/client-contact"

test("client contact identity normalizes email and phone channels", () => {
  assert.equal(
    normalizeClientContactEmail("  Contact@Example.COM "),
    "contact@example.com",
  )
  assert.equal(normalizeClientContactPhone("+962 79 123 4567"), "962791234567")
  assert.deepEqual(
    clientContactIdentity({
      email: "Contact@Example.COM",
      phone: "+962 79 123 4567",
      whatsapp: "079-765-4321",
    }),
    {
      emailNormalized: "contact@example.com",
      phoneNormalized: "962791234567",
      whatsappNormalized: "0797654321",
    },
  )
})

test("client contact duplicate review uses reachable identities", () => {
  const first = clientContactIdentity({
    email: "person@example.com",
    phone: "+962790000001",
  })
  const sameEmail = clientContactIdentity({
    email: "PERSON@example.com",
    phone: "+962790000002",
  })
  const different = clientContactIdentity({
    email: "other@example.com",
    phone: "+962790000003",
  })

  assert.equal(clientContactDuplicateMatch(first, sameEmail), true)
  assert.equal(clientContactDuplicateMatch(first, different), false)
  assert.equal(
    clientContactHasReachableChannel({
      email: "",
      phone: "",
      whatsapp: "",
    }),
    false,
  )
  assert.equal(
    clientContactHasReachableChannel({
      whatsapp: "+962790000004",
    }),
    true,
  )
})

test("CRM-03 keeps contacts tenant-scoped, auditable, and primary-safe", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260729213000_crm_03_client_contacts/migration.sql",
    "utf8",
  )
  const collectionRoute = readFileSync(
    "src/app/api/clients/[id]/contacts/route.ts",
    "utf8",
  )
  const detailRoute = readFileSync(
    "src/app/api/clients/[id]/contacts/[contactId]/route.ts",
    "utf8",
  )
  const clientPage = readFileSync(
    "src/app/dashboard/clients/[id]/page.tsx",
    "utf8",
  )
  const clientSurface = readFileSync(
    "src/app/dashboard/clients/[id]/ClientContactsClient.tsx",
    "utf8",
  )
  const opportunityConversion = readFileSync(
    "src/app/api/sales/opportunities/[id]/convert/route.ts",
    "utf8",
  )
  const requestConversion = readFileSync(
    "src/app/api/service-requests/[id]/convert/route.ts",
    "utf8",
  )

  assert.match(schema, /model ClientContact \{/)
  assert.match(schema, /companyId String/)
  assert.match(schema, /clientId String/)
  assert.match(migration, /ClientContact_one_primary_per_client/)
  assert.match(
    migration,
    /WHERE "isPrimary" = true AND "archivedAt" IS NULL/,
  )
  assert.match(collectionRoute, /ACCESS_ROLES\.clientManagement/)
  assert.match(collectionRoute, /assertSameOrigin/)
  assert.match(collectionRoute, /CLIENT_CONTACT_DUPLICATE/)
  assert.match(detailRoute, /FOR UPDATE/)
  assert.match(detailRoute, /chooseReplacementPrimaryContact/)
  assert.match(detailRoute, /CONTACT_PRIMARY_CHANGED/)
  assert.match(clientPage, /ACCESS_ROLES\.clientRead/)
  assert.match(clientPage, /companyId: user\.companyId/)
  assert.match(clientSurface, /AquaDataPanel/)
  assert.match(clientSurface, /mobileStrategy="stack"/)
  assert.match(clientSurface, /AquaModal/)
  assert.match(clientSurface, /AquaConfirmDialog/)
  assert.doesNotMatch(clientSurface, /window\.(confirm|prompt)/)
  assert.match(opportunityConversion, /ensureClientContactFromSnapshot/)
  assert.match(requestConversion, /ensureClientContactFromSnapshot/)
})
