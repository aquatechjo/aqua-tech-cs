import { ActivityAction } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";
import AquaPagination from "@/components/aqua/AquaPagination";
import AquaPageHeader from "@/components/layout/AquaPageHeader";
import { ACCESS_ROLES, hasRole } from "@/lib/access-control";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

function actionLabel(action: ActivityAction) {
  const labels: Record<ActivityAction, string> = {
    LOGIN: "تسجيل دخول",
    LOGOUT: "تسجيل خروج",

    USER_CREATED: "إضافة موظف",
    USER_UPDATED: "تعديل موظف",
    USER_DEACTIVATED: "تعطيل موظف",
    USER_ACTIVATED: "تفعيل موظف",
    EMPLOYEE_PROFILE_UPDATED: "تعديل الملف الوظيفي",
    DEPARTMENT_CREATED: "إضافة قسم",
    DEPARTMENT_UPDATED: "تعديل قسم",
    JOB_ROLE_CREATED: "إضافة مسمى وظيفي",
    JOB_ROLE_UPDATED: "تعديل مسمى وظيفي",
    TEAM_CREATED: "إضافة فريق",
    TEAM_UPDATED: "تعديل فريق",
    TEAM_MEMBERSHIP_UPDATED: "تعديل توزيع فريق",
    TEAM_MEMBERSHIP_REMOVED: "إزالة عضو من فريق",
    PROJECT_MEMBER_ADDED: "إضافة عضو إلى مشروع",
    PROJECT_MEMBER_UPDATED: "تعديل عضو مشروع",
    PROJECT_MEMBER_REMOVED: "إزالة عضو من مشروع",
    PROJECT_PHASE_CREATED: "إضافة مرحلة مشروع",
    PROJECT_PHASE_UPDATED: "تعديل مرحلة مشروع",
    PROJECT_PHASE_REMOVED: "حذف مرحلة مشروع",
    TASK_PARTICIPANT_ADDED: "إضافة مشارك إلى مهمة",
    TASK_PARTICIPANT_UPDATED: "تعديل مشارك مهمة",
    TASK_PARTICIPANT_REMOVED: "إزالة مشارك من مهمة",
    TASK_DEPENDENCY_ADDED: "إضافة تبعية مهمة",
    TASK_DEPENDENCY_REMOVED: "إزالة تبعية مهمة",
    TASK_BLOCKER_CREATED: "تسجيل عائق مهمة",
    TASK_BLOCKER_UPDATED: "تعديل عائق مهمة",
    TASK_BLOCKER_RESOLVED: "معالجة عائق مهمة",

    INVOICE_CREATED: "إنشاء فاتورة",
    INVOICE_UPDATED: "تعديل فاتورة",
    INVOICE_ISSUED: "إصدار فاتورة",
    INVOICE_CANCELLED: "إلغاء فاتورة",
    PAYMENT_RECORDED: "تسجيل دفعة",
    PAYMENT_REVERSED: "عكس دفعة",
    EXPENSE_CREATED: "إنشاء مصروف",
    EXPENSE_UPDATED: "تعديل مصروف",
    EXPENSE_SUBMITTED: "إرسال مصروف للاعتماد",
    EXPENSE_APPROVED: "اعتماد مصروف",
    EXPENSE_REJECTED: "رفض مصروف",
    EXPENSE_PAID: "دفع مصروف",
    EXPENSE_CANCELLED: "إلغاء مصروف",

    SALES_OPPORTUNITY_CREATED: "إنشاء فرصة بيع",
    SALES_OPPORTUNITY_UPDATED: "تعديل فرصة بيع",
    SALES_OPPORTUNITY_STAGE_CHANGED: "نقل مرحلة فرصة",
    SALES_OPPORTUNITY_WON: "فوز فرصة بيع",
    SALES_OPPORTUNITY_LOST: "خسارة فرصة بيع",
    SALES_OPPORTUNITY_CONVERTED: "تحويل فرصة إلى مشروع",
    SALES_ACTIVITY_CREATED: "إضافة متابعة مبيعات",
    SALES_ACTIVITY_UPDATED: "تعديل متابعة مبيعات",
    SALES_ACTIVITY_COMPLETED: "إكمال متابعة مبيعات",
    SALES_PROPOSAL_CREATED: "إنشاء عرض تجاري",
    SALES_PROPOSAL_UPDATED: "تعديل عرض تجاري",
    SALES_PROPOSAL_SENT: "إرسال عرض تجاري",
    SALES_PROPOSAL_ACCEPTED: "قبول عرض تجاري",
    SALES_PROPOSAL_REJECTED: "رفض عرض تجاري",

    TIME_ENTRY_CREATED: "إضافة سجل وقت",
    TIME_ENTRY_UPDATED: "تعديل سجل وقت",
    TIME_ENTRY_DELETED: "حذف سجل وقت",
    TIME_TIMER_STARTED: "تشغيل مؤقت الوقت",
    TIME_TIMER_STOPPED: "إيقاف مؤقت الوقت",
    TIMESHEET_SUBMITTED: "إرسال سجل الساعات للاعتماد",
    TIMESHEET_APPROVED: "اعتماد سجل الساعات",
    TIMESHEET_REJECTED: "رفض سجل الساعات",

    WORK_SCHEDULE_CREATED: "إنشاء جدول دوام",
    WORK_SCHEDULE_UPDATED: "تعديل جدول دوام",
    ATTENDANCE_CHECKED_IN: "تسجيل حضور",
    ATTENDANCE_CHECKED_OUT: "تسجيل انصراف",
    ATTENDANCE_UPDATED: "تعديل سجل حضور",
    LEAVE_TYPE_CREATED: "إنشاء نوع إجازة",
    LEAVE_TYPE_UPDATED: "تعديل نوع إجازة",
    LEAVE_BALANCE_ADJUSTED: "تعديل رصيد إجازة",
    LEAVE_REQUEST_SUBMITTED: "تقديم طلب إجازة",
    LEAVE_REQUEST_APPROVED: "اعتماد طلب إجازة",
    LEAVE_REQUEST_REJECTED: "رفض طلب إجازة",
    LEAVE_REQUEST_CANCELLED: "إلغاء طلب إجازة",
    HOLIDAY_CREATED: "إضافة عطلة",
    HOLIDAY_UPDATED: "تعديل عطلة",
    HOLIDAY_DELETED: "حذف عطلة",

    TASK_CREATED: "إضافة مهمة",
    TASK_UPDATED: "تعديل مهمة",
    TASK_COMPLETED: "إكمال مهمة",
    TASK_ARCHIVED: "أرشفة مهمة",
    TASK_RESTORED: "استرجاع مهمة",

    CLIENT_CREATED: "إضافة عميل",
    CLIENT_UPDATED: "تعديل عميل",
    CLIENT_ARCHIVED: "أرشفة عميل",
    CLIENT_RESTORED: "استرجاع عميل",
    CONTACT_CREATED: "إضافة جهة اتصال",
    CONTACT_UPDATED: "تعديل جهة اتصال",
    CONTACT_ARCHIVED: "أرشفة جهة اتصال",
    CONTACT_RESTORED: "استرجاع جهة اتصال",
    CONTACT_PRIMARY_CHANGED: "تغيير جهة الاتصال الرئيسية",

    PROJECT_CREATED: "إضافة مشروع",
    PROJECT_UPDATED: "تعديل مشروع",
    PROJECT_ARCHIVED: "أرشفة مشروع",
    PROJECT_RESTORED: "استرجاع مشروع",
    PROJECT_COMPLETED: "إكمال مشروع",

    SERVICE_REQUEST_CREATED: "إضافة طلب خدمة",
    SERVICE_REQUEST_UPDATED: "تعديل طلب خدمة",
    SERVICE_REQUEST_CONTACTED: "تم التواصل مع طلب خدمة",
    SERVICE_REQUEST_PROPOSAL_SENT: "إرسال عرض سعر",
    SERVICE_REQUEST_APPROVED: "قبول طلب خدمة",
    SERVICE_REQUEST_REJECTED: "رفض طلب خدمة",
    SERVICE_REQUEST_CONVERTED: "تحويل طلب خدمة",
    SERVICE_REQUEST_ARCHIVED: "أرشفة طلب خدمة",
    SERVICE_REQUEST_RESTORED: "استرجاع طلب خدمة",

    LEAD_CREATED: "تسجيل عميل محتمل",
    LEAD_UPDATED: "تعديل عميل محتمل",
    LEAD_STATUS_CHANGED: "تغيير حالة عميل محتمل",
    LEAD_DUPLICATE_FLAGGED: "تمييز عميل محتمل مكرر",

    COMPANY_UPDATED: "تعديل بيانات الشركة",

    NOTIFICATION_READ: "قراءة تنبيه",
    NOTIFICATIONS_READ_ALL: "قراءة كل التنبيهات",

    FILE_UPLOADED: "رفع ملف",
  };

  return labels[action];
}

