import assert from "node:assert/strict"
import test from "node:test"

import {
  addWorkflowDays,
  defaultWorkflowTemplates,
  parseWorkflowDefinition,
  suggestWorkflowTemplateCode,
  summarizeWorkflowDefinition,
} from "../../src/lib/project-workflow"

test("default workflow templates have valid independent definitions", () => {
  assert.equal(defaultWorkflowTemplates.length, 4)
  assert.equal(
    defaultWorkflowTemplates.filter((template) => template.isDefault).length,
    1
  )

  for (const template of defaultWorkflowTemplates) {
    const definition = parseWorkflowDefinition(template.definition)
    const summary = summarizeWorkflowDefinition(definition)

    assert.ok(summary.stageCount >= 4)
    assert.ok(summary.taskCount >= summary.stageCount)
    assert.ok(summary.approvalCount >= 1)
    assert.ok(summary.ruleCount >= 1)
    assert.ok(
      definition.rules.some((rule) => rule.channel === "N8N_EVENT")
    )
  }
})

test("workflow suggestion maps service hints and keeps a safe fallback", () => {
  assert.equal(
    suggestWorkflowTemplateCode("تطوير موقع شركة"),
    "WEBSITE_DELIVERY"
  )
  assert.equal(
    suggestWorkflowTemplateCode("حملة تسويق ومحتوى"),
    "GROWTH_CAMPAIGN"
  )
  assert.equal(
    suggestWorkflowTemplateCode("منصة SaaS وأتمتة"),
    "SAAS_PRODUCT"
  )
  assert.equal(
    suggestWorkflowTemplateCode("خدمة خاصة"),
    "CUSTOM_DELIVERY"
  )
})

test("workflow validation rejects missing references and dependency cycles", () => {
  const missingStage = {
    stages: [{ code: "ONE", name: "مرحلة أولى", sortOrder: 10 }],
    tasks: [
      {
        code: "TASK",
        stageCode: "MISSING",
        title: "مهمة اختبار",
        sortOrder: 10,
        dependsOnTaskCodes: [],
      },
    ],
    approvals: [],
    rules: [],
  }
  const dependencyCycle = {
    stages: [{ code: "ONE", name: "مرحلة أولى", sortOrder: 10 }],
    tasks: [
      {
        code: "A",
        stageCode: "ONE",
        title: "المهمة الأولى",
        sortOrder: 10,
        dependsOnTaskCodes: ["B"],
      },
      {
        code: "B",
        stageCode: "ONE",
        title: "المهمة الثانية",
        sortOrder: 20,
        dependsOnTaskCodes: ["A"],
      },
    ],
    approvals: [],
    rules: [],
  }

  assert.throws(() => parseWorkflowDefinition(missingStage))
  assert.throws(() => parseWorkflowDefinition(dependencyCycle))
})

test("workflow due offsets do not mutate the project start date", () => {
  const start = new Date("2026-07-27T00:00:00.000Z")
  const due = addWorkflowDays(start, 5)

  assert.equal(start.toISOString(), "2026-07-27T00:00:00.000Z")
  assert.equal(due?.toISOString(), "2026-08-01T00:00:00.000Z")
  assert.equal(addWorkflowDays(start, undefined), null)
})
