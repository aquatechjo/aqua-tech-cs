import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTaskVisibilityWhere,
  canAssignTaskTo,
  canUseTaskProject,
  taskScopeLabel,
  type TaskAccessScope,
} from "../../src/lib/task-scope"

function scope(
  overrides: Partial<TaskAccessScope> = {}
): TaskAccessScope {
  return {
    userId: "employee",
    dataScope: "personal",
    canViewCompanyTasks: false,
    managedUserIds: [],
    visibleProjectIds: ["project-a"],
    managedProjectIds: [],
    assignableUserIds: ["employee"],
    jobRoleName: "مصمم",
    ...overrides,
  }
}

test("personal task scope never expands to unrelated employees", () => {
  const where = buildTaskVisibilityWhere(scope())
  const serialized = JSON.stringify(where)

  assert.match(serialized, /"assignedToId"/u)
  assert.match(serialized, /"createdById":"employee"/u)
  assert.match(serialized, /"userId":\{"in":\["employee"\]\}/u)
  assert.doesNotMatch(serialized, /outside-member/u)
  assert.equal(taskScopeLabel(scope()), "مهامي")
})

test("team task scope includes managed members and managed projects", () => {
  const teamScope = scope({
    dataScope: "team",
    managedUserIds: ["member-a", "member-b"],
    managedProjectIds: ["managed-project"],
    assignableUserIds: ["employee", "member-a", "member-b"],
  })
  const serialized = JSON.stringify(
    buildTaskVisibilityWhere(teamScope)
  )

  assert.match(serialized, /member-a/u)
  assert.match(serialized, /member-b/u)
  assert.match(serialized, /managed-project/u)
  assert.equal(canAssignTaskTo(teamScope, "member-a"), true)
  assert.equal(canAssignTaskTo(teamScope, "outside-member"), false)
  assert.equal(taskScopeLabel(teamScope), "مهام فريقي")
})

test("company task scope can view and assign across the company", () => {
  const companyScope = scope({
    dataScope: "company",
    canViewCompanyTasks: true,
    assignableUserIds: [],
    visibleProjectIds: [],
  })

  assert.deepEqual(buildTaskVisibilityWhere(companyScope), {})
  assert.equal(
    canAssignTaskTo(companyScope, "any-company-member"),
    true
  )
  assert.equal(
    canUseTaskProject(companyScope, "any-company-project"),
    true
  )
  assert.equal(taskScopeLabel(companyScope), "مهام الشركة")
})

test("personal task creation stays inside visible projects", () => {
  const personalScope = scope()

  assert.equal(canAssignTaskTo(personalScope, "employee"), true)
  assert.equal(canAssignTaskTo(personalScope, "other"), false)
  assert.equal(canUseTaskProject(personalScope, "project-a"), true)
  assert.equal(canUseTaskProject(personalScope, "project-b"), false)
})
