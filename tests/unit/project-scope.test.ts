import assert from "node:assert/strict"
import test from "node:test"

import {
  buildProjectVisibilityWhere,
  canManageProject,
  canManageProjectMetadata,
  canViewProject,
  projectScopeFromTaskScope,
  projectScopeLabel,
} from "../../src/lib/project-scope"
import type { TaskAccessScope } from "../../src/lib/task-scope"

function taskScope(
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

test("personal project scope stays inside visible project ids", () => {
  const scope = projectScopeFromTaskScope(
    "MEMBER",
    taskScope()
  )

  assert.deepEqual(buildProjectVisibilityWhere(scope), {
    id: {
      in: ["project-a"],
    },
  })
  assert.equal(canViewProject(scope, "project-a"), true)
  assert.equal(canViewProject(scope, "project-b"), false)
  assert.equal(canManageProject(scope, "project-a"), false)
  assert.equal(canManageProjectMetadata(scope), false)
  assert.equal(scope.canViewProjectBudgets, false)
  assert.equal(projectScopeLabel(scope), "مشاريعي")
})

test("team project scope separates visibility execution and metadata", () => {
  const scope = projectScopeFromTaskScope(
    "MEMBER",
    taskScope({
      dataScope: "team",
      visibleProjectIds: ["project-a", "project-b"],
      managedProjectIds: ["project-b"],
    })
  )

  assert.equal(canViewProject(scope, "project-a"), true)
  assert.equal(canManageProject(scope, "project-a"), false)
  assert.equal(canManageProject(scope, "project-b"), true)
  assert.equal(canManageProjectMetadata(scope), false)
  assert.equal(projectScopeLabel(scope), "مشاريع فريقي")
})

test("company project managers can create and edit metadata", () => {
  const scope = projectScopeFromTaskScope(
    "OPERATIONS_MANAGER",
    taskScope({
      dataScope: "company",
      canViewCompanyTasks: true,
      visibleProjectIds: [],
    })
  )

  assert.deepEqual(buildProjectVisibilityWhere(scope), {})
  assert.equal(scope.canViewCompanyProjects, true)
  assert.equal(scope.canCreateProjects, true)
  assert.equal(canManageProjectMetadata(scope), true)
  assert.equal(canViewProject(scope, "any-project"), true)
  assert.equal(canManageProject(scope, "any-project"), true)
  assert.equal(scope.canViewProjectBudgets, true)
  assert.equal(projectScopeLabel(scope), "مشاريع الشركة")
})

test("finance visibility does not grant company project management", () => {
  const scope = projectScopeFromTaskScope(
    "FINANCE_MANAGER",
    taskScope()
  )

  assert.equal(scope.canViewCompanyProjects, false)
  assert.equal(scope.canCreateProjects, false)
  assert.equal(canManageProjectMetadata(scope), false)
  assert.equal(scope.canViewProjectBudgets, true)
})
