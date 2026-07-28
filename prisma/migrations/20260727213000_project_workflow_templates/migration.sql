CREATE TYPE "WorkflowStatus" AS ENUM (
  'NOT_STARTED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "WorkflowApprovalGate" AS ENUM (
  'PHASE_START',
  'PHASE_COMPLETION',
  'TASK_COMPLETION',
  'PROJECT_COMPLETION'
);

CREATE TYPE "WorkflowApprovalStatus" AS ENUM (
  'NOT_REQUESTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "WorkflowEventType" AS ENUM (
  'PROJECT_CREATED',
  'PROJECT_STARTED',
  'PHASE_STARTED',
  'PHASE_COMPLETED',
  'TASK_STARTED',
  'TASK_COMPLETED',
  'APPROVAL_REQUESTED',
  'APPROVAL_DECIDED',
  'PROJECT_COMPLETED'
);

CREATE TYPE "WorkflowActionChannel" AS ENUM (
  'IN_APP',
  'EMAIL',
  'N8N_EVENT'
);

CREATE TYPE "WorkflowEventDeliveryStatus" AS ENUM (
  'PENDING',
  'PUBLISHED',
  'FAILED'
);

ALTER TABLE "ProjectPhase"
ADD COLUMN "workflowStageCode" TEXT;

ALTER TABLE "Task"
ADD COLUMN "workflowTaskCode" TEXT,
ADD COLUMN "workflowOwnerRole" "ProjectMemberRole";

CREATE TABLE "WorkflowTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectWorkflow" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "templateId" TEXT,
  "templateName" TEXT NOT NULL,
  "templateCode" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "status" "WorkflowStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "definitionSnapshot" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectWorkflowApproval" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "phaseId" TEXT,
  "taskId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gate" "WorkflowApprovalGate" NOT NULL,
  "requiredRole" "ProjectMemberRole",
  "status" "WorkflowApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "requestedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWorkflowApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectWorkflowRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event" "WorkflowEventType" NOT NULL,
  "channel" "WorkflowActionChannel" NOT NULL,
  "eventKey" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWorkflowRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "event" "WorkflowEventType" NOT NULL,
  "eventKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WorkflowEventDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTemplate_companyId_code_key"
ON "WorkflowTemplate"("companyId", "code");
CREATE INDEX "WorkflowTemplate_companyId_idx"
ON "WorkflowTemplate"("companyId");
CREATE INDEX "WorkflowTemplate_isActive_idx"
ON "WorkflowTemplate"("isActive");
CREATE INDEX "WorkflowTemplate_isDefault_idx"
ON "WorkflowTemplate"("isDefault");
CREATE UNIQUE INDEX "WorkflowTemplate_active_default_key"
ON "WorkflowTemplate"("companyId")
WHERE "isDefault" = true AND "isActive" = true;

CREATE UNIQUE INDEX "ProjectWorkflow_projectId_key"
ON "ProjectWorkflow"("projectId");
CREATE INDEX "ProjectWorkflow_companyId_idx"
ON "ProjectWorkflow"("companyId");
CREATE INDEX "ProjectWorkflow_templateId_idx"
ON "ProjectWorkflow"("templateId");
CREATE INDEX "ProjectWorkflow_status_idx"
ON "ProjectWorkflow"("status");

CREATE UNIQUE INDEX "ProjectWorkflowApproval_workflowId_code_key"
ON "ProjectWorkflowApproval"("workflowId", "code");
CREATE INDEX "ProjectWorkflowApproval_companyId_idx"
ON "ProjectWorkflowApproval"("companyId");
CREATE INDEX "ProjectWorkflowApproval_phaseId_idx"
ON "ProjectWorkflowApproval"("phaseId");
CREATE INDEX "ProjectWorkflowApproval_taskId_idx"
ON "ProjectWorkflowApproval"("taskId");
CREATE INDEX "ProjectWorkflowApproval_status_idx"
ON "ProjectWorkflowApproval"("status");

