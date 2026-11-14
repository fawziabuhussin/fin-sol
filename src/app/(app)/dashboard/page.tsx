import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/lib/tenant-data";
import { getSubscriptionsOverview } from "@/lib/subscriptions-data";
import { listSplitPlans } from "@/lib/split-payments";
import { currentPeriod } from "@/lib/period";
import { parseIntSafe } from "@/lib/utils";
import { MonthlyDashboard, type DashboardPulse } from "@/components/dashboard/monthly-dashboard";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = currentPeriod();
  const y = parseIntSafe(params.year, now.year);
  const year = y >= 2000 && y <= 2100 ? y : now.year;
  const monthParam = params.month ? parseIntSafe(params.month, 0) : undefined;
  const month = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined;

  const data = await getDashboardData(user.id, year, month);

  // What needs attention this month, across the other pages.
  const monthKey = `${data.year}-${String(data.month).padStart(2, "0")}`;
  const todayIso = `${now.year}-${String(now.month).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const [subs, splits, employers, slips] = await Promise.all([
    getSubscriptionsOverview(user.id, data.year, data.month),
    listSplitPlans(user.id).catch(() => []),
    prisma.employer.count({ where: { userId: user.id, active: true } }),
    prisma.salarySlip.findMany({
      where: { userId: user.id, periodYear: data.year, periodMonth: data.month, worked: true },
      select: { paid: true },
    }),
  ]);
  const dueInstallments = splits.flatMap((p) =>
    p.installments.filter((i) => i.status === "PENDING" && i.dueDate.slice(0, 7) <= monthKey)
  );

  const pulse: DashboardPulse = {
    subscriptions: {
      total: subs.totalCount,
      unpaid: subs.totalCount - subs.paidCount,
      remaining: subs.totalRemaining,
    },
    installments: {
      due: dueInstallments.length,
      amount: dueInstallments.reduce((s, i) => s + i.amount, 0),
      overdue: dueInstallments.filter((i) => i.dueDate < todayIso).length,
      activePlans: splits.filter((p) => p.pendingCount > 0).length,
    },
    salary: {
      employers,
      recorded: slips.length,
      pendingPay: slips.filter((s) => !s.paid).length,
    },
  };

  return (
    <MonthlyDashboard
      overview={data.overview}
      trend={data.trend}
      availableMonths={data.availableMonths}
      expenseMonths={data.expenseMonths}
      buildingProjectId={data.buildingProjectId}
      totalSavingsExclKupot={data.totalSavingsExclKupot}
      expenseCategories={data.expenseCategories}
      year={data.year}
      month={data.month}
      currentPeriod={now}
      pulse={pulse}
    />
  );
}
