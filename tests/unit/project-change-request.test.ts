import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { canApproveProjectChange } from "../../src/lib/access-control"
import {
  projectChangeActionIssues,
  projectChangeDraftSchema,
  projectChangeResultSourceRef,
  projectChangeTargetIssues,
} from "../../src/lib/project-change-request"

test("PROJ-04 validates multi-item scope changes and duplicate targets", () => {
  const valid = {
    title: "توسعة نطاق لوحة التشغيل",
    businessReason: "أضاف العميل مسار اعتماد جديدًا بعد بدء المشروع",
    scheduleImpactDays: 7,
    commercialImpact: "REQUIRES_QUOTE" as const,
    commercialReference: null,
    clientApprovalRequired: true,
    clientApprovalReference: null,
    items: [
      {
        action: "ADD_DELIVERABLE" as const,
        title: "لوحة اعتماد إضافية",
        description: "لوحة خاصة بالمراجعين",
        dueDate: "2026-08-20",
        sortOrder: 3,
      },
      {
        action: "MODIFY_DELIVERABLE" as const,
        targetDeliverableId: "deliverable-1",
        title: "لوحة التشغيل الموسعة",
        description: "النطاق الجديد بعد الموافقة",
        phaseId: null,
        dueDate: "2026-08-25",
      },
    ],
  }

  assert.equal(projectChangeDraftSchema.safeParse(valid).success, true)
  assert.equal(
    projectChangeDraftSchema.safeParse({
      ...valid,
      items: [
        valid.items[1],
        {
          action: "CANCEL_DELIVERABLE",
          targetDeliverableId: "deliverable-1",
          reason: "استبدل بالتسليم الجديد",
        },
      ],
    }).success,
    false,
  )
  assert.equal(
    projectChangeDraftSchema.safeParse({
      ...valid,
      commercialImpact: "APPROVED",
      commercialReference: "",
    }).success,
    false,
  )
})

test("change request lifecycle requires evidence and preserves terminal states", () => {
  assert.deepEqual(
    projectChangeActionIssues({
      status: "DRAFT",
      action: "SUBMIT",
      itemCount: 1,
      clientApprovalRequired: true,
      commercialImpact: "NONE",
    }),
    [],
  )
  assert.match(
    projectChangeActionIssues({
      status: "IN_REVIEW",
      action: "APPROVE",
      itemCount: 1,
      clientApprovalRequired: true,
      clientApprovalReference: null,
      commercialImpact: "NONE",
    }).join(" "),
    /موافقة العميل/,
  )
  assert.match(
    projectChangeActionIssues({
      status: "IN_REVIEW",
      action: "APPROVE",
      itemCount: 1,
      clientApprovalRequired: false,
      commercialImpact: "REQUIRES_QUOTE",
    }).join(" "),
    /التسعير/,
  )
  assert.deepEqual(
    projectChangeActionIssues({
      status: "IN_REVIEW",
      action: "APPROVE",
      itemCount: 1,
      clientApprovalRequired: true,
      clientApprovalReference: "ملحق عقد CR-2026-0001",
      commercialImpact: "APPROVED",
      commercialReference: "Q-2026-018",
    }),
    [],
  )
  assert.match(
    projectChangeActionIssues({
      status: "APPLIED",
      action: "CANCEL",
      itemCount: 1,
      clientApprovalRequired: false,
      commercialImpact: "NONE",
    }).join(" "),
    /لا يمكن/,
  )
})

test("accepted and cancelled deliverables cannot be targeted", () => {
  assert.deepEqual(
    projectChangeTargetIssues({
      action: "ADD_DELIVERABLE",
      targetStatus: null,
    }),
    [],
  )
  assert.match(
    projectChangeTargetIssues({
      action: "MODIFY_DELIVERABLE",
      targetStatus: "ACCEPTED",
    }).join(" "),
    /معتمد/,
  )
  assert.deepEqual(
    projectChangeTargetIssues({
      action: "CANCEL_DELIVERABLE",
      targetStatus: "IN_PROGRESS",
    }),
    [],
  )
  assert.equal(
    projectChangeResultSourceRef("change-1", "item-2"),
    "change:change-1:item:item-2",
  )
})

