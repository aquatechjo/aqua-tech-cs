import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  acceptedProposalDeliverableSeeds,
  projectDeliverableCreateSchema,
  projectDeliverableNeedsActivation,
  projectDeliverableTransitionIssues,
} from "../../src/lib/project-deliverable"
import type { ProposalVersionContent } from "../../src/lib/proposal"

const proposalContent: ProposalVersionContent = {
  contractVersion: "PROPOSAL_V1",
  title: "عرض منصة التشغيل",
  validityDays: 30,
  estimatedDuration: "8 أسابيع",
  sections: [
    {
      id: "summary",
      kind: "SUMMARY",
      audience: "CLIENT",
      title: "الملخص",
      body: "منصة تشغيل داخلية.",
    },
  ],
  paymentMilestones: [
    {
      id: "deposit",
      label: "دفعة البدء",
      percentage: "100.00",
      dueCondition: "عند البدء",
    },
  ],
  commercial: {
    currency: "JOD",
    items: [
      {
        id: "service-1",
        kind: "SERVICE",
        title: "خدمة التنفيذ",
        description: "إدارة التنفيذ",
        quantity: "1",
        unitPrice: "300.00",
        lineTotal: "300.00",
      },
      {
        id: "deliverable-1",
        kind: "DELIVERABLE",
        title: "لوحة التشغيل",
        description: "لوحة تشغيل معتمدة",
        quantity: "1",
        unitPrice: "700.00",
        lineTotal: "700.00",
      },
    ],
    discount: { mode: "NONE", value: "0", amount: "0.00" },
    tax: { mode: "NONE", value: "0", amount: "0.00" },
    totals: {
      clientSubtotal: "1000.00",
      discountAmount: "0.00",
      netRevenue: "1000.00",
      taxAmount: "0.00",
      grandTotal: "1000.00",
    },
    clientNotes: "",
  },
}

test("PROJ-03 seeds only explicit accepted-proposal deliverables", () => {
  assert.deepEqual(
    acceptedProposalDeliverableSeeds({
      workspaceId: "proposal-workspace-1",
      version: 4,
      content: proposalContent,
    }),
    [
      {
        title: "لوحة التشغيل",
        description: "لوحة تشغيل معتمدة",
        acceptanceCriteria: null,
        sourceRef:
          "proposal:proposal-workspace-1:v4:item:deliverable-1",
        sortOrder: 0,
      },
    ],
  )
})

test("deliverable transitions preserve a governed review path", () => {
  assert.deepEqual(
    projectDeliverableTransitionIssues({
      currentStatus: "PLANNED",
      nextStatus: "IN_PROGRESS",
    }),
    [],
  )
  assert.deepEqual(
    projectDeliverableTransitionIssues({
      currentStatus: "IN_PROGRESS",
      nextStatus: "READY_FOR_REVIEW",
    }),
    [],
  )
  assert.match(
    projectDeliverableTransitionIssues({
      currentStatus: "READY_FOR_REVIEW",
      nextStatus: "CHANGES_REQUESTED",
    }).join(" "),
    /ملاحظة/,
  )
  assert.match(
    projectDeliverableTransitionIssues({
      currentStatus: "READY_FOR_REVIEW",
      nextStatus: "ACCEPTED",
    }).join(" "),
    /مرجع اعتماد/,
  )
  assert.deepEqual(
    projectDeliverableTransitionIssues({
      currentStatus: "READY_FOR_REVIEW",
      nextStatus: "ACCEPTED",
      acceptanceReference: "بريد العميل 2026-08-01",
    }),
    [],
  )
  assert.match(
    projectDeliverableTransitionIssues({
      currentStatus: "ACCEPTED",
      nextStatus: "IN_PROGRESS",
    }).join(" "),
    /لا يمكن/,
  )
})

