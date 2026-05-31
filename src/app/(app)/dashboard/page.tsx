import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/lib/tenant-data";
import { parseIntSafe } from "@/lib/utils";
import { MonthlyDashboard } from "@/components/dashboard/monthly-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const year = parseIntSafe(params.year, 2026);
  const monthParam = params.month ? parseIntSafe(params.month, 0) : undefined;
  const month = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined;

  const data = await getDashboardData(user.id, year, month);

  return (
    <MonthlyDashboard
      overview={data.overview}
      trend={data.trend}
      availableMonths={data.availableMonths}
      expenseMonths={data.expenseMonths}
      buildingProjectId={data.buildingProjectId}
      year={data.year}
      month={data.month}
    />
  );
}