function actionBadgeClass(action: ActivityAction) {
  if (
    action === "LOGIN" ||
    action === "USER_ACTIVATED" ||
    action === "CLIENT_RESTORED" ||
    action === "CONTACT_RESTORED" ||
    action === "PROJECT_RESTORED" ||
    action === "PROJECT_COMPLETED" ||
    action === "TASK_RESTORED" ||
    action === "TASK_COMPLETED" ||
    action === "SERVICE_REQUEST_RESTORED" ||
    action === "SERVICE_REQUEST_APPROVED" ||
    action === "SERVICE_REQUEST_CONVERTED" ||
    action === "INVOICE_ISSUED" ||
    action === "PAYMENT_RECORDED" ||
    action === "EXPENSE_APPROVED" ||
    action === "EXPENSE_PAID" ||
    action === "SALES_OPPORTUNITY_WON" ||
    action === "SALES_OPPORTUNITY_CONVERTED" ||
    action === "SALES_ACTIVITY_COMPLETED" ||
    action === "SALES_PROPOSAL_ACCEPTED" ||
    action === "TIME_TIMER_STOPPED" ||
    action === "TIMESHEET_APPROVED" ||
    action === "ATTENDANCE_CHECKED_IN" ||
    action === "ATTENDANCE_CHECKED_OUT" ||
    action === "LEAVE_REQUEST_APPROVED"
  ) {
    return "text-bg-success";
  }

  if (
    action === "USER_DEACTIVATED" ||
    action === "CLIENT_ARCHIVED" ||
    action === "CONTACT_ARCHIVED" ||
    action === "PROJECT_ARCHIVED" ||
    action === "TASK_ARCHIVED" ||
    action === "SERVICE_REQUEST_ARCHIVED" ||
    action === "SERVICE_REQUEST_REJECTED" ||
    action === "INVOICE_CANCELLED" ||
    action === "PAYMENT_REVERSED" ||
    action === "EXPENSE_REJECTED" ||
    action === "EXPENSE_CANCELLED" ||
    action === "SALES_OPPORTUNITY_LOST" ||
    action === "SALES_PROPOSAL_REJECTED" ||
    action === "TIME_ENTRY_DELETED" ||
    action === "TIMESHEET_REJECTED" ||
    action === "LEAVE_REQUEST_REJECTED" ||
    action === "LEAVE_REQUEST_CANCELLED" ||
    action === "HOLIDAY_DELETED"
  ) {
    return "text-bg-danger";
  }

  if (
    action === "USER_CREATED" ||
    action === "CLIENT_CREATED" ||
    action === "CONTACT_CREATED" ||
    action === "PROJECT_CREATED" ||
    action === "TASK_CREATED" ||
    action === "SERVICE_REQUEST_CREATED" ||
    action === "DEPARTMENT_CREATED" ||
    action === "JOB_ROLE_CREATED" ||
    action === "TEAM_CREATED" ||
    action === "INVOICE_CREATED" ||
    action === "EXPENSE_CREATED" ||
    action === "SALES_OPPORTUNITY_CREATED" ||
    action === "SALES_ACTIVITY_CREATED" ||
    action === "SALES_PROPOSAL_CREATED" ||
    action === "TIME_ENTRY_CREATED" ||
    action === "TIME_TIMER_STARTED" ||
    action === "WORK_SCHEDULE_CREATED" ||
    action === "LEAVE_TYPE_CREATED" ||
    action === "HOLIDAY_CREATED"
  ) {
    return "text-bg-info";
  }

  if (
    action === "SERVICE_REQUEST_CONTACTED" ||
    action === "SERVICE_REQUEST_PROPOSAL_SENT" ||
    action === "SALES_OPPORTUNITY_STAGE_CHANGED" ||
    action === "SALES_PROPOSAL_SENT" ||
    action === "TIMESHEET_SUBMITTED" ||
    action === "LEAVE_REQUEST_SUBMITTED"
  ) {
    return "text-bg-warning";
  }

  if (action === "LOGOUT") {
    return "text-bg-secondary";
  }

  return "text-bg-primary";
}

