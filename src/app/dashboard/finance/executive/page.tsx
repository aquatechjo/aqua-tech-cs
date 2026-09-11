import Link from 'next/link';
import { InvoiceStatus } from '@/generated/prisma/enums';
import AquaPageHeader from '@/components/layout/AquaPageHeader';
import { AquaBarChart } from '@/components/aqua';
import { ACCESS_ROLES, assertRole } from '@/lib/access-control';
import { requireAuth } from '@/lib/auth';
import { businessDate, minorToMoney } from '@/lib/finance';
import { decimalMinor } from '@/lib/finance-server';
import {
  RECEIVABLE_BUCKETS,
  receivableBucketLabels,
  receivableBucketWhere,
} from '@/lib/receivables-aging';
import { prisma } from '@/lib/prisma';

function money(value: string, currency: string) {
  return `${Number(value).toLocaleString('en-JO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('ar', {
    month: 'short',
    year: '2-digit',
  });
}

export default async function ExecutiveFinancePage() {
  const user = await requireAuth();
  assertRole(user.role, ACCESS_ROLES.financeRead);

  const now = new Date();
  const asOf = businessDate(now, user.company.timezone);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const receivablesBaseWhere = {
    companyId: user.companyId,
    status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
  };

  const [
    collectedThis,
    collectedPrev,
    expensesThis,
    expensesPrev,
    revenueRows,
    bucketRows,
    debtorRows,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { companyId: user.companyId, status: 'POSTED', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        companyId: user.companyId,
        status: 'POSTED',
        paidAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId: user.companyId, status: 'PAID', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyId: user.companyId,
        status: 'PAID',
        paidAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<Array<{ month: string; total: string }>>`
      SELECT to_char(date_trunc('month', "issueDate"), 'YYYY-MM') AS month, COALESCE(SUM("totalAmount"), 0)::text AS total
      FROM "Invoice"
      WHERE "companyId" = ${user.companyId}
        AND "status" IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
        AND "issueDate" >= ${sixMonthsAgo}
      GROUP BY 1
      ORDER BY 1
    `,
    Promise.all(
      RECEIVABLE_BUCKETS.map(async (bucket) => {
        const result = await prisma.invoice.aggregate({
          where: { ...receivablesBaseWhere, ...receivableBucketWhere(bucket, asOf) },
          _sum: { totalAmount: true, amountPaid: true },
          _count: { _all: true },
        });
        return {
          bucket,
          count: result._count?._all ?? 0,
          outstandingMinor: Math.max(
            0,
            decimalMinor(result._sum?.totalAmount) - decimalMinor(result._sum?.amountPaid),
          ),
        };
      }),
    ),
    prisma.invoice.groupBy({
      by: ['clientId'],
      where: { ...receivablesBaseWhere, clientId: { not: null } },
      _sum: { totalAmount: true, amountPaid: true },
    }),
  ]);

  const collectedThisMinor = decimalMinor(collectedThis._sum.amount);
  const collectedPrevMinor = decimalMinor(collectedPrev._sum.amount);
  const expensesThisMinor = decimalMinor(expensesThis._sum.amount);
  const expensesPrevMinor = decimalMinor(expensesPrev._sum.amount);
  const netCashThis = collectedThisMinor - expensesThisMinor;
  const netCashPrev = collectedPrevMinor - expensesPrevMinor;

  const revenueByMonth = new Map(revenueRows.map((row) => [row.month, decimalMinor(row.total)]));
  const revenueSeries = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { label: monthLabel(key), value: (revenueByMonth.get(key) ?? 0) / 100 };
  });

  const totalOutstandingMinor = bucketRows.reduce((sum, row) => sum + row.outstandingMinor, 0);

  const topDebtors = debtorRows
    .map((row) => ({
      clientId: row.clientId as string,
      outstandingMinor: Math.max(
        0,
        decimalMinor(row._sum?.totalAmount) - decimalMinor(row._sum?.amountPaid),
      ),
    }))
    .filter((row) => row.outstandingMinor > 0)
    .sort((a, b) => b.outstandingMinor - a.outstandingMinor)
    .slice(0, 5);

  const debtorClients = topDebtors.length
    ? await prisma.client.findMany({
        where: { id: { in: topDebtors.map((row) => row.clientId) }, companyId: user.companyId },
        select: { id: true, name: true },
      })
    : [];
  const debtorNameById = new Map(debtorClients.map((client) => [client.id, client.name]));

  return (
    <div className="aqua-finance-page">
      <AquaPageHeader
        badge="Executive Overview"
        title="نظرة تنفيذية على المالية"
        description="ملخص سريع للإيرادات والمديونيات والتدفق النقدي دون الحاجة للتنقل بين الشاشات التفصيلية."
        brandValue="Finance"
      />

      <div className="aqua-finance-actions">
        <Link className="btn btn-outline-info fw-bold" href="/dashboard/finance">
          الملخص التشغيلي
        </Link>
        <Link className="btn btn-outline-info fw-bold" href="/dashboard/finance/receivables">
          أعمار الذمم
        </Link>
      </div>

      <div className="row g-3 aqua-finance-metrics">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="aqua-card p-4 h-100 aqua-finance-metric">
            <div className="small aqua-muted">صافي التدفق النقدي هذا الشهر</div>
            <div
              className={`h3 fw-black mt-3 mb-0 ${netCashThis < 0 ? 'text-danger' : 'text-success'}`}
              dir="ltr"
            >
              {money(minorToMoney(netCashThis), user.company.currency)}
            </div>
            <div className="small aqua-soft mt-3" dir="ltr">
              الشهر الماضي: {money(minorToMoney(netCashPrev), user.company.currency)}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="aqua-card p-4 h-100 aqua-finance-metric">
            <div className="small aqua-muted">المحصّل هذا الشهر</div>
            <div className="h3 fw-black mt-3 mb-0" dir="ltr">
              {money(minorToMoney(collectedThisMinor), user.company.currency)}
            </div>
            <div className="small aqua-soft mt-3" dir="ltr">
              المصروف: {money(minorToMoney(expensesThisMinor), user.company.currency)}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="aqua-card p-4 h-100 aqua-finance-metric">
            <div className="small aqua-muted">إجمالي الذمم المفتوحة</div>
            <div className="h3 fw-black mt-3 mb-0" dir="ltr">
              {money(minorToMoney(totalOutstandingMinor), user.company.currency)}
            </div>
            <div className="small aqua-soft mt-3">
              {bucketRows.reduce((sum, row) => sum + row.count, 0)} فاتورة مفتوحة
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="aqua-card p-4 h-100 aqua-finance-metric">
            <div className="small aqua-muted">أكبر مدين</div>
            <div className="h3 fw-black mt-3 mb-0" dir="ltr">
              {topDebtors[0]
                ? money(minorToMoney(topDebtors[0].outstandingMinor), user.company.currency)
                : money('0.00', user.company.currency)}
            </div>
            <div className="small aqua-soft mt-3">
              {topDebtors[0]
                ? (debtorNameById.get(topDebtors[0].clientId) ?? 'عميل غير معروف')
                : 'لا توجد ذمم'}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 aqua-finance-overview-grid">
        <div className="col-12 col-xl-7">
          <div className="aqua-card p-4 h-100">
            <h2 className="h5 fw-black mb-1">اتجاه الإيرادات (آخر 6 أشهر)</h2>
            <div className="small aqua-muted mb-4">إجمالي الفواتير الصادرة حسب تاريخ الإصدار</div>
            <AquaBarChart
              data={revenueSeries}
              formatValue={(value) => value.toLocaleString('en-JO', { maximumFractionDigits: 0 })}
            />
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="aqua-card p-4 h-100">
            <div className="d-flex align-items-center justify-content-between gap-3 mb-1">
              <h2 className="h5 fw-black mb-0">أكبر 5 مدينين</h2>
              <Link href="/dashboard/finance/receivables" className="btn btn-sm btn-outline-info">
                كل الذمم
              </Link>
            </div>
            <div className="small aqua-muted mb-4">أعلى أرصدة مفتوحة حسب العميل</div>

            {topDebtors.length === 0 ? (
              <div className="aqua-card-soft p-5 text-center aqua-muted">لا توجد ذمم مفتوحة</div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {topDebtors.map((row) => (
                  <div
                    className="aqua-card-soft p-3 d-flex align-items-center justify-content-between gap-3"
                    key={row.clientId}
                  >
                    <div className="fw-bold">
                      {debtorNameById.get(row.clientId) ?? 'عميل غير معروف'}
                    </div>
                    <div className="fw-bold text-danger" dir="ltr">
                      {money(minorToMoney(row.outstandingMinor), user.company.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="aqua-card p-4">
        <h2 className="h5 fw-black mb-1">أعمار الذمم</h2>
        <div className="small aqua-muted mb-4">
          ملخص سريع — للتفاصيل الكاملة والفصل حسب العملة راجع{' '}
          <Link href="/dashboard/finance/receivables">صفحة أعمار الذمم</Link>
        </div>
        <div className="row g-3">
          {bucketRows.map((row) => (
            <div className="col-12 col-md-4 col-xl-2" key={row.bucket}>
              <Link
                className="text-decoration-none"
                href={`/dashboard/finance/receivables?bucket=${row.bucket}`}
              >
                <div className="aqua-card-soft p-3 h-100">
                  <div className="small aqua-muted">{receivableBucketLabels[row.bucket]}</div>
                  <div className="fw-bold mt-2" dir="ltr">
                    {money(minorToMoney(row.outstandingMinor), user.company.currency)}
                  </div>
                  <div className="small aqua-soft mt-1">{row.count} فاتورة</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
