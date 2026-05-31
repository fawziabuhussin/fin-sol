import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import {
  TransactionType,
  BuildContractorStatus,
  SavingsPlanStatus,
} from "@/generated/prisma/client";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
} from "date-fns";
import { ar } from "date-fns/locale";

export async function getDashboardData(
  householdId: string,
  year: number,
  month: number
) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const prevStart = startOfMonth(subMonths(monthStart, 1));
  const prevEnd = endOfMonth(prevStart);

  const [
    monthTx,
    prevMonthTx,
    buildProject,
    contractors,
    savingsPlans,
    salarySlip,
    snapshots,
    insights,
    categories,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, date: { gte: monthStart, lte: monthEnd } },
      include: { category: true, paymentMethod: true },
      orderBy: { date: "desc" },
    }),
    prisma.transaction.findMany({
      where: { householdId, date: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.buildProject.findUnique({ where: { householdId } }),
    prisma.buildContractor.findMany({
      where: { householdId, status: { not: BuildContractorStatus.INACTIVE } },
      orderBy: { remainingBalance: "desc" },
    }),
    prisma.savingsPlan.findMany({
      where: { householdId, status: SavingsPlanStatus.ACTIVE },
    }),
    prisma.salarySlip.findUnique({
      where: { householdId_year_month: { householdId, year, month } },
      include: { lineItems: true },
    }),
    prisma.monthlySnapshot.findMany({
      where: {
        householdId,
        year: { gte: year - 1 },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    prisma.insight.findMany({
      where: {
        householdId,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      orderBy: { validFrom: "desc" },
      take: 8,
    }),
    prisma.category.findMany({
      where: { householdId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const sumByType = (tx: typeof monthTx, type: TransactionType) =>
    tx
      .filter((t) => t.type === type)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);

  const income = sumByType(monthTx, TransactionType.INCOME);
  const dailyExpenses = monthTx
    .filter(
      (t) =>
        t.type === TransactionType.EXPENSE &&
        !t.isBuildExpense &&
        t.category?.kind !== "SAVINGS"
    )
    .reduce((s, t) => s + decimalToNumber(t.amount), 0);
  const buildExpenses = monthTx
    .filter(
      (t) => t.type === TransactionType.BUILD_EXPENSE || t.isBuildExpense
    )
    .reduce((s, t) => s + decimalToNumber(t.amount), 0);
  const savings = sumByType(monthTx, TransactionType.SAVINGS_CONTRIBUTION);
  const net = income - dailyExpenses - buildExpenses - savings;

  const prevDaily = prevMonthTx
    .filter((t) => t.type === TransactionType.EXPENSE && !t.isBuildExpense)
    .reduce((s, t) => s + decimalToNumber(t.amount), 0);

  const expenseByCategory = monthTx
    .filter((t) => t.type === TransactionType.EXPENSE && t.category)
    .reduce<Record<string, number>>((acc, t) => {
      const name = t.category!.name;
      acc[name] = (acc[name] ?? 0) + decimalToNumber(t.amount);
      return acc;
    }, {});

  const chartData = buildChartSeries(snapshots, year, month);

  const totalPaid = contractors.reduce(
    (s, c) => s + decimalToNumber(c.amountPaid),
    0
  );
  const totalBudget = buildProject
    ? decimalToNumber(buildProject.totalBudget)
    : contractors.reduce((s, c) => s + decimalToNumber(c.contractTotal), 0);
  const budgetProgress = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

  const nextDue = contractors
    .filter(
      (c) =>
        decimalToNumber(c.remainingBalance) > 0 &&
        c.status !== BuildContractorStatus.COMPLETED
    )
    .sort((a, b) => {
      const da = a.firstPaymentDueDate?.getTime() ?? Infinity;
      const db = b.firstPaymentDueDate?.getTime() ?? Infinity;
      return da - db;
    })[0];

  const kerenLine = salarySlip?.lineItems.find(
    (l) => l.code === "KEREN_HISHTALMUT"
  );

  return {
    monthLabel: format(monthStart, "MMMM yyyy", { locale: ar }),
    year,
    month,
    kpis: {
      income,
      dailyExpenses,
      buildExpenses,
      savings,
      net,
      dailyExpensesDeltaPct:
        prevDaily > 0
          ? Math.round(((dailyExpenses - prevDaily) / prevDaily) * 100)
          : 0,
      transactionCount: monthTx.length,
      avgTransaction:
        monthTx.length > 0
          ? Math.round(
              monthTx.reduce((s, t) => s + decimalToNumber(t.amount), 0) /
                monthTx.length
            )
          : 0,
      activeJamiya: savingsPlans.length,
      budgetProgress: Math.round(budgetProgress),
    },
    transactions: monthTx.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      category: t.category?.name ?? "—",
      amount: decimalToNumber(t.amount),
      description: t.description ?? "",
      paymentMethod: t.paymentMethod?.name ?? "—",
    })),
    expenseByCategory: Object.entries(expenseByCategory).map(([name, value]) => ({
      name,
      value,
    })),
    chartData,
    build: {
      totalBudget,
      totalPaid,
      remaining: totalBudget - totalPaid,
      progress: budgetProgress,
      nextDue: nextDue
        ? {
            name: nextDue.name,
            amount: decimalToNumber(
              nextDue.installmentAmount ?? nextDue.remainingBalance
            ),
          }
        : null,
      contractors: contractors.slice(0, 5).map((c) => ({
        name: c.name,
        paid: decimalToNumber(c.amountPaid),
        total: decimalToNumber(c.contractTotal),
        remaining: decimalToNumber(c.remainingBalance),
        status: c.status,
      })),
    },
    savings: savingsPlans.map((p) => ({
      id: p.id,
      name: p.name,
      monthly: decimalToNumber(p.monthlyContribution),
      payoutDate: p.payoutDate.toISOString(),
      remaining: decimalToNumber(p.remaining),
      total: decimalToNumber(p.totalCommitment),
    })),
    salary: salarySlip
      ? {
          net: decimalToNumber(salarySlip.netTotal),
          gross: decimalToNumber(salarySlip.grossTotal),
          keren: kerenLine ? decimalToNumber(kerenLine.amount) : 0,
        }
      : null,
    insights: insights.map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      title: i.title,
      body: i.body,
      actionLabel: i.actionLabel,
      actionHref: i.actionHref,
    })),
    categories: categories.map((c) => c.name),
  };
}

function buildChartSeries(
  snapshots: Awaited<ReturnType<typeof prisma.monthlySnapshot.findMany>>,
  year: number,
  month: number
) {
  const points: {
    label: string;
    income: number;
    expenses: number;
    build: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(year, month - 1, 1), i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const snap = snapshots.find((s) => s.year === y && s.month === m);
    const label = format(d, "MMM", { locale: ar });
    if (snap) {
      points.push({
        label,
        income: decimalToNumber(snap.totalIncome),
        expenses: decimalToNumber(snap.dailyExpenses),
        build: decimalToNumber(snap.buildExpenses),
      });
    } else {
      points.push({ label, income: 0, expenses: 0, build: 0 });
    }
  }
  return points;
}
