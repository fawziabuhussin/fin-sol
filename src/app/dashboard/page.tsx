import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard-data";
import {
  getActiveHouseholdId,
  ensureHouseholdForUser,
} from "@/lib/household";
import { seedHouseholdLookups } from "@/lib/seed-household";
import { prisma } from "@/lib/db";
import { generateInsights } from "@/lib/insights/engine";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SmartInsightsFeed } from "@/components/dashboard/smart-insights-feed";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { BuildPanel } from "@/components/dashboard/build-panel";
import { SavingsPanel } from "@/components/dashboard/savings-panel";
import { PayslipPanel } from "@/components/dashboard/payslip-panel";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { RegenerateInsightsButton } from "@/components/dashboard/regenerate-insights-button";

type SearchParams = Promise<{ year?: string; month?: string }>;

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let householdId = await getActiveHouseholdId(session.user.id);
  if (!householdId) {
    const household = await ensureHouseholdForUser(session.user.id);
    householdId = household.id;
    await seedHouseholdLookups(prisma, householdId);
    await prisma.kerenHishtalmutProfile.upsert({
      where: { householdId },
      create: { householdId },
      update: {},
    });
  }

  const params = await searchParams;
  const year = parseInt(params.year ?? "2026", 10);
  const month = parseInt(params.month ?? "5", 10);

  let data = await getDashboardData(householdId, year, month);

  if (data.insights.length === 0) {
    await generateInsights(householdId);
    data = await getDashboardData(householdId, year, month);
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <DashboardHeader
        year={year}
        month={month}
        userName={session.user.name}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            لوحة التحكم — {data.monthLabel}
          </h1>
          <RegenerateInsightsButton />
        </div>

        <SmartInsightsFeed insights={data.insights} />
        <KpiRow kpis={data.kpis} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <CashflowChart data={data.chartData} />
            <CategoryDonut data={data.expenseByCategory} />
          </div>
          <div className="space-y-6">
            <BuildPanel build={data.build} />
            <SavingsPanel plans={data.savings} />
            <PayslipPanel salary={data.salary} monthLabel={data.monthLabel} />
          </div>
        </div>

        <TransactionsTable
          transactions={data.transactions}
          categories={data.categories}
          avgTransaction={data.kpis.avgTransaction}
        />
      </main>
    </div>
  );
}
