import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { assertClosureTransition, closureBlockerCount, projectClosureMutationSchema } from "../../src/lib/project-closure"

test("PROJ-06 requires durable closure evidence", () => {
  assert.equal(projectClosureMutationSchema.safeParse({ action: "SUBMIT", outcome: "SUCCESS", summary: "short" }).success, false)
  assert.equal(projectClosureMutationSchema.safeParse({ action: "SUBMIT", outcome: "SUCCESS", summary: "تم تسليم النطاق المتفق عليه بالكامل", lessonsLearned: "اعتماد مراجعات مرحلية مبكرة في المشاريع القادمة", clientHandoverRef: "HANDOVER-2026-18", internalArchiveRef: "ARCHIVE/PROJECTS/18" }).success, true)
})

test("closure lifecycle preserves review before completion and archive", () => {
  assert.doesNotThrow(() => assertClosureTransition(null, "SAVE_DRAFT"))
  assert.doesNotThrow(() => assertClosureTransition("DRAFT", "SUBMIT"))
  assert.doesNotThrow(() => assertClosureTransition("READY_FOR_REVIEW", "COMPLETE"))
  assert.doesNotThrow(() => assertClosureTransition("COMPLETED", "ARCHIVE"))
  assert.throws(() => assertClosureTransition("DRAFT", "COMPLETE"), /PROJECT_CLOSURE_TRANSITION_NOT_ALLOWED/)
})

test("closure gate totals all operational blockers", () => {
  assert.equal(closureBlockerCount({ incompleteDeliverables: 2, openChangeRequests: 1, openRisks: 3, openIssues: 1, incompleteTasks: 4 }), 11)
})

test("PROJ-06 persistence, API, UI and audit contracts exist", () => {
  const migration = readFileSync("prisma/migrations/20260808030000_proj_06_project_closure/migration.sql", "utf8")
  const route = readFileSync("src/app/api/projects/[id]/closure/route.ts", "utf8")
  const panel = readFileSync("src/app/dashboard/projects/[id]/ProjectClosurePanel.tsx", "utf8")
  assert.match(migration, /ProjectClosure_evidence_check/)
  assert.match(migration, /ProjectClosure_archived_check/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /isolationLevel: "Serializable"/)
  assert.match(route, /PROJECT_CLOSURE_BLOCKED/)
  assert.match(panel, /مرجع تسليم العميل/)
  assert.match(panel, /الدروس المستفادة/)
})
