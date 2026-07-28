import { z } from "zod"

const workflowStageSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0),
  startOffsetDays: z.number().int().min(0).max(3650).optional(),
  dueOffsetDays: z.number().int().min(0).max(3650).optional(),
})

const workflowTaskSchema = z.object({
  code: z.string().trim().min(1).max(60),
  stageCode: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  sortOrder: z.number().int().min(0),
  estimatedHours: z.number().min(0).max(10000).optional(),
  dueOffsetDays: z.number().int().min(0).max(3650).optional(),
  ownerRole: z
    .enum(["PROJECT_LEAD", "MANAGER", "CONTRIBUTOR", "VIEWER"])
    .optional(),
  dependsOnTaskCodes: z.array(z.string().trim().min(1).max(60)).default([]),
})

const workflowApprovalSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(160),
  gate: z.enum([
    "PHASE_START",
    "PHASE_COMPLETION",
    "TASK_COMPLETION",
    "PROJECT_COMPLETION",
  ]),
  stageCode: z.string().trim().min(1).max(40).optional(),
  taskCode: z.string().trim().min(1).max(60).optional(),
  requiredRole: z
    .enum(["PROJECT_LEAD", "MANAGER", "CONTRIBUTOR", "VIEWER"])
    .optional(),
})

const workflowRuleSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(160),
  event: z.enum([
    "PROJECT_CREATED",
    "PROJECT_STARTED",
    "PHASE_STARTED",
    "PHASE_COMPLETED",
    "TASK_STARTED",
    "TASK_COMPLETED",
    "APPROVAL_REQUESTED",
    "APPROVAL_DECIDED",
    "PROJECT_COMPLETED",
  ]),
  channel: z.enum(["IN_APP", "EMAIL", "N8N_EVENT"]),
  eventKey: z.string().trim().min(2).max(120),
  configuration: z.record(z.string(), z.unknown()).default({}),
})

export const workflowDefinitionSchema = z
  .object({
    stages: z.array(workflowStageSchema).min(1).max(50),
    tasks: z.array(workflowTaskSchema).max(250),
    approvals: z.array(workflowApprovalSchema).max(100).default([]),
    rules: z.array(workflowRuleSchema).max(100).default([]),
  })
  .superRefine((definition, context) => {
    const stageCodes = new Set<string>()
    const taskCodes = new Set<string>()
    const approvalCodes = new Set<string>()
    const ruleCodes = new Set<string>()

    definition.stages.forEach((stage, index) => {
      if (stageCodes.has(stage.code)) {
        context.addIssue({
          code: "custom",
          path: ["stages", index, "code"],
          message: "رمز المرحلة مكرر",
        })
      }
      stageCodes.add(stage.code)
    })

    definition.tasks.forEach((task, index) => {
      if (taskCodes.has(task.code)) {
        context.addIssue({
          code: "custom",
          path: ["tasks", index, "code"],
          message: "رمز المهمة مكرر",
        })
      }
      taskCodes.add(task.code)

      if (!stageCodes.has(task.stageCode)) {
        context.addIssue({
          code: "custom",
          path: ["tasks", index, "stageCode"],
          message: "المهمة مرتبطة بمرحلة غير موجودة",
        })
      }
    })

    definition.tasks.forEach((task, index) => {
      task.dependsOnTaskCodes.forEach((dependencyCode, dependencyIndex) => {
        if (!taskCodes.has(dependencyCode)) {
          context.addIssue({
            code: "custom",
            path: ["tasks", index, "dependsOnTaskCodes", dependencyIndex],
            message: "المهمة السابقة غير موجودة",
          })
        }
        if (dependencyCode === task.code) {
          context.addIssue({
            code: "custom",
            path: ["tasks", index, "dependsOnTaskCodes", dependencyIndex],
            message: "لا يمكن للمهمة الاعتماد على نفسها",
          })
        }
      })
    })

    const dependencyMap = new Map(
      definition.tasks.map((task) => [task.code, task.dependsOnTaskCodes])
    )
    const visiting = new Set<string>()
    const visited = new Set<string>()

    function visitsCycle(code: string): boolean {
      if (visiting.has(code)) return true
      if (visited.has(code)) return false

      visiting.add(code)
      for (const dependency of dependencyMap.get(code) ?? []) {
        if (visitsCycle(dependency)) return true
      }
      visiting.delete(code)
      visited.add(code)
      return false
    }

    for (const task of definition.tasks) {
      if (visitsCycle(task.code)) {
        context.addIssue({
          code: "custom",
          path: ["tasks"],
          message: "تبعيات المهام تحتوي حلقة مغلقة",
        })
        break
      }
    }

    definition.approvals.forEach((approval, index) => {
      if (approvalCodes.has(approval.code)) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "code"],
          message: "رمز الموافقة مكرر",
        })
      }
      approvalCodes.add(approval.code)

      if (approval.stageCode && !stageCodes.has(approval.stageCode)) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "stageCode"],
          message: "الموافقة مرتبطة بمرحلة غير موجودة",
        })
      }
      if (approval.taskCode && !taskCodes.has(approval.taskCode)) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "taskCode"],
          message: "الموافقة مرتبطة بمهمة غير موجودة",
        })
      }
    })

    definition.rules.forEach((rule, index) => {
      if (ruleCodes.has(rule.code)) {
        context.addIssue({
          code: "custom",
          path: ["rules", index, "code"],
          message: "رمز قاعدة التشغيل مكرر",
        })
      }
      ruleCodes.add(rule.code)
    })
  })

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>

