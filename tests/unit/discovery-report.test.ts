import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  discoveryReportContentSchema,
  discoveryReportLines,
  isDiscoveryReportEvidenceStale,
  parseDiscoveryReportLines,
} from "../../src/lib/discovery-report"

const validReport = {
  executiveSummary:
    "يحتاج العميل إلى تنظيم عملية تشغيلية واضحة قبل تحديد النطاق والسعر النهائي.",
  problemStatement:
    "تعتمد العملية الحالية على خطوات يدوية متفرقة وتفتقر إلى مصدر حقيقة واحد.",
  currentState:
    "تُدار البيانات والمتابعات حاليًا بين ملفات ورسائل منفصلة.",
  desiredOutcomes: ["توحيد البيانات", "تقليل المتابعة اليدوية"],
  recommendedApproach:
    "البدء بتثبيت النطاق التشغيلي ثم تصميم حل مرحلي قابل للمراجعة.",
  scopeItems: ["تحليل التدفق الحالي", "تحديد الأدوار والصلاحيات"],
  successMeasures: ["انخفاض زمن المتابعة", "وضوح حالة كل معاملة"],
  constraints: ["يلزم اعتماد صاحب القرار"],
  risks: [
    {
      title: "عدم اكتمال البيانات",
      impact: "قد يتغير النطاق بعد بدء التنفيذ",
      mitigation: "اعتماد قائمة البيانات المطلوبة قبل التسعير",
    },
  ],
  assumptions: ["سيتوفر ممثل واحد معتمد من العميل"],
  openQuestions: ["ما حجم البيانات التاريخية المطلوب نقلها؟"],
  recommendedNextStep:
    "مراجعة التقرير بشريًا ثم تثبيت النطاق وإعداد التسعير.",
}

test("DISC-03 validates the structured report and line helpers", () => {
  assert.equal(discoveryReportContentSchema.safeParse(validReport).success, true)
  assert.deepEqual(
    parseDiscoveryReportLines("- الأول\n2. الثاني\n\n• الثالث"),
    ["الأول", "الثاني", "الثالث"],
  )
  assert.equal(
    discoveryReportLines(["الأول", "الثاني"]),
    "الأول\nالثاني",
  )
})

test("DISC-03 detects report versions built from stale evidence", () => {
  assert.equal(
    isDiscoveryReportEvidenceStale({
      versionEvidenceHash: "same",
      currentEvidenceHash: "same",
    }),
    false,
  )
  assert.equal(
    isDiscoveryReportEvidenceStale({
      versionEvidenceHash: "old",
      currentEvidenceHash: "new",
    }),
    true,
  )
  assert.equal(
    isDiscoveryReportEvidenceStale({
      versionEvidenceHash: null,
      currentEvidenceHash: "new",
    }),
    false,
  )
})

test("DISC-03 stores immutable versions and approval state in tenant scope", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8")
  const migration = readFileSync(
    "prisma/migrations/20260730023000_disc_03_versioned_discovery_reports/migration.sql",
    "utf8",
  )
  const access = readFileSync("src/lib/access-control.ts", "utf8")

  assert.match(schema, /model DiscoveryReport \{/)
  assert.match(schema, /model DiscoveryReportVersion \{/)
  assert.match(
    schema,
    /@@unique\(\[reportId, version\]\)/,
  )
  assert.match(schema, /evidenceInputHash\s+String/)
  assert.match(schema, /origin\s+DiscoveryReportVersionOrigin/)
  assert.match(migration, /DiscoveryReport_intakeSessionId_key/)
  assert.match(
    migration,
    /DiscoveryReportVersion_reportId_version_key/,
  )
  assert.match(
    migration,
    /DiscoveryReportVersion_version_check/,
  )
  assert.match(access, /discoveryReportManagement/)
  assert.match(access, /discoveryReportApproval/)
})

test("DISC-03 minimizes AI data and keeps a mandatory human review gate", () => {
  const reportServer = readFileSync(
    "src/lib/discovery-report-server.ts",
    "utf8",
  )
  const generateRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/report/generate/route.ts",
    "utf8",
  )
  const reportRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/report/route.ts",
    "utf8",
  )
  const reviewRoute = readFileSync(
    "src/app/api/discovery/sessions/[id]/report/review/route.ts",
    "utf8",
  )
  const reportClient = readFileSync(
    "src/app/dashboard/discovery/[id]/report/DiscoveryReportClient.tsx",
    "utf8",
  )

  assert.match(reportServer, /TRUSTED_REPORT_SOURCES/)
  assert.match(reportServer, /store: false/)
  assert.match(reportServer, /max_output_tokens: 6000/)
  assert.match(reportServer, /safety_identifier/)
  assert.match(reportServer, /type: "json_schema"/)
  assert.match(reportServer, /OPENAI_API_KEY/)
  assert.match(reportServer, /OPENAI_DISCOVERY_MODEL/)
  assert.match(reportServer, /120 \* 1024/)
  assert.doesNotMatch(
    reportServer,
    /conversationMessages:\s*\{/,
  )
  assert.doesNotMatch(reportServer, /internalSummary:\s*true/)
  assert.match(generateRoute, /confirmExternalAiProcessing/)
  assert.match(generateRoute, /enforceRateLimit/)
  assert.match(generateRoute, /FOR UPDATE/)
  assert.match(generateRoute, /DISCOVERY_REPORT_INPUT_CHANGED/)
  assert.match(reportRoute, /origin: "HUMAN_REVISION"/)
  assert.match(reportRoute, /DISCOVERY_REPORT_NO_CHANGES/)
  assert.match(
    reviewRoute,
    /DISCOVERY_REPORT_HUMAN_REVISION_REQUIRED/,
  )
  assert.match(reviewRoute, /DISCOVERY_REPORT_STALE/)
  assert.match(reviewRoute, /status: "COMPLETED"/)
  assert.match(reviewRoute, /nextAction: "مراجعة النطاق وإعداد التسعير"/)
  assert.doesNotMatch(reviewRoute, /salesProposal\.(create|upsert)/)
  assert.match(reportClient, /AquaConfirmDialog/)
  assert.match(reportClient, /حفظ إصدار بشري/)
  assert.doesNotMatch(reportClient, /window\.(confirm|prompt)/)
})
