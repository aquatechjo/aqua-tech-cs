import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  assertGovernanceActionAllowed,
  projectGovernanceCreateSchema,
  projectGovernanceMutationSchema,
  projectGovernancePrefix,
  projectRiskExposure,
  projectRiskExposureBand,
} from "../../src/lib/project-governance"

test("PROJ-05 validates kind-specific governance inputs", () => {
  assert.equal(
    projectGovernanceCreateSchema.safeParse({
      kind: "RISK",
      title: "تأخر اعتماد العميل",
      description: "قد يتأخر اعتماد المخرجات عن الموعد المخطط.",
      probability: "HIGH",
      impact: "CRITICAL",
      responsePlan: "تحديد موعد اعتماد واضح وتذكير العميل قبل الموعد.",
      dueDate: "2026-08-10",
    }).success,
    true,
  )

  assert.equal(
    projectGovernanceCreateSchema.safeParse({
      kind: "ISSUE",
      title: "تعطل التكامل",
      description: "فشل التكامل في بيئة الاختبار.",
      severity: "HIGH",
    }).success,
    true,
  )

  assert.equal(
    projectGovernanceCreateSchema.safeParse({
      kind: "DECISION",
      title: "اعتماد بنية التكامل",
      decision: "اعتماد Queue لفصل معالجة الأحداث.",
      rationale: "لمنع فقد الأحداث عند توقف المستهلك.",
    }).success,
    true,
  )

  assert.equal(
    projectGovernanceCreateSchema.safeParse({
      kind: "RISK",
      title: "بيانات ناقصة",
      description: "لا توجد خطة استجابة.",
      probability: "HIGH",
      impact: "HIGH",
    }).success,
    false,
  )
})

test("risk exposure is deterministic and banded", () => {
  assert.equal(projectRiskExposure("LOW", "LOW"), 1)
  assert.equal(projectRiskExposure("HIGH", "CRITICAL"), 12)
  assert.equal(projectRiskExposureBand(1), "LOW")
  assert.equal(projectRiskExposureBand(4), "MEDIUM")
  assert.equal(projectRiskExposureBand(8), "HIGH")
  assert.equal(projectRiskExposureBand(12), "CRITICAL")
})

test("governance references remain explicit per record kind", () => {
  assert.equal(projectGovernancePrefix("RISK"), "RSK")
  assert.equal(projectGovernancePrefix("ISSUE"), "ISS")
  assert.equal(projectGovernancePrefix("DECISION"), "DEC")
})

test("governance lifecycle blocks cross-kind and terminal mutations", () => {
  assert.doesNotThrow(() =>
    assertGovernanceActionAllowed("RISK", "OPEN", "UPDATE_RISK"),
  )
  assert.doesNotThrow(() =>
    assertGovernanceActionAllowed("ISSUE", "IN_PROGRESS", "RESOLVE_ISSUE"),
  )
  assert.doesNotThrow(() =>
    assertGovernanceActionAllowed("DECISION", "RECORDED", "SUPERSEDE_DECISION"),
  )
  assert.throws(
    () => assertGovernanceActionAllowed("RISK", "CLOSED", "UPDATE_RISK"),
    /PROJECT_GOVERNANCE_ACTION_NOT_ALLOWED/,
  )
  assert.throws(
    () => assertGovernanceActionAllowed("DECISION", "SUPERSEDED", "SUPERSEDE_DECISION"),
    /PROJECT_GOVERNANCE_ACTION_NOT_ALLOWED/,
  )
})

test("lifecycle schemas require durable resolution and closure evidence", () => {
  assert.equal(
    projectGovernanceMutationSchema.safeParse({
      action: "RESOLVE_ISSUE",
      resolution: "تم إصلاح إعدادات الاتصال وإعادة اختبار التكامل.",
    }).success,
    true,
  )
  assert.equal(
    projectGovernanceMutationSchema.safeParse({
      action: "CLOSE_RISK",
      closureNote: "x",
    }).success,
    false,
  )
})

test("PROJ-05 persistence is tenant-scoped and structurally constrained", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260801050000_proj_05_project_governance/migration.sql",
    "utf8",
  )

  assert.match(schema, /model ProjectGovernanceItem/)
  assert.match(schema, /@@unique\(\[companyId, referenceNumber\]\)/)
  assert.match(schema, /sourceRiskId String\? @unique/)
  assert.match(schema, /supersedesDecisionId String\? @unique/)
  assert.match(migration, /ProjectGovernanceItem_kind_status_check/)
  assert.match(migration, /ProjectGovernanceItem_kind_fields_check/)
  assert.match(migration, /ProjectGovernanceItem_resolution_check/)
  assert.match(migration, /ON DELETE RESTRICT/)
})

test("PROJ-05 APIs lock records and keep project ownership server-authoritative", () => {
  const collectionRoute = readFileSync(
    "src/app/api/projects/[id]/governance/route.ts",
    "utf8",
  )
  const itemRoute = readFileSync(
    "src/app/api/projects/[id]/governance/[itemId]/route.ts",
    "utf8",
  )

  for (const route of [collectionRoute, itemRoute]) {
    assert.match(route, /requireProjectExecutionManager/)
    assert.match(route, /assertSameOrigin/)
    assert.match(route, /readJsonBody/)
    assert.match(route, /companyId: user\.companyId/)
    assert.match(route, /isolationLevel: "Serializable"/)
    assert.match(route, /FOR UPDATE/)
  }

  assert.match(collectionRoute, /PROJECT_GOVERNANCE_OWNER_INVALID/)
  assert.match(collectionRoute, /PROJECT_GOVERNANCE_SOURCE_RISK_INVALID/)
  assert.match(itemRoute, /PROJECT_GOVERNANCE_ACTION_NOT_ALLOWED/)
  assert.match(itemRoute, /PROJECT_DECISION_ALREADY_SUPERSEDED/)
})

test("PROJ-05 surface exposes risk, issue, and immutable decision workflows", () => {
  const page = readFileSync(
    "src/app/dashboard/projects/[id]/page.tsx",
    "utf8",
  )
  const client = readFileSync(
    "src/app/dashboard/projects/[id]/ProjectExecutionClient.tsx",
    "utf8",
  )
  const panel = readFileSync(
    "src/app/dashboard/projects/[id]/ProjectGovernancePanel.tsx",
    "utf8",
  )
  const css = readFileSync(
    "src/app/dashboard/projects/[id]/ProjectGovernancePanel.module.css",
    "utf8",
  )

  assert.match(page, /governanceItems:/)
  assert.match(client, /<ProjectGovernancePanel/)
  assert.match(panel, /role="tablist"/)
  assert.match(panel, /AquaConfirmDialog/)
  assert.match(panel, /MATERIALIZE_RISK/)
  assert.match(panel, /SUPERSEDE_DECISION/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /var\(--at-/)
})
