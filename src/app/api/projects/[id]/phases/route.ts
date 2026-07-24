import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { err, ok, withApiHandler } from "@/lib/api-response"
import { requireAuth } from "@/lib/auth"
import { assertProgress, normalizePhaseCode } from "@/lib/project-execution"
import { requireProjectExecutionManager } from "@/lib/project-execution-server"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"

const optionalDateStringSchema = z.string().refine(
  (value) => value.trim() === "" || !Number.isNaN(Date.parse(value)),
  "صيغة التاريخ غير صحيحة"
)

const phaseSchema = z.object({
  name: z.string().trim().min(2, "اسم المرحلة مطلوب").max(120),
  code: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z
    .enum(["PLANNED", "ACTIVE", "BLOCKED", "COMPLETED", "CANCELLED"])
    .default("PLANNED"),
  progress: z.number().int().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  startDate: optionalDateStringSchema.optional().nullable(),
  dueDate: optionalDateStringSchema.optional().nullable(),
})

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function nullableDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function createProjectPhase(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(request)

  const user = await requireAuth()
  const { id: projectId } = await context.params
  const project = await requireProjectExecutionManager(user, projectId)
  const body = await readJsonBody(request)
  const parsed = phaseSchema.safeParse(body)

  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "بيانات المرحلة غير صحيحة", 400, {
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    })
  }

  const data = parsed.data
  const startDate = nullableDate(data.startDate)
  const dueDate = nullableDate(data.dueDate)

  if (startDate && dueDate && dueDate < startDate) {
    return err("تاريخ نهاية المرحلة يجب أن يكون بعد تاريخ البداية", 400, {
      code: "INVALID_PHASE_DATES",
    })
  }

  const progress = data.status === "COMPLETED" ? 100 : assertProgress(data.progress)
  const code = data.code ? normalizePhaseCode(data.code) : null

  if (data.code && !code) {
    return err("رمز المرحلة يجب أن يحتوي أحرفًا إنجليزية أو أرقامًا", 400, {
      code: "INVALID_PHASE_CODE",
    })
  }

  if (code) {
    const duplicate = await prisma.projectPhase.findFirst({
      where: {
        projectId,
        companyId: user.companyId,
        code,
      },
      select: { id: true },
    })

    if (duplicate) {
      return err("رمز المرحلة مستخدم داخل هذا المشروع", 409, {
        code: "PROJECT_PHASE_CODE_EXISTS",
      })
    }
  }

  const phase = await prisma.$transaction(async (tx) => {
    const created = await tx.projectPhase.create({
      data: {
        companyId: user.companyId,
        projectId,
        name: data.name,
        code,
        description: nullableText(data.description),
        status: data.status,
        progress,
        sortOrder: data.sortOrder,
        startDate,
        dueDate,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
      },
    })

    await tx.activityLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.PROJECT_PHASE_CREATED,
        entityType: "ProjectPhase",
        entityId: created.id,
        message: `تمت إضافة مرحلة ${created.name} إلى مشروع ${project.name}`,
        metadata: {
          projectId,
          status: created.status,
          progress: created.progress,
        },
      },
    })

    return created
  })

  return ok({ phase }, 201)
}

export const POST = withApiHandler(
  "PROJECT_PHASE_POST_ERROR",
  createProjectPhase,
  "حدث خطأ أثناء إضافة المرحلة"
)