test("change approval separates authoring from management review", () => {
  assert.equal(
    canApproveProjectChange(
      { id: "admin-1", role: "ADMIN" },
      "author-1",
    ),
    true,
  )
  assert.equal(
    canApproveProjectChange(
      { id: "admin-1", role: "ADMIN" },
      "admin-1",
    ),
    false,
  )
  assert.equal(
    canApproveProjectChange(
      { id: "owner-1", role: "OWNER" },
      "owner-1",
    ),
    true,
  )
  assert.equal(
    canApproveProjectChange(
      { id: "member-1", role: "MEMBER" },
      "author-1",
    ),
    false,
  )
})

test("change request persistence is additive and constrained", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  )
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260731220000_proj_04_change_requests/migration.sql",
    ),
    "utf8",
  )

  assert.match(schema, /model ProjectChangeRequest\s*\{/)
  assert.match(schema, /model ProjectChangeRequestItem\s*\{/)
  assert.match(schema, /targetUpdatedAt\s+DateTime\?/)
  assert.match(schema, /CHANGE_REQUEST/)
  assert.match(migration, /ProjectChangeRequestItem_shape_check/)
  assert.match(migration, /ProjectChangeRequest_client_approval_check/)
  assert.match(migration, /ProjectChangeRequest_submission_state_check/)
  assert.match(migration, /ProjectChangeRequest_application_state_check/)
  assert.match(
    migration,
    /ProjectChangeRequest_reviewedById_fkey[\s\S]+ON DELETE RESTRICT/,
  )
  assert.match(
    migration,
    /ProjectChangeRequestItem_phaseId_fkey[\s\S]+ON DELETE RESTRICT/,
  )
  assert.match(migration, /ALTER TYPE "ProjectDeliverableSource" ADD VALUE/)
  assert.doesNotMatch(migration, /\bDROP\b/i)
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i)
})

test("change request APIs are scoped locked stale-safe and atomic", () => {
  const createRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/change-requests/route.ts",
    ),
    "utf8",
  )
  const itemRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/change-requests/[changeRequestId]/route.ts",
    ),
    "utf8",
  )
  const deliverableRoute = readFileSync(
    resolve(
      process.cwd(),
      "src/app/api/projects/[id]/deliverables/[deliverableId]/route.ts",
    ),
    "utf8",
  )

  assert.match(createRoute, /assertSameOrigin\(request\)/)
  assert.match(createRoute, /requireProjectExecutionManager/)
  assert.match(createRoute, /nextDocumentNumber[\s\S]+"CR"/)
  assert.match(createRoute, /isolationLevel: "Serializable"/)
  assert.match(itemRoute, /FROM "ProjectChangeRequest"[\s\S]+FOR UPDATE/)
  assert.match(itemRoute, /FROM "ProjectDeliverable"[\s\S]+FOR UPDATE/)
  assert.match(itemRoute, /PROJECT_CHANGE_TARGET_STALE/)
  assert.match(itemRoute, /projectChangeResultSourceRef/)
  assert.match(itemRoute, /source: "CHANGE_REQUEST"/)
  assert.match(itemRoute, /isolationLevel: "Serializable"/)
  assert.match(itemRoute, /assertCanApproveProjectChange/)
  assert.match(deliverableRoute, /existing\.source !== "MANUAL"/)
  assert.match(
    deliverableRoute,
    /GOVERNED_DELIVERABLE_CANCELLATION_REQUIRES_CHANGE_REQUEST/,
  )
  assert.match(
    deliverableRoute,
    /projectChangeRequestItem\.count/,
  )
})

test("project change UI uses canonical Aqua workflow surfaces", () => {
  const panel = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectChangeRequestsPanel.tsx",
    ),
    "utf8",
  )
  const css = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectChangeRequestsPanel.module.css",
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
  const deliverablesPanel = readFileSync(
    resolve(
      process.cwd(),
      "src/app/dashboard/projects/[id]/ProjectDeliverablesPanel.tsx",
    ),
    "utf8",
  )

  assert.match(panel, /AquaDataPanel/)
  assert.match(panel, /AquaModal/)
  assert.match(panel, /AquaConfirmDialog/)
  assert.match(panel, /طلبات تغيير النطاق/)
  assert.match(panel, /ADD_DELIVERABLE/)
  assert.match(panel, /MODIFY_DELIVERABLE/)
  assert.match(panel, /CANCEL_DELIVERABLE/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(page, /changeRequests:/)
  assert.match(page, /canApproveProjectChange/)
  assert.match(
    deliverablesPanel,
    /deliverable\.source === "MANUAL"/,
  )
  assert.match(deliverablesPanel, /transitionsFor\(deliverable\)/)
})
