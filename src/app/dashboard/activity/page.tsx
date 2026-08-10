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
    PROJECT_READINESS_UPDATED: "تحديث جاهزية مشروع",
    PROJECT_READINESS_OVERRIDE_GRANTED: "منح تجاوز جاهزية",
    PROJECT_READINESS_OVERRIDE_REVOKED: "إلغاء تجاوز جاهزية",
    PROJECT_STARTED: "بدء مشروع",
    PROJECT_DELIVERABLE_CREATED: "إضافة تسليم مشروع",
    PROJECT_DELIVERABLE_UPDATED: "تعديل تسليم مشروع",
    PROJECT_DELIVERABLE_STATUS_CHANGED: "تغيير حالة تسليم",
    PROJECT_DELIVERABLE_REMOVED: "حذف تسليم مشروع",
    PROJECT_CHANGE_REQUEST_CREATED: "إنشاء طلب تغيير",
    PROJECT_CHANGE_REQUEST_UPDATED: "تعديل طلب تغيير",
    PROJECT_CHANGE_REQUEST_SUBMITTED: "إرسال طلب تغيير",
    PROJECT_CHANGE_REQUEST_CHANGES_REQUESTED: "طلب تعديلات على تغيير",
    PROJECT_CHANGE_REQUEST_APPROVED: "اعتماد طلب تغيير",
    PROJECT_CHANGE_REQUEST_REJECTED: "رفض طلب تغيير",
    PROJECT_CHANGE_REQUEST_APPLIED: "تطبيق طلب تغيير",
    PROJECT_CHANGE_REQUEST_CANCELLED: "إلغاء طلب تغيير",
    PROJECT_CHANGE_FINANCE_APPROVED: "اعتماد أثر مالي",
    PROJECT_CHANGE_FINANCE_REJECTED: "رفض أثر مالي",
    PROJECT_AMENDMENT_CREATED: "إنشاء ملحق عقد",
    PROJECT_AMENDMENT_READY_FOR_REVIEW: "إرسال ملحق للمراجعة",
    PROJECT_AMENDMENT_INTERNALLY_APPROVED: "اعتماد ملحق داخليًا",
    PROJECT_AMENDMENT_SENT: "إرسال ملحق للعميل",
    PROJECT_AMENDMENT_ACCEPTED: "قبول ملحق العقد",
    PROJECT_AMENDMENT_REJECTED: "رفض ملحق العقد",
    PROJECT_RISK_CREATED: "تسجيل خطر مشروع",
    PROJECT_RISK_UPDATED: "تحديث خطر مشروع",
    PROJECT_RISK_MATERIALIZED: "تحول خطر إلى مشكلة",
    PROJECT_RISK_CLOSED: "إغلاق خطر مشروع",
    PROJECT_RISK_REOPENED: "إعادة فتح خطر مشروع",
    PROJECT_ISSUE_CREATED: "تسجيل مشكلة مشروع",
    PROJECT_ISSUE_UPDATED: "تحديث مشكلة مشروع",
    PROJECT_ISSUE_RESOLVED: "حل مشكلة مشروع",
    PROJECT_ISSUE_CLOSED: "إغلاق مشكلة مشروع",
    PROJECT_ISSUE_REOPENED: "إعادة فتح مشكلة مشروع",
    PROJECT_DECISION_RECORDED: "تسجيل قرار مشروع",
    PROJECT_DECISION_SUPERSEDED: "استبدال قرار مشروع",
    PROJECT_CLOSURE_UPDATED: "تحديث إغلاق مشروع",
    PROJECT_CLOSURE_SUBMITTED: "إرسال إغلاق مشروع للمراجعة",
    PROJECT_CLOSURE_COMPLETED: "اعتماد إغلاق مشروع",
    PROJECT_CLOSURE_ARCHIVED: "أرشفة مشروع مغلق",
    PROJECT_FEEDBACK_RECORDED: "تسجيل تقييم العميل",
    PROJECT_FEEDBACK_TASK_CREATED: "إنشاء مهمة متابعة التقييم",
    PROJECT_FEEDBACK_LINK_ISSUED: "إصدار رابط تقييم العميل",
    PROJECT_FEEDBACK_LINK_REVOKED: "إلغاء رابط تقييم العميل",
    PROJECT_FEEDBACK_LINK_VIEWED: "فتح رابط تقييم العميل",
    PROJECT_FEEDBACK_CLIENT_SUBMITTED: "إرسال تقييم العميل",
    PROJECT_FEEDBACK_DELIVERY_PREPARED: "تجهيز دعوة تقييم العميل",
    PROJECT_FEEDBACK_DELIVERY_FAILED: "فشل إرسال دعوة التقييم",
    PROJECT_FEEDBACK_SENT: "إرسال دعوة تقييم العميل",
    PROJECT_FEEDBACK_REMINDER_SENT: "إرسال تذكير تقييم العميل",
    PROJECT_FEEDBACK_REMINDER_FAILED: "فشل إرسال تذكير التقييم",
    PROJECT_FEEDBACK_SCHEDULE_ENABLED: "تفعيل جدولة تذكير التقييم",
    PROJECT_FEEDBACK_SCHEDULE_DISABLED: "إيقاف جدولة تذكير التقييم",
    PROJECT_FEEDBACK_SCHEDULED_REMINDER_SENT: "إرسال تذكير تقييم مجدول",
    PROJECT_FEEDBACK_SCHEDULED_REMINDER_FAILED: "فشل تذكير تقييم مجدول",
    PROJECT_FEEDBACK_RESOLVED: "إغلاق متابعة تقييم العميل",
    PROJECT_FEEDBACK_WAIVED: "إعفاء تقييم العميل",
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
    DISCOVERY_SESSION_CREATED: "بدء جلسة اكتشاف",
    DISCOVERY_SESSION_UPDATED: "تحديث جلسة اكتشاف",
    DISCOVERY_READY_FOR_REVIEW: "إرسال اكتشاف للمراجعة",
    DISCOVERY_GAP_WAIVED: "تجاوز فجوة متطلبات",
    DISCOVERY_GAP_REOPENED: "إعادة فتح فجوة متطلبات",
    DISCOVERY_PUBLIC_LINK_ISSUED: "إصدار رابط اكتشاف",
    DISCOVERY_PUBLIC_LINK_REVOKED: "إلغاء رابط اكتشاف",
    DISCOVERY_CONVERSATION_STARTED: "بدء محادثة اكتشاف",
    DISCOVERY_CONVERSATION_ESCALATED: "طلب مساعدة في الاكتشاف",
    DISCOVERY_CONVERSATION_SUBMITTED: "إرسال محادثة اكتشاف",
    DISCOVERY_REPORT_AI_GENERATED: "توليد مسودة تقرير اكتشاف",
    DISCOVERY_REPORT_VERSION_CREATED: "حفظ إصدار تقرير اكتشاف",
    DISCOVERY_REPORT_SUBMITTED: "إرسال تقرير اكتشاف للمراجعة",
    DISCOVERY_REPORT_CHANGES_REQUESTED: "طلب تعديلات على تقرير اكتشاف",
    DISCOVERY_REPORT_APPROVED: "اعتماد تقرير اكتشاف",
    PRICING_VERSION_CREATED: "حفظ إصدار تسعير",
    PRICING_SUBMITTED: "إرسال تسعير للمراجعة",
    PRICING_CHANGES_REQUESTED: "طلب تعديلات على تسعير",
    PRICING_APPROVED: "اعتماد تسعير",
    PROPOSAL_VERSION_CREATED: "حفظ إصدار عرض",
    PROPOSAL_SUBMITTED: "إرسال عرض للمراجعة",
    PROPOSAL_CHANGES_REQUESTED: "طلب تعديلات على عرض",
    PROPOSAL_APPROVED: "اعتماد عرض",
    PROPOSAL_DELIVERY_PREPARED: "إعداد تسليم عرض",
    PROPOSAL_DELIVERY_FAILED: "فشل تسليم عرض",
    PROPOSAL_SENT: "إرسال عرض للعميل",
    PROPOSAL_LINK_REVOKED: "إلغاء رابط عرض",
    PROPOSAL_VIEWED: "مشاهدة العميل للعرض",
    PROPOSAL_CLIENT_CHANGES_REQUESTED: "طلب العميل تعديل العرض",
    PROPOSAL_CLIENT_ACCEPTED: "قبول العميل للعرض",
    PROPOSAL_CLIENT_REJECTED: "رفض العميل للعرض",
    PROPOSAL_CONVERTED_TO_PROJECT: "تحويل العرض إلى مشروع",

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
    || action === "DISCOVERY_READY_FOR_REVIEW"
    || action === "DISCOVERY_CONVERSATION_SUBMITTED"
    || action === "DISCOVERY_REPORT_APPROVED"
    || action === "PRICING_APPROVED"
    || action === "PROPOSAL_APPROVED"
    || action === "PROPOSAL_SENT"
    || action === "PROPOSAL_CLIENT_ACCEPTED"
    || action === "PROPOSAL_CONVERTED_TO_PROJECT"
    || action === "PROJECT_RISK_CLOSED"
    || action === "PROJECT_ISSUE_RESOLVED"
    || action === "PROJECT_ISSUE_CLOSED"
    || action === "PROJECT_DECISION_RECORDED"
  ) {
    return "text-bg-success";
  }

  if (
    action === "USER_DEACTIVATED" ||
    action === "PROJECT_RISK_MATERIALIZED" ||
    action === "PROJECT_DECISION_SUPERSEDED" ||
    action === "DISCOVERY_PUBLIC_LINK_REVOKED" ||
    action === "PROPOSAL_DELIVERY_FAILED" ||
    action === "PROPOSAL_LINK_REVOKED" ||
    action === "PROPOSAL_CLIENT_REJECTED" ||
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
    || action === "DISCOVERY_SESSION_CREATED"
    || action === "DISCOVERY_PUBLIC_LINK_ISSUED"
    || action === "DISCOVERY_CONVERSATION_STARTED"
    || action === "DISCOVERY_REPORT_AI_GENERATED"
    || action === "DISCOVERY_REPORT_VERSION_CREATED"
    || action === "PRICING_VERSION_CREATED"
    || action === "PROPOSAL_VERSION_CREATED"
    || action === "PROPOSAL_DELIVERY_PREPARED"
    || action === "PROPOSAL_VIEWED"
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
    || action === "DISCOVERY_GAP_WAIVED"
    || action === "DISCOVERY_GAP_REOPENED"
    || action === "DISCOVERY_CONVERSATION_ESCALATED"
    || action === "DISCOVERY_REPORT_SUBMITTED"
    || action === "DISCOVERY_REPORT_CHANGES_REQUESTED"
    || action === "PRICING_SUBMITTED"
    || action === "PRICING_CHANGES_REQUESTED"
    || action === "PROPOSAL_SUBMITTED"
    || action === "PROPOSAL_CHANGES_REQUESTED"
    || action === "PROPOSAL_CLIENT_CHANGES_REQUESTED"
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
