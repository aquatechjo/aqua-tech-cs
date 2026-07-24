import { z } from "zod"
import { ActivityAction } from "@/generated/prisma/enums"
import { ApiError, handleApiError, ok } from "@/lib/api-response"
import { logActivity } from "@/lib/activity"
import { getRequestMeta, requireAuth } from "@/lib/auth"
import { localDateKey } from "@/lib/finance"
import { prisma } from "@/lib/prisma"
import { assertSameOrigin, readJsonBody } from "@/lib/request-security"
import { dateKeyToUtc, normalizeDurationMinutes } from "@/lib/time"
import {
  assertTimeTargetAccess,
  ensureTimesheet,
  makeRejectedTimesheetEditable,
  nullableTimeText,
  serializeTimeEntry,
  timeEntryInclude,
} from "@/lib/time-server"

const patchSchema = z
  .object({
    workDate: z.string().trim().optional(),
    durationMinutes: z.union([z.string(), z.number()]).optional(),
    projectId: z.string().trim().optional().nullable(),
    taskId: z.string().trim().optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    billable: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "لا توجد تعديلات")

async function loadOwnedEntry(companyId: string, userId: string, id: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: {
      id,
      companyId,
      userId,
    },
    include: timeEntryInclude,
  })

  if (!entry) {
    throw new ApiError("سجل الوقت غير موجود", 404, "TIME_ENTRY_NOT_FOUND")
  }

  return entry
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const parsed = patchSchema.safeParse(await readJsonBody(request))

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات سجل الوقت غير صحيحة",
        400,
        "VALIDATION_ERROR",
        { details: parsed.error.flatten() },
      )
    }

    const existing = await loadOwnedEntry(user.companyId, user.id, id)
    if (existing.startedAt && !existing.endedAt) {
      throw new ApiError(
        "أوقف المؤقت قبل تعديل السجل",
        409,
        "RUNNING_TIMER_EDIT_FORBIDDEN",
      )
    }

    const workDate = parsed.data.workDate
      ? dateKeyToUtc(parsed.data.workDate)
      : existing.workDate
    if (
      parsed.data.workDate &&
      parsed.data.workDate > localDateKey(new Date(), user.company.timezone)
    ) {
      throw new ApiError(
        "لا يمكن نقل السجل إلى تاريخ مستقبلي",
        400,
        "FUTURE_TIME_ENTRY",
      )
    }

    const durationMinutes =
      parsed.data.durationMinutes !== undefined
        ? normalizeDurationMinutes(parsed.data.durationMinutes)
        : existing.durationMinutes

    const projectId =
      parsed.data.projectId !== undefined
        ? parsed.data.projectId
        : existing.projectId
    const taskId =
      parsed.data.taskId !== undefined
        ? parsed.data.taskId
        : existing.taskId
    const target = await assertTimeTargetAccess(user, { projectId, taskId })
    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      const oldTimesheet = await tx.timesheet.findUniqueOrThrow({
        where: { id: existing.timesheetId },
      })
      await makeRejectedTimesheetEditable(tx, oldTimesheet)

      const nextTimesheet = await ensureTimesheet(tx, {
        companyId: user.companyId,
        userId: user.id,
        workDate,
      })
      await makeRejectedTimesheetEditable(tx, nextTimesheet)

      await tx.timeEntry.update({
        where: { id: existing.id },
        data: {
          timesheetId: nextTimesheet.id,
          workDate,
          durationMinutes,
          projectId: target.projectId,
          taskId: target.taskId,
          ...(parsed.data.description !== undefined
            ? { description: nullableTimeText(parsed.data.description) }
            : {}),
          ...(parsed.data.billable !== undefined
            ? { billable: parsed.data.billable }
            : {}),
        },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIME_ENTRY_UPDATED,
        entityType: "TimeEntry",
        entityId: existing.id,
        message: "تم تحديث سجل ساعات العمل",
        metadata: {
          previousDurationMinutes: existing.durationMinutes,
          durationMinutes,
          previousWorkDate: existing.workDate.toISOString(),
          workDate: workDate.toISOString(),
          projectId: target.projectId,
          taskId: target.taskId,
        },
        ...meta,
      })
    })

    const entry = await prisma.timeEntry.findUniqueOrThrow({
      where: { id: existing.id },
      include: timeEntryInclude,
    })

    return ok({ entry: serializeTimeEntry(entry) })
  } catch (error) {
    return handleApiError(
      error,
      "TIME_ENTRY_PATCH_ERROR",
      "تعذر تحديث سجل الوقت",
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const { id } = await params
    const existing = await loadOwnedEntry(user.companyId, user.id, id)

    const meta = await getRequestMeta()

    await prisma.$transaction(async (tx) => {
      const timesheet = await tx.timesheet.findUniqueOrThrow({
        where: { id: existing.timesheetId },
      })
      await makeRejectedTimesheetEditable(tx, timesheet)

      await tx.timeEntry.delete({
        where: { id: existing.id },
      })

      await logActivity({
        db: tx,
        companyId: user.companyId,
        userId: user.id,
        action: ActivityAction.TIME_ENTRY_DELETED,
        entityType: "TimeEntry",
        entityId: existing.id,
        message: existing.startedAt && !existing.endedAt
          ? "تم إلغاء مؤقت العمل النشط"
          : "تم حذف سجل ساعات العمل",
        metadata: {
          durationMinutes: existing.durationMinutes,
          wasRunningTimer: Boolean(existing.startedAt && !existing.endedAt),
          workDate: existing.workDate.toISOString(),
          projectId: existing.projectId,
          taskId: existing.taskId,
        },
        ...meta,
      })
    })

    return ok({ deleted: true })
  } catch (error) {
    return handleApiError(
      error,
      "TIME_ENTRY_DELETE_ERROR",
      "تعذر حذف سجل الوقت",
    )
  }
}
