import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  acceptedProposalConversionIssues,
  acceptedProposalProjectCode,
  acceptedProposalProjectConversionInputSchema,
  acceptedProposalProjectDescription,
  resolveClientCandidateIds,
} from "../../src/lib/project-conversion"
import type { ProposalVersionContent } from "../../src/lib/proposal"

const acceptedSnapshot = {
  workspaceStatus: "ACCEPTED",
  sentVersion: 3,
  sentClientContentHash: "client-hash-v3",
  version: {
    version: 3,
    contentHash: "proposal-hash-v3",
    clientContentHash: "client-hash-v3",
  },
  response: {
    id: "response-3",
    decision: "ACCEPTED",
    version: 3,
    clientContentHash: "client-hash-v3",
    authorityConfirmed: true,
  },
}

const proposalContent: ProposalVersionContent = {
  contractVersion: "PROPOSAL_V1",
  title: "عرض منصة العمليات",
  validityDays: 30,
  estimatedDuration: "8 أسابيع",
  sections: [
    {
      id: "summary",
      kind: "SUMMARY",
      audience: "CLIENT",
      title: "الملخص",
      body: "منصة تشغيل داخلية مترابطة.",
    },
    {
      id: "internal-note",
      kind: "INTERNAL_NOTE",
      audience: "INTERNAL",
      title: "ملاحظة داخلية",
      body: "لا يجب نسخ هذا النص إلى المشروع.",
    },
  ],
  paymentMilestones: [
    {
      id: "deposit",
      label: "دفعة البدء",
      percentage: "100.00",
      dueCondition: "بعد اعتماد الجاهزية",
    },
  ],
  commercial: {
    currency: "JOD",
    items: [
      {
        id: "service",
        kind: "SERVICE",
        title: "التنفيذ",
        description: "تنفيذ المنصة",
        quantity: "1",
        unitPrice: "1000.00",
        lineTotal: "1000.00",
      },
    ],
    discount: {
      mode: "NONE",
      value: "0",
      amount: "0.00",
    },
    tax: {
      mode: "NONE",
      value: "0",
      amount: "0.00",
    },
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

test("PROJ-01 conversion input requires explicit acceptance and a workflow", () => {
  assert.equal(
    acceptedProposalProjectConversionInputSchema.safeParse({
      projectName: "مشروع منصة العمليات",
      workflowTemplateId: "workflow-template-01",
      acceptanceConfirmed: true,
    }).success,
    true,
  )
  assert.equal(
    acceptedProposalProjectConversionInputSchema.safeParse({
      projectName: "مشروع منصة العمليات",
      workflowTemplateId: "workflow-template-01",
      acceptanceConfirmed: false,
    }).success,
    false,
  )
  assert.equal(
    acceptedProposalProjectConversionInputSchema.safeParse({
      projectName: "مشروع منصة العمليات",
      acceptanceConfirmed: true,
    }).success,
    false,
  )
})

test("accepted proposal conversion binds status, version, client hash, and authority", () => {
  assert.deepEqual(
    acceptedProposalConversionIssues(acceptedSnapshot),
    [],
  )
  assert.match(
    acceptedProposalConversionIssues({
      ...acceptedSnapshot,
      workspaceStatus: "SENT",
    }).join(" "),
    /مقبول/,
  )
  assert.match(
    acceptedProposalConversionIssues({
      ...acceptedSnapshot,
      response: {
        ...acceptedSnapshot.response,
        version: 2,
      },
    }).join(" "),
    /الإصدار/,
  )
  assert.match(
    acceptedProposalConversionIssues({
      ...acceptedSnapshot,
      response: {
        ...acceptedSnapshot.response,
        clientContentHash: "different-hash",
      },
    }).join(" "),
    /محتوى/,
  )
  assert.match(
    acceptedProposalConversionIssues({
      ...acceptedSnapshot,
      response: {
        ...acceptedSnapshot.response,
        authorityConfirmed: false,
      },
    }).join(" "),
    /صلاحية/,
  )
})

test("client resolution reuses one unique client and blocks ambiguous matches", () => {
  assert.deepEqual(resolveClientCandidateIds([]), {
    status: "NONE",
    clientId: null,
  })
  assert.deepEqual(
    resolveClientCandidateIds(["client-1", " client-1 "]),
    {
      status: "MATCHED",
      clientId: "client-1",
    },
  )
  assert.deepEqual(
    resolveClientCandidateIds(["client-1", "client-2"]),
    {
      status: "AMBIGUOUS",
      clientId: null,
    },
  )
})

test("project snapshot uses the accepted client narrative without internal sections", () => {
  assert.equal(acceptedProposalProjectCode("PROP-0042"), "PRJ-0042")
  assert.equal(acceptedProposalProjectCode("OFFER-7"), "PRJ-OFFER-7")

  const description = acceptedProposalProjectDescription({
    proposalNumber: "PROP-0042",
    version: 3,
    content: proposalContent,
  })

  assert.match(description, /PROP-0042/)
  assert.match(description, /الإصدار 3/)
  assert.match(description, /منصة تشغيل داخلية مترابطة/)
  assert.doesNotMatch(description, /لا يجب نسخ هذا النص/)
})

test("PROJ-01 route is tenant-scoped, locked, hash-verified, and replay-safe", () => {
  const route = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/sales/opportunities/[id]/convert/route.ts",
    ),
    "utf8",
  )
  const acceptedBranchStart = route.indexOf(
    "if (opportunity.proposalWorkspace)",
  )
  const legacyBranchStart = route.lastIndexOf(
    'if (opportunity.stage === "LOST")',
  )
  const acceptedBranch = route.slice(
    acceptedBranchStart,
    legacyBranchStart,
  )

  assert.ok(acceptedBranchStart >= 0)
  assert.ok(legacyBranchStart > acceptedBranchStart)
  assert.match(route, /assertSameOrigin\(request\)/)
  assert.match(route, /companyId: user\.companyId/)
  assert.match(route, /ACCESS_ROLES\.projectConversion/)
  assert.match(route, /FROM "SalesOpportunity"[\s\S]+FOR UPDATE/)
  assert.match(route, /FROM "ProposalWorkspace"[\s\S]+FOR UPDATE/)
  assert.match(acceptedBranch, /proposalContentHash\(acceptedContent\.data\)/)
  assert.match(
    acceptedBranch,
    /proposalClientContentHash\(acceptedContent\.data\)/,
  )
  assert.match(acceptedBranch, /OPPORTUNITY_PROJECT_ORIGIN_MISMATCH/)
  assert.match(acceptedBranch, /CLIENT_MATCH_AMBIGUOUS/)
  assert.match(acceptedBranch, /originProposalWorkspaceId/)
  assert.match(acceptedBranch, /originProposalResponseId/)
  assert.match(acceptedBranch, /status: "PLANNING"/)
  assert.doesNotMatch(acceptedBranch, /startDate:/)
  assert.doesNotMatch(acceptedBranch, /assignedToId/)
})