export type WorkflowTemplateSeed = {
  code: string
  name: string
  description: string
  isDefault: boolean
  definition: WorkflowDefinition
}

export const defaultWorkflowTemplates = [
  {
    code: "WEBSITE_DELIVERY",
    name: "تطوير وتسليم موقع",
    description: "من الاكتشاف والتصميم حتى الاختبار والإطلاق.",
    isDefault: false,
    definition: {
      stages: [
        { code: "DISCOVERY", name: "الاكتشاف", sortOrder: 10, dueOffsetDays: 3 },
        { code: "DESIGN", name: "التصميم", sortOrder: 20, startOffsetDays: 3, dueOffsetDays: 10 },
        { code: "DEVELOPMENT", name: "التطوير", sortOrder: 30, startOffsetDays: 10, dueOffsetDays: 24 },
        { code: "QA", name: "الاختبار", sortOrder: 40, startOffsetDays: 24, dueOffsetDays: 29 },
        { code: "LAUNCH", name: "الإطلاق والتسليم", sortOrder: 50, startOffsetDays: 29, dueOffsetDays: 32 },
      ],
      tasks: [
        { code: "DISCOVERY_BRIEF", stageCode: "DISCOVERY", title: "تثبيت نطاق المشروع والمتطلبات", priority: "HIGH", sortOrder: 10, estimatedHours: 4, dueOffsetDays: 2, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: [] },
        { code: "DISCOVERY_CONTENT", stageCode: "DISCOVERY", title: "جمع المحتوى والأصول", priority: "MEDIUM", sortOrder: 20, estimatedHours: 4, dueOffsetDays: 3, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["DISCOVERY_BRIEF"] },
        { code: "DESIGN_WIREFRAMES", stageCode: "DESIGN", title: "إعداد هيكل الصفحات", priority: "HIGH", sortOrder: 30, estimatedHours: 12, dueOffsetDays: 7, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["DISCOVERY_BRIEF"] },
        { code: "DESIGN_UI", stageCode: "DESIGN", title: "اعتماد التصميم المرئي", priority: "HIGH", sortOrder: 40, estimatedHours: 18, dueOffsetDays: 10, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["DESIGN_WIREFRAMES"] },
        { code: "DEV_BUILD", stageCode: "DEVELOPMENT", title: "تنفيذ الموقع", priority: "HIGH", sortOrder: 50, estimatedHours: 48, dueOffsetDays: 22, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["DESIGN_UI"] },
        { code: "DEV_CONTENT", stageCode: "DEVELOPMENT", title: "إدخال المحتوى النهائي", priority: "MEDIUM", sortOrder: 60, estimatedHours: 8, dueOffsetDays: 24, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["DEV_BUILD"] },
        { code: "QA_ACCEPTANCE", stageCode: "QA", title: "اختبار الجودة والقبول", priority: "HIGH", sortOrder: 70, estimatedHours: 12, dueOffsetDays: 29, ownerRole: "MANAGER", dependsOnTaskCodes: ["DEV_BUILD", "DEV_CONTENT"] },
        { code: "LAUNCH_HANDOVER", stageCode: "LAUNCH", title: "الإطلاق والتسليم والتوثيق", priority: "HIGH", sortOrder: 80, estimatedHours: 8, dueOffsetDays: 32, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["QA_ACCEPTANCE"] },
      ],
      approvals: [
        { code: "DESIGN_APPROVAL", name: "اعتماد التصميم", gate: "PHASE_COMPLETION", stageCode: "DESIGN", requiredRole: "PROJECT_LEAD" },
        { code: "LAUNCH_APPROVAL", name: "اعتماد الإطلاق", gate: "PROJECT_COMPLETION", requiredRole: "PROJECT_LEAD" },
      ],
      rules: [
        { code: "WEBSITE_PHASE_ALERT", name: "تنبيه بدء المرحلة", event: "PHASE_STARTED", channel: "IN_APP", eventKey: "workflow.phase.started", configuration: {} },
        { code: "WEBSITE_N8N_COMPLETE", name: "حدث إكمال المشروع", event: "PROJECT_COMPLETED", channel: "N8N_EVENT", eventKey: "workflow.project.completed", configuration: {} },
      ],
    },
  },
  {
    code: "SAAS_PRODUCT",
    name: "منتج SaaS أو نظام",
    description: "اكتشاف وتخطيط وبناء واختبار ثم إطلاق منتج رقمي.",
    isDefault: false,
    definition: {
      stages: [
        { code: "DISCOVERY", name: "الاكتشاف", sortOrder: 10, dueOffsetDays: 5 },
        { code: "PLANNING", name: "التخطيط", sortOrder: 20, startOffsetDays: 5, dueOffsetDays: 10 },
        { code: "BUILD", name: "البناء", sortOrder: 30, startOffsetDays: 10, dueOffsetDays: 35 },
        { code: "QA", name: "ضمان الجودة", sortOrder: 40, startOffsetDays: 35, dueOffsetDays: 43 },
        { code: "LAUNCH", name: "الإطلاق", sortOrder: 50, startOffsetDays: 43, dueOffsetDays: 47 },
      ],
      tasks: [
        { code: "PRODUCT_GOALS", stageCode: "DISCOVERY", title: "تثبيت أهداف المنتج والمستخدمين", priority: "HIGH", sortOrder: 10, estimatedHours: 6, dueOffsetDays: 3, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: [] },
        { code: "PRODUCT_SCOPE", stageCode: "DISCOVERY", title: "تحديد نطاق الإصدار الأول", priority: "HIGH", sortOrder: 20, estimatedHours: 6, dueOffsetDays: 5, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["PRODUCT_GOALS"] },
        { code: "PRODUCT_PLAN", stageCode: "PLANNING", title: "خطة التنفيذ والمعمارية", priority: "HIGH", sortOrder: 30, estimatedHours: 12, dueOffsetDays: 10, ownerRole: "MANAGER", dependsOnTaskCodes: ["PRODUCT_SCOPE"] },
        { code: "BUILD_CORE", stageCode: "BUILD", title: "تنفيذ الوظائف الأساسية", priority: "HIGH", sortOrder: 40, estimatedHours: 80, dueOffsetDays: 28, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["PRODUCT_PLAN"] },
        { code: "BUILD_INTEGRATIONS", stageCode: "BUILD", title: "تنفيذ التكاملات", priority: "MEDIUM", sortOrder: 50, estimatedHours: 24, dueOffsetDays: 34, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["BUILD_CORE"] },
        { code: "QA_SECURITY", stageCode: "QA", title: "فحص الأمان والصلاحيات", priority: "HIGH", sortOrder: 60, estimatedHours: 12, dueOffsetDays: 40, ownerRole: "MANAGER", dependsOnTaskCodes: ["BUILD_CORE"] },
        { code: "QA_ACCEPTANCE", stageCode: "QA", title: "اختبار القبول", priority: "HIGH", sortOrder: 70, estimatedHours: 16, dueOffsetDays: 43, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["BUILD_INTEGRATIONS", "QA_SECURITY"] },
        { code: "LAUNCH_RELEASE", stageCode: "LAUNCH", title: "إطلاق الإصدار", priority: "HIGH", sortOrder: 80, estimatedHours: 8, dueOffsetDays: 45, ownerRole: "MANAGER", dependsOnTaskCodes: ["QA_ACCEPTANCE"] },
        { code: "LAUNCH_HANDOVER", stageCode: "LAUNCH", title: "التوثيق والتسليم", priority: "MEDIUM", sortOrder: 90, estimatedHours: 8, dueOffsetDays: 47, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["LAUNCH_RELEASE"] },
      ],
      approvals: [
        { code: "SCOPE_APPROVAL", name: "اعتماد نطاق الإصدار", gate: "PHASE_COMPLETION", stageCode: "DISCOVERY", requiredRole: "PROJECT_LEAD" },
        { code: "RELEASE_APPROVAL", name: "اعتماد الإطلاق", gate: "TASK_COMPLETION", taskCode: "QA_ACCEPTANCE", requiredRole: "PROJECT_LEAD" },
      ],
      rules: [
        { code: "SAAS_APPROVAL_ALERT", name: "تنبيه الموافقات", event: "APPROVAL_REQUESTED", channel: "IN_APP", eventKey: "workflow.approval.requested", configuration: {} },
        { code: "SAAS_N8N_RELEASE", name: "حدث الإطلاق", event: "PROJECT_COMPLETED", channel: "N8N_EVENT", eventKey: "workflow.project.completed", configuration: {} },
      ],
    },
  },
  {
    code: "GROWTH_CAMPAIGN",
    name: "حملة تسويقية",
    description: "استراتيجية ومحتوى وإطلاق وتحسين ثم تقرير نهائي.",
    isDefault: false,
    definition: {
      stages: [
        { code: "STRATEGY", name: "الاستراتيجية", sortOrder: 10, dueOffsetDays: 4 },
        { code: "CONTENT", name: "المحتوى", sortOrder: 20, startOffsetDays: 4, dueOffsetDays: 12 },
        { code: "LAUNCH", name: "الإطلاق", sortOrder: 30, startOffsetDays: 12, dueOffsetDays: 15 },
        { code: "OPTIMIZE", name: "المتابعة والتحسين", sortOrder: 40, startOffsetDays: 15, dueOffsetDays: 28 },
        { code: "REPORT", name: "التقرير", sortOrder: 50, startOffsetDays: 28, dueOffsetDays: 31 },
      ],
      tasks: [
        { code: "CAMPAIGN_GOALS", stageCode: "STRATEGY", title: "تثبيت الأهداف والجمهور", priority: "HIGH", sortOrder: 10, estimatedHours: 4, dueOffsetDays: 2, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: [] },
        { code: "CAMPAIGN_PLAN", stageCode: "STRATEGY", title: "إعداد خطة القنوات والقياس", priority: "HIGH", sortOrder: 20, estimatedHours: 6, dueOffsetDays: 4, ownerRole: "MANAGER", dependsOnTaskCodes: ["CAMPAIGN_GOALS"] },
        { code: "CONTENT_PLAN", stageCode: "CONTENT", title: "إعداد خطة المحتوى", priority: "MEDIUM", sortOrder: 30, estimatedHours: 6, dueOffsetDays: 7, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["CAMPAIGN_PLAN"] },
        { code: "CONTENT_PRODUCTION", stageCode: "CONTENT", title: "إنتاج المحتوى الإعلاني", priority: "HIGH", sortOrder: 40, estimatedHours: 20, dueOffsetDays: 12, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["CONTENT_PLAN"] },
        { code: "CAMPAIGN_LAUNCH", stageCode: "LAUNCH", title: "إطلاق الحملة", priority: "HIGH", sortOrder: 50, estimatedHours: 4, dueOffsetDays: 15, ownerRole: "MANAGER", dependsOnTaskCodes: ["CONTENT_PRODUCTION"] },
        { code: "CAMPAIGN_OPTIMIZE", stageCode: "OPTIMIZE", title: "متابعة النتائج والتحسين", priority: "HIGH", sortOrder: 60, estimatedHours: 16, dueOffsetDays: 28, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["CAMPAIGN_LAUNCH"] },
        { code: "CAMPAIGN_REPORT", stageCode: "REPORT", title: "إعداد التقرير النهائي", priority: "MEDIUM", sortOrder: 70, estimatedHours: 6, dueOffsetDays: 30, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["CAMPAIGN_OPTIMIZE"] },
        { code: "CAMPAIGN_REVIEW", stageCode: "REPORT", title: "مراجعة النتائج والتوصيات", priority: "MEDIUM", sortOrder: 80, estimatedHours: 3, dueOffsetDays: 31, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["CAMPAIGN_REPORT"] },
      ],
      approvals: [
        { code: "CONTENT_APPROVAL", name: "اعتماد المحتوى", gate: "PHASE_COMPLETION", stageCode: "CONTENT", requiredRole: "PROJECT_LEAD" },
        { code: "LAUNCH_APPROVAL", name: "اعتماد إطلاق الحملة", gate: "PHASE_START", stageCode: "LAUNCH", requiredRole: "PROJECT_LEAD" },
      ],
      rules: [
        { code: "GROWTH_LAUNCH_ALERT", name: "تنبيه إطلاق الحملة", event: "PHASE_STARTED", channel: "IN_APP", eventKey: "workflow.phase.started", configuration: {} },
        { code: "GROWTH_N8N_REPORT", name: "حدث التقرير النهائي", event: "PROJECT_COMPLETED", channel: "N8N_EVENT", eventKey: "workflow.project.completed", configuration: {} },
      ],
    },
  },
  {
    code: "CUSTOM_DELIVERY",
    name: "مشروع مخصص",
    description: "سير عام للبدء والتنفيذ والمراجعة والتسليم.",
    isDefault: true,
    definition: {
      stages: [
        { code: "KICKOFF", name: "البدء", sortOrder: 10, dueOffsetDays: 3 },
        { code: "DELIVERY", name: "التنفيذ", sortOrder: 20, startOffsetDays: 3, dueOffsetDays: 18 },
        { code: "REVIEW", name: "المراجعة", sortOrder: 30, startOffsetDays: 18, dueOffsetDays: 23 },
        { code: "HANDOVER", name: "التسليم", sortOrder: 40, startOffsetDays: 23, dueOffsetDays: 26 },
      ],
      tasks: [
        { code: "KICKOFF_SCOPE", stageCode: "KICKOFF", title: "تثبيت النطاق والنتائج المطلوبة", priority: "HIGH", sortOrder: 10, estimatedHours: 4, dueOffsetDays: 2, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: [] },
        { code: "KICKOFF_PLAN", stageCode: "KICKOFF", title: "إعداد خطة التنفيذ", priority: "HIGH", sortOrder: 20, estimatedHours: 4, dueOffsetDays: 3, ownerRole: "MANAGER", dependsOnTaskCodes: ["KICKOFF_SCOPE"] },
        { code: "DELIVERY_WORK", stageCode: "DELIVERY", title: "تنفيذ نطاق المشروع", priority: "HIGH", sortOrder: 30, estimatedHours: 40, dueOffsetDays: 18, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["KICKOFF_PLAN"] },
        { code: "REVIEW_QA", stageCode: "REVIEW", title: "مراجعة الجودة", priority: "HIGH", sortOrder: 40, estimatedHours: 8, dueOffsetDays: 22, ownerRole: "MANAGER", dependsOnTaskCodes: ["DELIVERY_WORK"] },
        { code: "REVIEW_CHANGES", stageCode: "REVIEW", title: "إغلاق ملاحظات المراجعة", priority: "MEDIUM", sortOrder: 50, estimatedHours: 8, dueOffsetDays: 23, ownerRole: "CONTRIBUTOR", dependsOnTaskCodes: ["REVIEW_QA"] },
        { code: "HANDOVER_COMPLETE", stageCode: "HANDOVER", title: "التسليم النهائي والتوثيق", priority: "HIGH", sortOrder: 60, estimatedHours: 6, dueOffsetDays: 26, ownerRole: "PROJECT_LEAD", dependsOnTaskCodes: ["REVIEW_CHANGES"] },
      ],
      approvals: [
        { code: "DELIVERY_APPROVAL", name: "اعتماد التسليم", gate: "PROJECT_COMPLETION", requiredRole: "PROJECT_LEAD" },
      ],
      rules: [
        { code: "CUSTOM_PHASE_ALERT", name: "تنبيه انتقال المرحلة", event: "PHASE_STARTED", channel: "IN_APP", eventKey: "workflow.phase.started", configuration: {} },
        { code: "CUSTOM_N8N_COMPLETE", name: "حدث اكتمال المشروع", event: "PROJECT_COMPLETED", channel: "N8N_EVENT", eventKey: "workflow.project.completed", configuration: {} },
      ],
    },
  },
] satisfies WorkflowTemplateSeed[]

export function parseWorkflowDefinition(value: unknown) {
  return workflowDefinitionSchema.parse(value)
}

export function summarizeWorkflowDefinition(value: unknown) {
  const definition = parseWorkflowDefinition(value)

  return {
    stageCount: definition.stages.length,
    taskCount: definition.tasks.length,
    approvalCount: definition.approvals.length,
    ruleCount: definition.rules.length,
  }
}

export function suggestWorkflowTemplateCode(hint: string | null | undefined) {
  const normalized = hint?.trim().toLocaleLowerCase("ar") ?? ""

  if (/(website|web site|landing|موقع|متجر)/i.test(normalized)) {
    return "WEBSITE_DELIVERY"
  }
  if (/(marketing|campaign|growth|social|تسويق|حملة|محتوى)/i.test(normalized)) {
    return "GROWTH_CAMPAIGN"
  }
  if (/(saas|system|software|platform|automation|ai|نظام|منصة|برمج|أتمت|ذكاء)/i.test(normalized)) {
    return "SAAS_PRODUCT"
  }

  return "CUSTOM_DELIVERY"
}

export function addWorkflowDays(value: Date, days: number | undefined) {
  if (days === undefined) return null

  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