function parsePage(value: string | undefined) {
  const page = Number(value);

  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireAuth();

  if (!hasRole(user.role, ACCESS_ROLES.activityLog)) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;

  const requestedPage = parsePage(resolvedSearchParams.page);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalActivities, todayActivities, loginCount, teamChanges] =
    await Promise.all([
      prisma.activityLog.count({
        where: {
          companyId: user.companyId,
        },
      }),

      prisma.activityLog.count({
        where: {
          companyId: user.companyId,
          createdAt: {
            gte: startOfToday,
          },
        },
      }),

      prisma.activityLog.count({
        where: {
          companyId: user.companyId,
          action: "LOGIN",
        },
      }),

      prisma.activityLog.count({
        where: {
          companyId: user.companyId,
          action: {
            in: [
              "USER_CREATED",
              "USER_UPDATED",
              "USER_DEACTIVATED",
              "USER_ACTIVATED",
            ],
          },
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalActivities / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const activities = await prisma.activityLog.findMany({
    where: {
      companyId: user.companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const from = totalActivities === 0 ? 0 : skip + 1;
  const to = Math.min(skip + activities.length, totalActivities);

  return (
    <div className="aqua-compact-page">
      <div className="aqua-compact-header mb-3">
        <AquaPageHeader
          badge="Activity Log"
          title="سجل النشاطات"
          description="جدول ثابت لكل العمليات المهمة داخل النظام، مع ترقيم صفحات وتمرير داخلي."
          brandValue="Logs"
        />
      </div>

      <div className="aqua-card aqua-log-table-card p-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h3 className="h5 fw-black mb-1">كل النشاطات</h3>
            <p className="small aqua-muted mb-0">
              عرض {from} - {to} من أصل {totalActivities} عملية
            </p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="aqua-badge">Total {totalActivities}</span>
            <span className="aqua-badge">Today {todayActivities}</span>
            <span className="aqua-badge">Login {loginCount}</span>
            <span className="aqua-badge">Team {teamChanges}</span>
            <span className="small aqua-soft ms-2" dir="ltr">
              Page {currentPage} / {totalPages}
            </span>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="aqua-card-soft p-5 text-center aqua-soft">
            لا توجد نشاطات حتى الآن.
          </div>
        ) : (
          <>
            <div className="aqua-log-table-scroll">
              <table className="table table-hover align-middle aqua-log-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العملية</th>
                    <th>الوصف</th>
                    <th>المستخدم</th>
                    <th>الكيان</th>
                    <th>IP</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>

                <tbody>
                  {activities.map((activity, index) => (
                    <tr key={activity.id}>
                      <td className="aqua-soft" dir="ltr">
                        {skip + index + 1}
                      </td>

                      <td>
                        <span
                          className={`badge ${actionBadgeClass(
                            activity.action,
                          )}`}
                        >
                          {actionLabel(activity.action)}
                        </span>

                        <div className="small aqua-soft mt-2" dir="ltr">
                          {activity.action}
                        </div>
                      </td>

                      <td>
                        <div className="fw-bold">
                          {activity.message || actionLabel(activity.action)}
                        </div>

                        {activity.userAgent ? (
                          <div
                            className="small aqua-soft mt-2 text-truncate"
                            style={{ maxWidth: 420 }}
                            dir="ltr"
                            title={activity.userAgent}
                          >
                            {activity.userAgent}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div className="fw-bold">
                          {activity.user?.name || "System"}
                        </div>

                        {activity.user?.email ? (
                          <div className="small aqua-soft" dir="ltr">
                            {activity.user.email}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        {activity.entityType ? (
                          <>
                            <div className="fw-bold" dir="ltr">
                              {activity.entityType}
                            </div>

                            {activity.entityId ? (
                              <div className="small aqua-soft" dir="ltr">
                                {activity.entityId.slice(0, 10)}...
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="aqua-soft">—</span>
                        )}
                      </td>

                      <td className="small aqua-muted" dir="ltr">
                        {activity.ipAddress || "N/A"}
                      </td>

                      <td className="small aqua-muted" dir="ltr">
                        {activity.createdAt.toLocaleString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3">
              <AquaPagination
                basePath="/dashboard/activity"
                currentPage={currentPage}
                totalPages={totalPages}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