CREATE UNIQUE INDEX "ProjectWorkflowRule_workflowId_code_key"
ON "ProjectWorkflowRule"("workflowId", "code");
CREATE INDEX "ProjectWorkflowRule_companyId_idx"
ON "ProjectWorkflowRule"("companyId");
CREATE INDEX "ProjectWorkflowRule_event_idx"
ON "ProjectWorkflowRule"("event");
CREATE INDEX "ProjectWorkflowRule_channel_idx"
ON "ProjectWorkflowRule"("channel");
CREATE INDEX "ProjectWorkflowRule_isActive_idx"
ON "ProjectWorkflowRule"("isActive");

CREATE INDEX "WorkflowEvent_companyId_idx"
ON "WorkflowEvent"("companyId");
CREATE INDEX "WorkflowEvent_workflowId_idx"
ON "WorkflowEvent"("workflowId");
CREATE INDEX "WorkflowEvent_event_idx"
ON "WorkflowEvent"("event");
CREATE INDEX "WorkflowEvent_status_occurredAt_idx"
ON "WorkflowEvent"("status", "occurredAt");

CREATE INDEX "ProjectPhase_workflowStageCode_idx"
ON "ProjectPhase"("workflowStageCode");
CREATE INDEX "Task_workflowTaskCode_idx"
ON "Task"("workflowTaskCode");

ALTER TABLE "WorkflowTemplate"
ADD CONSTRAINT "WorkflowTemplate_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkflow"
ADD CONSTRAINT "ProjectWorkflow_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflow"
ADD CONSTRAINT "ProjectWorkflow_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflow"
ADD CONSTRAINT "ProjectWorkflow_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkflowApproval"
ADD CONSTRAINT "ProjectWorkflowApproval_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflowApproval"
ADD CONSTRAINT "ProjectWorkflowApproval_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "ProjectWorkflow"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflowApproval"
ADD CONSTRAINT "ProjectWorkflowApproval_phaseId_fkey"
FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflowApproval"
ADD CONSTRAINT "ProjectWorkflowApproval_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectWorkflowRule"
ADD CONSTRAINT "ProjectWorkflowRule_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkflowRule"
ADD CONSTRAINT "ProjectWorkflowRule_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "ProjectWorkflow"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
ADD CONSTRAINT "WorkflowEvent_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowEvent"
ADD CONSTRAINT "WorkflowEvent_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "ProjectWorkflow"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