test("PROJ-01 persistence preserves immutable proposal provenance", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731050000_proj_01_accepted_proposal_conversion/migration.sql",
    ),
    "utf8",
  )

  assert.match(schema, /originProposalWorkspaceId String\?\s+@unique/)
  assert.match(schema, /originProposalResponseId\s+String\?\s+@unique/)
  assert.match(schema, /originProposalContentHash String\?/)
  assert.match(schema, /originClientContentHash\s+String\?/)
  assert.match(schema, /ProposalConvertedProject/)
  assert.match(schema, /ProposalResponseConvertedProject/)
  assert.match(migration, /Project_proposalOrigin_complete_check/)
  assert.match(migration, /Project_originProposalWorkspaceId_fkey/)
  assert.match(migration, /Project_originProposalResponseId_fkey/)
  assert.match(migration, /CREATE UNIQUE INDEX "Project_originProposalWorkspaceId_key"/)
  assert.match(migration, /CREATE UNIQUE INDEX "Project_originProposalResponseId_key"/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})

test("accepted proposals create planning workflows without automatic schedules or owners", () => {
  const workflowServer = readFileSync(
    resolve(process.cwd(), "src/lib/project-workflow-server.ts"),
    "utf8",
  )
  const projectPage = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx",
    ),
    "utf8",
  )

  assert.match(workflowServer, /return "NOT_STARTED"/)
  assert.match(
    workflowServer,
    /dueDate: project\.startDate[\s\S]+: null/,
  )
  assert.doesNotMatch(workflowServer, /assignedToId:/)
  assert.match(projectPage, /مشروع منشأ من عرض مقبول/)
  assert.match(projectPage, /دون تكليفات تلقائية/)
})

test("PROJ-01 workspace uses canonical confirmation and exposes the converted project", () => {
  const workspace = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/discovery/[id]/proposal/ProposalWorkspaceClient.tsx",
    ),
    "utf8",
  )
  const queue = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/proposals/page.tsx",
    ),
    "utf8",
  )

  assert.match(workspace, /<AquaConfirmDialog/)
  assert.match(workspace, /acceptanceConfirmed: true/)
  assert.match(workspace, /workflowTemplateId/)
  assert.match(workspace, /router\.push\(`\/dashboard\/projects/)
  assert.doesNotMatch(workspace, /window\.confirm/)
  assert.match(queue, /تم التحويل/)
  assert.match(queue, /فتح المشروع/)
})