test("planning is editable before activation but execution is not", () => {
  assert.equal(projectDeliverableNeedsActivation("PLANNED"), false)
  assert.equal(projectDeliverableNeedsActivation("CANCELLED"), false)
  assert.equal(projectDeliverableNeedsActivation("IN_PROGRESS"), true)
  assert.equal(projectDeliverableNeedsActivation("READY_FOR_REVIEW"), true)
  assert.equal(projectDeliverableNeedsActivation("ACCEPTED"), true)
})

test("manual deliverable input is bounded and date-only", () => {
  assert.equal(
    projectDeliverableCreateSchema.safeParse({
      title: "تسليم دليل التشغيل",
      description: "دليل الاستخدام والتشغيل",
      acceptanceCriteria: "مراجعة جميع السيناريوهات",
      dueDate: "2026-08-10",
      sortOrder: 2,
    }).success,
    true,
  )
  assert.equal(
    projectDeliverableCreateSchema.safeParse({
      title: "x",
      dueDate: "10/08/2026",
    }).success,
    false,
  )
})

test("deliverable persistence is additive, constrained, and backfills accepted scope", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731090000_proj_03_delivery_baseline/migration.sql",
    ),
    "utf8",
  )

  assert.match(schema, /model ProjectDeliverable\s*\{/)
  assert.match(schema, /sourceRef\s+String\?/)
  assert.match(schema, /@@unique\(\[projectId, sourceRef\]\)/)
  assert.match(migration, /ProjectDeliverable_acceptance_check/)
  assert.match(
    migration,
    /ProjectDeliverable_decidedById_fkey[\s\S]+ON DELETE RESTRICT/,
  )
  assert.match(migration, /jsonb_array_elements/)
  assert.match(migration, /item\.value->>'kind' = 'DELIVERABLE'/)
  assert.match(migration, /ON CONFLICT \("projectId", "sourceRef"\) DO NOTHING/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})

test("deliverable APIs are tenant-scoped, locked, and readiness-aware", () => {
  const createRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/deliverables/route.ts",
    ),
    "utf8",
  )
  const itemRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/deliverables/[deliverableId]/route.ts",
    ),
    "utf8",
  )
  const conversionRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/sales/opportunities/[id]/convert/route.ts",
    ),
    "utf8",
  )

  assert.match(createRoute, /assertSameOrigin\(request\)/)
  assert.match(createRoute, /requireProjectExecutionManager/)
  assert.match(createRoute, /companyId: user\.companyId/)
  assert.match(itemRoute, /FROM "ProjectDeliverable"[\s\S]+FOR UPDATE/)
  assert.match(itemRoute, /assertProjectExecutionActivated/)
  assert.match(itemRoute, /PROPOSAL_DELIVERABLE_SCOPE_IMMUTABLE/)
  assert.match(itemRoute, /PROPOSAL_DELIVERABLE_DELETE_BLOCKED/)
  assert.match(itemRoute, /reviewNotes: saved\.reviewNotes/)
  assert.doesNotMatch(
    itemRoute,
    /parsed\.data\.status === "PLANNED"[\s\S]{0,80}\? null/,
  )
  assert.match(conversionRoute, /acceptedProposalDeliverableSeeds/)
  assert.match(conversionRoute, /projectDeliverable\.createMany/)
  assert.match(conversionRoute, /skipDuplicates: true/)
  assert.match(
    conversionRoute,
    /ActivityAction\.PROJECT_DELIVERABLE_CREATED/,
  )
})

test("project delivery UI uses canonical Aqua patterns", () => {
  const panel = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectDeliverablesPanel.tsx",
    ),
    "utf8",
  )
  const page = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/page.tsx",
    ),
    "utf8",
  )
  const client = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx",
    ),
    "utf8",
  )

  assert.match(panel, /AquaDataPanel/)
  assert.match(panel, /AquaModal/)
  assert.match(panel, /AquaConfirmDialog/)
  assert.match(panel, /من العرض المقبول/)
  assert.match(page, /deliverables:\s*\{/)
  assert.match(client, /ProjectDeliverablesPanel/)
})