WITH template_seed (
  "code",
  "name",
  "description",
  "isDefault",
  "definition"
) AS (
  VALUES
    (
      'WEBSITE_DELIVERY',
      'تطوير وتسليم موقع',
      'من الاكتشاف والتصميم حتى الاختبار والإطلاق.',
      false,
      $json${
        "stages": [
          {"code":"DISCOVERY","name":"الاكتشاف","sortOrder":10,"dueOffsetDays":3},
          {"code":"DESIGN","name":"التصميم","sortOrder":20,"startOffsetDays":3,"dueOffsetDays":10},
          {"code":"DEVELOPMENT","name":"التطوير","sortOrder":30,"startOffsetDays":10,"dueOffsetDays":24},
          {"code":"QA","name":"الاختبار","sortOrder":40,"startOffsetDays":24,"dueOffsetDays":29},
          {"code":"LAUNCH","name":"الإطلاق والتسليم","sortOrder":50,"startOffsetDays":29,"dueOffsetDays":32}
        ],
        "tasks": [
          {"code":"DISCOVERY_BRIEF","stageCode":"DISCOVERY","title":"تثبيت نطاق المشروع والمتطلبات","priority":"HIGH","sortOrder":10,"estimatedHours":4,"dueOffsetDays":2,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":[]},
          {"code":"DISCOVERY_CONTENT","stageCode":"DISCOVERY","title":"جمع المحتوى والأصول","priority":"MEDIUM","sortOrder":20,"estimatedHours":4,"dueOffsetDays":3,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["DISCOVERY_BRIEF"]},
          {"code":"DESIGN_WIREFRAMES","stageCode":"DESIGN","title":"إعداد هيكل الصفحات","priority":"HIGH","sortOrder":30,"estimatedHours":12,"dueOffsetDays":7,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["DISCOVERY_BRIEF"]},
          {"code":"DESIGN_UI","stageCode":"DESIGN","title":"اعتماد التصميم المرئي","priority":"HIGH","sortOrder":40,"estimatedHours":18,"dueOffsetDays":10,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["DESIGN_WIREFRAMES"]},
          {"code":"DEV_BUILD","stageCode":"DEVELOPMENT","title":"تنفيذ الموقع","priority":"HIGH","sortOrder":50,"estimatedHours":48,"dueOffsetDays":22,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["DESIGN_UI"]},
          {"code":"DEV_CONTENT","stageCode":"DEVELOPMENT","title":"إدخال المحتوى النهائي","priority":"MEDIUM","sortOrder":60,"estimatedHours":8,"dueOffsetDays":24,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["DEV_BUILD"]},
          {"code":"QA_ACCEPTANCE","stageCode":"QA","title":"اختبار الجودة والقبول","priority":"HIGH","sortOrder":70,"estimatedHours":12,"dueOffsetDays":29,"ownerRole":"MANAGER","dependsOnTaskCodes":["DEV_BUILD","DEV_CONTENT"]},
          {"code":"LAUNCH_HANDOVER","stageCode":"LAUNCH","title":"الإطلاق والتسليم والتوثيق","priority":"HIGH","sortOrder":80,"estimatedHours":8,"dueOffsetDays":32,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["QA_ACCEPTANCE"]}
        ],
        "approvals": [
          {"code":"DESIGN_APPROVAL","name":"اعتماد التصميم","gate":"PHASE_COMPLETION","stageCode":"DESIGN","requiredRole":"PROJECT_LEAD"},
          {"code":"LAUNCH_APPROVAL","name":"اعتماد الإطلاق","gate":"PROJECT_COMPLETION","requiredRole":"PROJECT_LEAD"}
        ],
        "rules": [
          {"code":"WEBSITE_PHASE_ALERT","name":"تنبيه بدء المرحلة","event":"PHASE_STARTED","channel":"IN_APP","eventKey":"workflow.phase.started","configuration":{}},
          {"code":"WEBSITE_N8N_COMPLETE","name":"حدث إكمال المشروع","event":"PROJECT_COMPLETED","channel":"N8N_EVENT","eventKey":"workflow.project.completed","configuration":{}}
        ]
      }$json$::jsonb
    ),
    (
      'SAAS_PRODUCT',
      'منتج SaaS أو نظام',
      'اكتشاف وتخطيط وبناء واختبار ثم إطلاق منتج رقمي.',
      false,
      $json${
        "stages": [
          {"code":"DISCOVERY","name":"الاكتشاف","sortOrder":10,"dueOffsetDays":5},
          {"code":"PLANNING","name":"التخطيط","sortOrder":20,"startOffsetDays":5,"dueOffsetDays":10},
          {"code":"BUILD","name":"البناء","sortOrder":30,"startOffsetDays":10,"dueOffsetDays":35},
          {"code":"QA","name":"ضمان الجودة","sortOrder":40,"startOffsetDays":35,"dueOffsetDays":43},
          {"code":"LAUNCH","name":"الإطلاق","sortOrder":50,"startOffsetDays":43,"dueOffsetDays":47}
        ],
        "tasks": [
          {"code":"PRODUCT_GOALS","stageCode":"DISCOVERY","title":"تثبيت أهداف المنتج والمستخدمين","priority":"HIGH","sortOrder":10,"estimatedHours":6,"dueOffsetDays":3,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":[]},
          {"code":"PRODUCT_SCOPE","stageCode":"DISCOVERY","title":"تحديد نطاق الإصدار الأول","priority":"HIGH","sortOrder":20,"estimatedHours":6,"dueOffsetDays":5,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["PRODUCT_GOALS"]},
          {"code":"PRODUCT_PLAN","stageCode":"PLANNING","title":"خطة التنفيذ والمعمارية","priority":"HIGH","sortOrder":30,"estimatedHours":12,"dueOffsetDays":10,"ownerRole":"MANAGER","dependsOnTaskCodes":["PRODUCT_SCOPE"]},
          {"code":"BUILD_CORE","stageCode":"BUILD","title":"تنفيذ الوظائف الأساسية","priority":"HIGH","sortOrder":40,"estimatedHours":80,"dueOffsetDays":28,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["PRODUCT_PLAN"]},
          {"code":"BUILD_INTEGRATIONS","stageCode":"BUILD","title":"تنفيذ التكاملات","priority":"MEDIUM","sortOrder":50,"estimatedHours":24,"dueOffsetDays":34,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["BUILD_CORE"]},
          {"code":"QA_SECURITY","stageCode":"QA","title":"فحص الأمان والصلاحيات","priority":"HIGH","sortOrder":60,"estimatedHours":12,"dueOffsetDays":40,"ownerRole":"MANAGER","dependsOnTaskCodes":["BUILD_CORE"]},
          {"code":"QA_ACCEPTANCE","stageCode":"QA","title":"اختبار القبول","priority":"HIGH","sortOrder":70,"estimatedHours":16,"dueOffsetDays":43,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["BUILD_INTEGRATIONS","QA_SECURITY"]},
          {"code":"LAUNCH_RELEASE","stageCode":"LAUNCH","title":"إطلاق الإصدار","priority":"HIGH","sortOrder":80,"estimatedHours":8,"dueOffsetDays":45,"ownerRole":"MANAGER","dependsOnTaskCodes":["QA_ACCEPTANCE"]},
          {"code":"LAUNCH_HANDOVER","stageCode":"LAUNCH","title":"التوثيق والتسليم","priority":"MEDIUM","sortOrder":90,"estimatedHours":8,"dueOffsetDays":47,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["LAUNCH_RELEASE"]}
        ],
        "approvals": [
          {"code":"SCOPE_APPROVAL","name":"اعتماد نطاق الإصدار","gate":"PHASE_COMPLETION","stageCode":"DISCOVERY","requiredRole":"PROJECT_LEAD"},
          {"code":"RELEASE_APPROVAL","name":"اعتماد الإطلاق","gate":"TASK_COMPLETION","taskCode":"QA_ACCEPTANCE","requiredRole":"PROJECT_LEAD"}
        ],
        "rules": [
          {"code":"SAAS_APPROVAL_ALERT","name":"تنبيه الموافقات","event":"APPROVAL_REQUESTED","channel":"IN_APP","eventKey":"workflow.approval.requested","configuration":{}},
          {"code":"SAAS_N8N_RELEASE","name":"حدث الإطلاق","event":"PROJECT_COMPLETED","channel":"N8N_EVENT","eventKey":"workflow.project.completed","configuration":{}}
        ]
      }$json$::jsonb
    ),
    (
      'GROWTH_CAMPAIGN',
      'حملة تسويقية',
      'استراتيجية ومحتوى وإطلاق وتحسين ثم تقرير نهائي.',
      false,
      $json${
        "stages": [
          {"code":"STRATEGY","name":"الاستراتيجية","sortOrder":10,"dueOffsetDays":4},
          {"code":"CONTENT","name":"المحتوى","sortOrder":20,"startOffsetDays":4,"dueOffsetDays":12},
          {"code":"LAUNCH","name":"الإطلاق","sortOrder":30,"startOffsetDays":12,"dueOffsetDays":15},
          {"code":"OPTIMIZE","name":"المتابعة والتحسين","sortOrder":40,"startOffsetDays":15,"dueOffsetDays":28},
          {"code":"REPORT","name":"التقرير","sortOrder":50,"startOffsetDays":28,"dueOffsetDays":31}
        ],
        "tasks": [
          {"code":"CAMPAIGN_GOALS","stageCode":"STRATEGY","title":"تثبيت الأهداف والجمهور","priority":"HIGH","sortOrder":10,"estimatedHours":4,"dueOffsetDays":2,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":[]},
          {"code":"CAMPAIGN_PLAN","stageCode":"STRATEGY","title":"إعداد خطة القنوات والقياس","priority":"HIGH","sortOrder":20,"estimatedHours":6,"dueOffsetDays":4,"ownerRole":"MANAGER","dependsOnTaskCodes":["CAMPAIGN_GOALS"]},
          {"code":"CONTENT_PLAN","stageCode":"CONTENT","title":"إعداد خطة المحتوى","priority":"MEDIUM","sortOrder":30,"estimatedHours":6,"dueOffsetDays":7,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["CAMPAIGN_PLAN"]},
          {"code":"CONTENT_PRODUCTION","stageCode":"CONTENT","title":"إنتاج المحتوى الإعلاني","priority":"HIGH","sortOrder":40,"estimatedHours":20,"dueOffsetDays":12,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["CONTENT_PLAN"]},
          {"code":"CAMPAIGN_LAUNCH","stageCode":"LAUNCH","title":"إطلاق الحملة","priority":"HIGH","sortOrder":50,"estimatedHours":4,"dueOffsetDays":15,"ownerRole":"MANAGER","dependsOnTaskCodes":["CONTENT_PRODUCTION"]},
          {"code":"CAMPAIGN_OPTIMIZE","stageCode":"OPTIMIZE","title":"متابعة النتائج والتحسين","priority":"HIGH","sortOrder":60,"estimatedHours":16,"dueOffsetDays":28,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["CAMPAIGN_LAUNCH"]},
          {"code":"CAMPAIGN_REPORT","stageCode":"REPORT","title":"إعداد التقرير النهائي","priority":"MEDIUM","sortOrder":70,"estimatedHours":6,"dueOffsetDays":30,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["CAMPAIGN_OPTIMIZE"]},
          {"code":"CAMPAIGN_REVIEW","stageCode":"REPORT","title":"مراجعة النتائج والتوصيات","priority":"MEDIUM","sortOrder":80,"estimatedHours":3,"dueOffsetDays":31,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["CAMPAIGN_REPORT"]}
        ],
        "approvals": [
          {"code":"CONTENT_APPROVAL","name":"اعتماد المحتوى","gate":"PHASE_COMPLETION","stageCode":"CONTENT","requiredRole":"PROJECT_LEAD"},
          {"code":"LAUNCH_APPROVAL","name":"اعتماد إطلاق الحملة","gate":"PHASE_START","stageCode":"LAUNCH","requiredRole":"PROJECT_LEAD"}
        ],
        "rules": [
          {"code":"GROWTH_LAUNCH_ALERT","name":"تنبيه إطلاق الحملة","event":"PHASE_STARTED","channel":"IN_APP","eventKey":"workflow.phase.started","configuration":{}},
          {"code":"GROWTH_N8N_REPORT","name":"حدث التقرير النهائي","event":"PROJECT_COMPLETED","channel":"N8N_EVENT","eventKey":"workflow.project.completed","configuration":{}}
        ]
      }$json$::jsonb
    ),
    (
      'CUSTOM_DELIVERY',
      'مشروع مخصص',
      'سير عام للبدء والتنفيذ والمراجعة والتسليم.',
      true,
      $json${
        "stages": [
          {"code":"KICKOFF","name":"البدء","sortOrder":10,"dueOffsetDays":3},
          {"code":"DELIVERY","name":"التنفيذ","sortOrder":20,"startOffsetDays":3,"dueOffsetDays":18},
          {"code":"REVIEW","name":"المراجعة","sortOrder":30,"startOffsetDays":18,"dueOffsetDays":23},
          {"code":"HANDOVER","name":"التسليم","sortOrder":40,"startOffsetDays":23,"dueOffsetDays":26}
        ],
        "tasks": [
          {"code":"KICKOFF_SCOPE","stageCode":"KICKOFF","title":"تثبيت النطاق والنتائج المطلوبة","priority":"HIGH","sortOrder":10,"estimatedHours":4,"dueOffsetDays":2,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":[]},
          {"code":"KICKOFF_PLAN","stageCode":"KICKOFF","title":"إعداد خطة التنفيذ","priority":"HIGH","sortOrder":20,"estimatedHours":4,"dueOffsetDays":3,"ownerRole":"MANAGER","dependsOnTaskCodes":["KICKOFF_SCOPE"]},
          {"code":"DELIVERY_WORK","stageCode":"DELIVERY","title":"تنفيذ نطاق المشروع","priority":"HIGH","sortOrder":30,"estimatedHours":40,"dueOffsetDays":18,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["KICKOFF_PLAN"]},
          {"code":"REVIEW_QA","stageCode":"REVIEW","title":"مراجعة الجودة","priority":"HIGH","sortOrder":40,"estimatedHours":8,"dueOffsetDays":22,"ownerRole":"MANAGER","dependsOnTaskCodes":["DELIVERY_WORK"]},
          {"code":"REVIEW_CHANGES","stageCode":"REVIEW","title":"إغلاق ملاحظات المراجعة","priority":"MEDIUM","sortOrder":50,"estimatedHours":8,"dueOffsetDays":23,"ownerRole":"CONTRIBUTOR","dependsOnTaskCodes":["REVIEW_QA"]},
          {"code":"HANDOVER_COMPLETE","stageCode":"HANDOVER","title":"التسليم النهائي والتوثيق","priority":"HIGH","sortOrder":60,"estimatedHours":6,"dueOffsetDays":26,"ownerRole":"PROJECT_LEAD","dependsOnTaskCodes":["REVIEW_CHANGES"]}
        ],
        "approvals": [
          {"code":"DELIVERY_APPROVAL","name":"اعتماد التسليم","gate":"PROJECT_COMPLETION","requiredRole":"PROJECT_LEAD"}
        ],
        "rules": [
          {"code":"CUSTOM_PHASE_ALERT","name":"تنبيه انتقال المرحلة","event":"PHASE_STARTED","channel":"IN_APP","eventKey":"workflow.phase.started","configuration":{}},
          {"code":"CUSTOM_N8N_COMPLETE","name":"حدث اكتمال المشروع","event":"PROJECT_COMPLETED","channel":"N8N_EVENT","eventKey":"workflow.project.completed","configuration":{}}
        ]
      }$json$::jsonb
    )
)
INSERT INTO "WorkflowTemplate" (
  "id",
  "companyId",
  "name",
  "code",
  "description",
  "isDefault",
  "definition"
)
SELECT
  'wft_' || md5(company."id" || ':' || seed."code"),
  company."id",
  seed."name",
  seed."code",
  seed."description",
  seed."isDefault",
  seed."definition"
FROM "Company" AS company
CROSS JOIN template_seed AS seed;

INSERT INTO "ProjectWorkflow" (
  "id",
  "companyId",
  "projectId",
  "templateId",
  "templateName",
  "templateCode",
  "templateVersion",
  "status",
  "definitionSnapshot",
  "startedAt",
  "completedAt"
)
SELECT
  'pwf_' || md5(project."id"),
  project."companyId",
  project."id",
  template."id",
  template."name",
  template."code",
  template."version",
  CASE
    WHEN project."status" = 'IN_PROGRESS' THEN 'ACTIVE'::"WorkflowStatus"
    WHEN project."status" = 'ON_HOLD' THEN 'PAUSED'::"WorkflowStatus"
    WHEN project."status" = 'COMPLETED' THEN 'COMPLETED'::"WorkflowStatus"
    WHEN project."status" IN ('CANCELLED', 'ARCHIVED') THEN 'CANCELLED'::"WorkflowStatus"
    ELSE 'NOT_STARTED'::"WorkflowStatus"
  END,
  template."definition" || '{"migratedExistingProject":true}'::jsonb,
  CASE
    WHEN project."status" IN ('IN_PROGRESS', 'ON_HOLD', 'COMPLETED')
      THEN COALESCE(project."startDate", project."createdAt")
    ELSE NULL
  END,
  CASE
    WHEN project."status" = 'COMPLETED'
      THEN COALESCE(project."completedAt", project."updatedAt")
    ELSE NULL
  END
FROM "Project" AS project
JOIN "WorkflowTemplate" AS template
  ON template."companyId" = project."companyId"
 AND template."code" = 'CUSTOM_DELIVERY';
