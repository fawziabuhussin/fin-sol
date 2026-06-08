import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import {
  adjustUndertrackedExpenses,
  isSavingsRelatedIncome,
  isUndertrackedExpenseMonth,
  planAppliesInMonth,
  reportThroughMonth,
  buildYearForecast,
} from "@/lib/annual-report";
import { monthRangeUTC, utcMonth, yearRangeUTC } from "@/lib/dates";
import { INCOME_SOURCES, monthLabel } from "@/lib/finance-labels";
import { paidAtForPeriod } from "@/lib/savings-schedule";
import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { getMarketRates } from "@/lib/market-rates";
import { computeAssetValueIls } from "@/lib/savings-asset-value";
import { isAssetPurchaseDescription } from "@/lib/savings-contribution";
import {
  kupotAmountsFromSlip,
  sumKupotAmounts,
} from "@/lib/kupot-totals";
import {
  repairPaidInstallmentTransactions,
  sumPaidInstallments,
} from "@/lib/installment-transactions";
import { contractorBudgetTotal } from "@/lib/project-completion-utils";
import {
  CategoryKind,
  InstallmentStatus,
  ProjectKind,
  TransactionType,
} from "@/generated/prisma/client";

const BUILD_CATEGORY = "بناء";

const INCOME_PALETTE = [
  "#059669",
  "#10b981",
  "#14b8a6",
  "#6366f1",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
];

type IncomeSourceRow = {
  id: string;
  name: string;
  color: string;
  isSalary: boolean;
  amount: number;
};

function slugifyIncomeId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function incomeSourceMeta(name: string, colorIndex: number) {
  const known = INCOME_SOURCES.find((s) => s.name === name);
  return {
    id: known?.id ?? slugifyIncomeId(name),
    color: known?.color ?? INCOME_PALETTE[colorIndex % INCOME_PALETTE.length],
    isSalary: known ? "isSalary" in known && !!known.isSalary : false,
  };
}

function buildIncomeSources(
  transactions: Array<{
    type: TransactionType;
    amount: { toString(): string } | null;
    salarySlipId: string | null;
    description: string | null;
    payee: { name: string } | null;
  }>,
  salarySlips: Array<{
    paid: boolean;
    worked: boolean;
    net: { toString(): string } | null;
    employer: { name: string; color: string | null };
  }>
): IncomeSourceRow[] {
  const rows = new Map<string, IncomeSourceRow>();

  const txByName = new Map<string, { linked: number; unlinked: number }>();
  for (const t of transactions) {
    if (t.type !== TransactionType.INCOME || isSavingsRelatedIncome(t)) continue;
    const name = t.payee?.name ?? t.description?.trim() ?? "غير مصنّف";
    const amt = decimalToNumber(t.amount);
    const group = txByName.get(name) ?? { linked: 0, unlinked: 0 };
    if (t.salarySlipId) group.linked += amt;
    else group.unlinked += amt;
    txByName.set(name, group);
  }

  for (const [name, group] of txByName) {
    const meta = incomeSourceMeta(name, rows.size);
    rows.set(name, {
      id: meta.id,
      name,
      color: meta.color,
      isSalary: meta.isSalary || group.linked > 0,
      amount: group.linked > 0 ? group.linked : group.unlinked,
    });
  }

  for (const slip of salarySlips) {
    if (!slip.paid || !slip.worked) continue;
    const name = slip.employer.name;
    const existing = rows.get(name);
    if (existing && existing.amount > 0) continue;

    const meta = incomeSourceMeta(name, rows.size);
    rows.set(name, {
      id: meta.id,
      name,
      color: slip.employer.color ?? meta.color,
      isSalary: true,
      amount: decimalToNumber(slip.net),
    });
  }

  return [...rows.values()]
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export async function getMonthsWithData(userId: string, year: number) {
  const { start, end } = yearRangeUTC(year);

  const [txMonths, salaryMonths] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: start, lte: end } },
      select: { occurredAt: true, type: true },
    }),
    prisma.salarySlip.findMany({
      where: { userId, periodYear: year },
      select: { periodMonth: true },
    }),
  ]);

  const months = new Set<number>();
  for (const t of txMonths) months.add(utcMonth(t.occurredAt));
  for (const s of salaryMonths) months.add(s.periodMonth);
  return [...months].sort((a, b) => a - b);
}

export async function getMonthsWithExpenses(userId: string, year: number) {
  const { start, end } = yearRangeUTC(year);
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: start, lte: end },
    },
    select: { occurredAt: true },
  });
  const months = new Set<number>();
  for (const r of rows) months.add(utcMonth(r.occurredAt));
  return [...months].sort((a, b) => a - b);
}

export async function resolveDashboardMonth(
  userId: string,
  year: number,
  month?: number
) {
  const available = await getMonthsWithData(userId, year);
  if (month && month >= 1 && month <= 12) return month;

  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : null;
  if (currentMonth && available.includes(currentMonth)) return currentMonth;

  const expenseMonths = await getMonthsWithExpenses(userId, year);
  if (expenseMonths.length > 0) return expenseMonths[expenseMonths.length - 1];

  if (available.length > 0) return available[available.length - 1];
  return currentMonth ?? 1;
}

async function sumByType(
  userId: string,
  year: number,
  month: number,
  type: TransactionType
) {
  const { start, end } = monthRangeUTC(year, month);
  const result = await prisma.transaction.aggregate({
    where: { userId, type, occurredAt: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  return decimalToNumber(result._sum.amount);
}

async function sumExpensesByBuildFlag(
  userId: string,
  year: number,
  month: number,
  isBuild: boolean
) {
  const { start, end } = monthRangeUTC(year, month);
  const buildCategory = await prisma.category.findFirst({
    where: { userId, name: BUILD_CATEGORY },
    select: { id: true },
  });

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: start, lte: end },
    },
    include: { category: true },
  });

  return txs
    .filter((t) => {
      const build =
        t.category?.name === BUILD_CATEGORY ||
        t.categoryId === buildCategory?.id;
      return isBuild ? build : !build;
    })
    .reduce((sum, t) => sum + decimalToNumber(t.amount), 0);
}

export async function getMonthlyOverview(
  userId: string,
  year: number,
  month: number
) {
  const { start, end } = monthRangeUTC(year, month);

  const [transactions, salarySlips, savingsPlans, savingsEntriesPaid, assetEntries] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: start, lte: end } },
        include: { category: true, payee: true, project: true },
        orderBy: { occurredAt: "desc" },
      }),
      prisma.salarySlip.findMany({
        where: { userId, periodYear: year, periodMonth: month },
        include: { employer: true },
      }),
      prisma.savingsPlan.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.savingsEntry.findMany({
        where: {
          plan: { userId },
          periodYear: year,
          periodMonth: month,
          paid: true,
        },
        select: { planId: true, amount: true },
      }),
      prisma.savingsAssetEntry.findMany({
        where: {
          asset: { userId },
          purchasedAt: { gte: start, lte: end },
        },
        select: { valueIls: true },
      }),
    ]);

  const incomeSources = buildIncomeSources(transactions, salarySlips);

  const savingsIncomeExcluded = transactions
    .filter((t) => t.type === TransactionType.INCOME && isSavingsRelatedIncome(t))
    .reduce((sum, t) => sum + decimalToNumber(t.amount), 0);

  const totalIncome = incomeSources.reduce((sum, s) => sum + s.amount, 0);
  const salaryAmount = incomeSources
    .filter((s) => s.isSalary)
    .reduce((sum, s) => sum + s.amount, 0);

  const [dailyExpenses, buildExpenses] = await Promise.all([
      sumExpensesByBuildFlag(userId, year, month, false),
      sumExpensesByBuildFlag(userId, year, month, true),
    ]);

  const categoryMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== TransactionType.EXPENSE) continue;
    const name = t.category?.name ?? "أخرى";
    categoryMap.set(name, (categoryMap.get(name) ?? 0) + decimalToNumber(t.amount));
  }

  const expenseByCategory = [...categoryMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = dailyExpenses + buildExpenses;

  const savingsFromEntries = savingsEntriesPaid.reduce(
    (sum, e) => sum + decimalToNumber(e.amount),
    0
  );
  const paidPlanIds = new Set(savingsEntriesPaid.map((e) => e.planId));
  const savingsPlanned = savingsPlans
    .filter(
      (plan) =>
        planAppliesInMonth(plan, year, month) && !paidPlanIds.has(plan.id)
    )
    .reduce((sum, plan) => sum + decimalToNumber(plan.monthlyContribution), 0);
  const jamiyaFromTransactions = transactions
    .filter(
      (t) =>
        t.type === TransactionType.SAVINGS_CONTRIBUTION &&
        !isAssetPurchaseDescription(t.description)
    )
    .reduce((sum, t) => sum + decimalToNumber(t.amount), 0);
  const savingsContributionsActual =
    savingsFromEntries > 0 ? savingsFromEntries : jamiyaFromTransactions;
  const savingsPaidThisMonth = savingsContributionsActual;
  const assetPurchasesThisMonth = assetEntries.reduce(
    (sum, e) => sum + decimalToNumber(e.valueIls),
    0
  );
  const savingsOutflow = savingsPaidThisMonth + assetPurchasesThisMonth;
  const savingsTotal = savingsOutflow + savingsPlanned;

  const undertracked = isUndertrackedExpenseMonth(year, month);
  const expenseAdjust = undertracked
    ? adjustUndertrackedExpenses(totalIncome, totalExpenses)
    : {
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        adjusted: false,
      };

  const net = expenseAdjust.net - savingsOutflow;
  const netAfterSavings = net - savingsPlanned;
  const hasIncomeNoExpenses = totalIncome > 0 && totalExpenses === 0;

  const primarySlip = salarySlips[0];

  return {
    year,
    month,
    monthLabel: monthLabel(month),
    hasIncomeNoExpenses,
    income: {
      sources: incomeSources,
      total: totalIncome,
      grossTotal: totalIncome,
      salary: salaryAmount,
      savingsExcluded: savingsIncomeExcluded,
      savingsDeducted: savingsPaidThisMonth,
    },
    expenses: {
      daily: dailyExpenses,
      build: buildExpenses,
      total: totalExpenses,
      effective: expenseAdjust.expenses,
      adjusted: expenseAdjust.adjusted,
      byCategory: expenseByCategory,
    },
    savings: {
      contributions: savingsPaidThisMonth,
      assetsPurchased: assetPurchasesThisMonth,
      outflow: savingsOutflow,
      paid: savingsPaidThisMonth,
      planned: savingsPlanned,
      total: savingsTotal,
      plans: savingsPlans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        type: plan.type,
        monthlyContribution: decimalToNumber(plan.monthlyContribution),
        targetAmount: plan.targetAmount
          ? decimalToNumber(plan.targetAmount)
          : null,
        startDate: plan.startDate?.toISOString().slice(0, 10) ?? null,
        payoutDate: plan.payoutDate?.toISOString().slice(0, 10) ?? null,
        status: plan.status,
      })),
    },
    net,
    netAfterSavings,
    undertracked,
    salarySlip: primarySlip
      ? {
          gross: decimalToNumber(primarySlip.gross),
          net: decimalToNumber(primarySlip.net),
          tax: decimalToNumber(primarySlip.tax),
          pension: decimalToNumber(primarySlip.pension),
          kerenHishtalmut: decimalToNumber(primarySlip.kerenHishtalmut),
        }
      : null,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: decimalToNumber(t.amount),
      occurredAt: t.occurredAt.toISOString().slice(0, 10),
      description: t.description,
      categoryName: t.category?.name ?? "—",
      payeeName: t.payee?.name ?? null,
    })),
  };
}

export async function getYearlyTrend(userId: string, year: number) {
  const through = reportThroughMonth(year);
  if (through === 0) return [];

  const months = await Promise.all(
    Array.from({ length: through }, (_, i) =>
      getMonthlyOverview(userId, year, i + 1)
    )
  );

  return months.map((m) => ({
    month: m.month,
    label: m.monthLabel,
    income: m.income.total,
    expenses: m.expenses.effective,
    expensesRaw: m.expenses.total,
    expensesAdjusted: m.expenses.adjusted,
    savings: m.savings.total,
    net: m.net,
    netAfterSavings: m.netAfterSavings,
    salary: m.income.salary,
  }));
}

function buildAnnualInsights(params: {
  year: number;
  totals: {
    income: number;
    expenses: number;
    net: number;
    build: number;
    savings: number;
  };
  activeMonthsCount: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  bestNetMonth: { label: string; net: number } | null;
  worstNetMonth: { label: string; net: number } | null;
  highestExpenseMonth: { label: string; expenses: number } | null;
  topExpenseCategory: { name: string; amount: number } | null;
  topIncomeSource: { name: string; amount: number } | null;
  building: {
    master: { percentComplete: number; remaining: number; paidToDate: number };
    contractors: unknown[];
    upcomingInstallments: unknown[];
  } | null;
}): { type: "positive" | "neutral" | "warning"; text: string }[] {
  const insights: { type: "positive" | "neutral" | "warning"; text: string }[] =
    [];

  insights.push({
    type: "neutral",
    text: `ملخّص ${params.year}: دخل سنوي ${formatInsightAmount(params.totals.income)} مقابل مصروفات ${formatInsightAmount(params.totals.expenses)} — صافي ${formatInsightAmount(params.totals.net)}.`,
  });

  if (params.totals.net >= 0) {
    insights.push({
      type: "positive",
      text: `السنة انتهت بفائض إيجابي قدره ${formatInsightAmount(params.totals.net)}.`,
    });
  } else {
    insights.push({
      type: "warning",
      text: `السنة انتهت بعجز قدره ${formatInsightAmount(Math.abs(params.totals.net))} — المصروفات تجاوزت الدخل.`,
    });
  }

  if (params.activeMonthsCount > 0) {
    insights.push({
      type: "neutral",
      text: `${params.activeMonthsCount} أشهر فيها نشاط مالي — متوسط الدخل الشهري ${formatInsightAmount(params.avgMonthlyIncome)} ومتوسط المصروفات ${formatInsightAmount(params.avgMonthlyExpenses)}.`,
    });
  }

  if (params.bestNetMonth) {
    insights.push({
      type: "positive",
      text: `أفضل شهر: ${params.bestNetMonth.label} بصافي ${formatInsightAmount(params.bestNetMonth.net)}.`,
    });
  }

  if (params.worstNetMonth && params.worstNetMonth.net < 0) {
    insights.push({
      type: "warning",
      text: `أصعب شهر: ${params.worstNetMonth.label} بعجز ${formatInsightAmount(Math.abs(params.worstNetMonth.net))}.`,
    });
  }

  if (params.highestExpenseMonth && params.highestExpenseMonth.expenses > 0) {
    insights.push({
      type: "neutral",
      text: `أعلى إنفاق: ${params.highestExpenseMonth.label} (${formatInsightAmount(params.highestExpenseMonth.expenses)}).`,
    });
  }

  if (params.topIncomeSource) {
    insights.push({
      type: "positive",
      text: `أكبر مصدر دخل: ${params.topIncomeSource.name} — ${formatInsightAmount(params.topIncomeSource.amount)} (${Math.round((params.topIncomeSource.amount / params.totals.income) * 100) || 0}% من الدخل).`,
    });
  }

  if (params.topExpenseCategory) {
    insights.push({
      type: "neutral",
      text: `أكبر بند مصروف: ${params.topExpenseCategory.name} — ${formatInsightAmount(params.topExpenseCategory.amount)}.`,
    });
  }

  if (params.totals.build > 0) {
    insights.push({
      type: "neutral",
      text: `مصروفات البناء السنوية: ${formatInsightAmount(params.totals.build)} (${Math.round((params.totals.build / params.totals.expenses) * 100) || 0}% من إجمالي المصروفات).`,
    });
  }

  if (params.totals.savings > 0) {
    insights.push({
      type: "positive",
      text: `ادّخرت ${formatInsightAmount(params.totals.savings)} خلال السنة عبر خطط الادخار والجمعية.`,
    });
  }

  if (params.building) {
    insights.push({
      type: "neutral",
      text: `مشروع البناء: ${params.building.master.percentComplete}% مكتمل — مدفوع ${formatInsightAmount(params.building.master.paidToDate)} ومتبقي ${formatInsightAmount(params.building.master.remaining)} (${params.building.contractors.length} مقاول، ${params.building.upcomingInstallments.length} دفعة قادمة).`,
    });
  }

  return insights;
}

function formatInsightAmount(n: number) {
  return new Intl.NumberFormat("ar-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function getAnnualShowcaseData(userId: string, year: number) {
  const [months, masterBuild, savingsPlans, salarySlips, savingsSummary] =
    await Promise.all([
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        getMonthlyOverview(userId, year, i + 1)
      )
    ),
    prisma.project.findFirst({
      where: { userId, kind: ProjectKind.MASTER_BUILD },
      select: { id: true },
    }),
    listSavings(userId),
    listSalary(userId),
    getSavingsSummary(userId),
  ]);

  const throughMonth = reportThroughMonth(year);
  const monthlyAll = months.map((m) => ({
    month: m.month,
    label: m.monthLabel,
    income: m.income.total,
    salary: m.income.salary,
    expenses: m.expenses.effective,
    expensesRaw: m.expenses.total,
    expensesAdjusted: m.expenses.adjusted,
    undertracked: m.undertracked,
    daily: m.expenses.daily,
    build: m.expenses.build,
    savings: m.savings.outflow,
    savingsContributions: m.savings.contributions,
    savingsAssetsPurchased: m.savings.assetsPurchased,
    savingsPlanned: m.savings.planned,
    savingsTotalWithPlanned: m.savings.total,
    net: m.net,
    netAfterSavings: m.netAfterSavings,
    hasActivity:
      m.income.total > 0 ||
      m.expenses.total > 0 ||
      m.savings.total > 0,
  }));

  const monthly = monthlyAll.filter((m) => m.month <= throughMonth);

  const totals = {
    income: monthly.reduce((s, m) => s + m.income, 0),
    salary: monthly.reduce((s, m) => s + m.salary, 0),
    expenses: monthly.reduce((s, m) => s + m.expenses, 0),
    daily: monthly.reduce((s, m) => s + m.daily, 0),
    build: monthly.reduce((s, m) => s + m.build, 0),
    savings: monthly.reduce((s, m) => s + m.savings, 0),
    net: monthly.reduce((s, m) => s + m.net, 0),
    netAfterSavings: monthly.reduce((s, m) => s + m.netAfterSavings, 0),
  };

  const yearForecast = buildYearForecast({
    year,
    throughMonth,
    monthly: monthly.map((m) => ({
      month: m.month,
      income: m.income,
      expenses: m.expenses,
      savings: m.savings,
      net: m.netAfterSavings,
      expensesAdjusted: m.expensesAdjusted,
    })),
  });

  const incomeSourceMap = new Map<string, IncomeSourceRow>();
  for (const m of months) {
    for (const s of m.income.sources) {
      const existing = incomeSourceMap.get(s.id);
      if (existing) {
        existing.amount += s.amount;
      } else {
        incomeSourceMap.set(s.id, { ...s });
      }
    }
  }
  const incomeBySource = [...incomeSourceMap.values()]
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const categoryMap = new Map<string, number>();
  for (const m of months) {
    for (const c of m.expenses.byCategory) {
      categoryMap.set(c.name, (categoryMap.get(c.name) ?? 0) + c.amount);
    }
  }
  const expensesByCategory = [...categoryMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const activeMonths = monthly.filter((m) => m.hasActivity);
  const avgMonthlyIncome = activeMonths.length
    ? totals.income / activeMonths.length
    : 0;
  const avgMonthlyExpenses = activeMonths.length
    ? totals.expenses / activeMonths.length
    : 0;

  const bestNetMonth =
    [...monthly].filter((m) => m.hasActivity).sort((a, b) => b.net - a.net)[0] ??
    null;
  const worstNetMonth =
    [...monthly].filter((m) => m.hasActivity).sort((a, b) => a.net - b.net)[0] ??
    null;
  const highestExpenseMonth =
    [...monthly].sort((a, b) => b.expenses - a.expenses)[0] ?? null;

  const building = masterBuild
    ? await getBuildingProjectSummary(userId, masterBuild.id)
    : null;

  const yearSalarySlips = salarySlips.filter(
    (s) => s.periodYear === year && s.paid && s.worked
  );
  const salaryAnnual = {
    gross: yearSalarySlips.reduce(
      (s, x) => s + decimalToNumber(x.gross),
      0
    ),
    net: yearSalarySlips.reduce((s, x) => s + decimalToNumber(x.net), 0),
    tax: yearSalarySlips.reduce((s, x) => s + decimalToNumber(x.tax), 0),
    pension: yearSalarySlips.reduce(
      (s, x) => s + decimalToNumber(x.pension),
      0
    ),
    monthsWithSlips: yearSalarySlips.length,
  };

  const insights = buildAnnualInsights({
    year,
    totals,
    activeMonthsCount: activeMonths.length,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    bestNetMonth,
    worstNetMonth,
    highestExpenseMonth,
    topExpenseCategory: expensesByCategory[0] ?? null,
    topIncomeSource: incomeBySource[0] ?? null,
    building,
  });

  return {
    year,
    throughMonth,
    totals,
    monthly,
    yearForecast,
    incomeBySource,
    expensesByCategory,
    averages: {
      income: avgMonthlyIncome,
      expenses: avgMonthlyExpenses,
    },
    highlights: {
      bestNetMonth,
      worstNetMonth,
      highestExpenseMonth,
    },
    building: building
      ? {
          id: building.master.id,
          title: building.master.title,
          totalBudget: building.master.totalBudget,
          paidToDate: building.master.paidToDate,
          remaining: building.master.remaining,
          percentComplete: building.master.percentComplete,
          contractorsCount: building.contractors.length,
          pendingInstallments: building.upcomingInstallments.length,
          contractors: building.contractors.slice(0, 6).map((c) => ({
            id: c.id,
            title: c.title,
            paid: c.paid,
            totalBudget: c.totalBudget,
            remaining: c.remaining,
          })),
        }
      : null,
    savingsPlans: savingsPlans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      type: plan.type,
      monthlyContribution: decimalToNumber(plan.monthlyContribution),
      targetAmount: plan.targetAmount
        ? decimalToNumber(plan.targetAmount)
        : null,
      status: plan.status,
      annualContribution:
        decimalToNumber(plan.monthlyContribution) * throughMonth,
    })),
    salaryAnnual,
    insights,
    buildingProjectId: masterBuild?.id ?? null,
    activeMonthsCount: activeMonths.length,
    portfolio: {
      jamiyaPaidTotal: savingsSummary.summary.jamiyaPaidTotal,
      goldTotal: savingsSummary.summary.goldTotal,
      usdTotal: savingsSummary.summary.usdTotal,
      assetsTotal: savingsSummary.summary.assetsTotal,
      accumulatedTotal: savingsSummary.summary.accumulatedTotal,
    },
  };
}

export async function getDashboardData(
  userId: string,
  year: number,
  month?: number
) {
  const resolvedMonth = await resolveDashboardMonth(userId, year, month);
  const [overview, trend, availableMonths, expenseMonths, masterBuild] =
    await Promise.all([
    getMonthlyOverview(userId, year, resolvedMonth),
    getYearlyTrend(userId, year),
    getMonthsWithData(userId, year),
    getMonthsWithExpenses(userId, year),
    prisma.project.findFirst({
      where: { userId, kind: ProjectKind.MASTER_BUILD },
      select: { id: true },
    }),
  ]);

  return {
    overview,
    trend,
    availableMonths,
    expenseMonths,
    buildingProjectId: masterBuild?.id ?? null,
    year,
    month: resolvedMonth,
  };
}

export async function getBuildingProjectSummary(
  userId: string,
  masterProjectId: string
) {
  const master = await prisma.project.findFirst({
    where: { id: masterProjectId, userId, kind: ProjectKind.MASTER_BUILD },
    include: {
      children: {
        include: {
          transactions: { where: { type: TransactionType.EXPENSE } },
          paymentPlans: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { installments: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      transactions: { where: { type: TransactionType.EXPENSE } },
    },
  });

  if (!master) return null;

  const totalBudget = decimalToNumber(master.totalBudget);
  const childIds = master.children.map((c) => c.id);
  const allProjectIds = [master.id, ...childIds];

  const paidAgg = await prisma.transaction.aggregate({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      projectId: { in: allProjectIds },
    },
    _sum: { amount: true },
  });
  const paidToDate = decimalToNumber(paidAgg._sum.amount);
  const remaining = Math.max(0, totalBudget - paidToDate);
  const percentComplete =
    totalBudget > 0 ? Math.round((paidToDate / totalBudget) * 100) : 0;

  const contractors = master.children.map((child) => {
    const activePlan = child.paymentPlans[0];
    const planTotal = activePlan
      ? decimalToNumber(activePlan.totalAmount)
      : 0;
    const totalBudget = contractorBudgetTotal(
      decimalToNumber(child.totalBudget),
      planTotal
    );
    const childPaid =
      activePlan && activePlan.installments.length > 0
        ? sumPaidInstallments(activePlan.installments)
        : child.transactions.reduce(
            (sum, t) => sum + decimalToNumber(t.amount),
            0
          );
    const pendingInstallments =
      activePlan?.installments.filter((i) => i.status === "PENDING") ?? [];
    const remaining = Math.max(0, totalBudget - childPaid);
    return {
      id: child.id,
      title: child.title,
      profession: child.profession,
      status: child.status,
      targetDate: child.targetDate?.toISOString().slice(0, 10) ?? null,
      totalBudget,
      paid: childPaid,
      remaining,
      pendingCount: pendingInstallments.length,
      paymentPlan: activePlan
        ? {
            id: activePlan.id,
            mode: activePlan.mode,
            totalAmount: planTotal,
            installmentCount: activePlan.installmentCount,
            firstPaymentAmount: activePlan.firstPaymentAmount
              ? decimalToNumber(activePlan.firstPaymentAmount)
              : null,
            recurringAmount: activePlan.recurringAmount
              ? decimalToNumber(activePlan.recurringAmount)
              : null,
            payeeName: activePlan.payeeName,
            startDate:
              activePlan.startDate?.toISOString().slice(0, 10) ?? null,
            paymentMethodId: activePlan.paymentMethodId,
          }
        : null,
    };
  });

  const upcomingInstallments = master.children
    .filter(
      (child) =>
        child.status === "ACTIVE" || child.status === "ON_HOLD"
    )
    .flatMap((child) => {
      const plan = child.paymentPlans[0];
      if (!plan) return [];
      return plan.installments
        .filter((i) => i.status === "PENDING")
        .map((inst) => ({
          id: inst.id,
          contractorId: child.id,
          contractorName: child.title,
          profession: child.profession,
          sequence: inst.sequence,
          label: inst.label ?? `الدفعة ${inst.sequence}`,
          dueDate: inst.dueDate.toISOString().slice(0, 10),
          amount: decimalToNumber(inst.amount),
        }));
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    master: {
      id: master.id,
      title: master.title,
      totalBudget,
      paidToDate,
      remaining,
      percentComplete,
      imageUrl: master.imageUrl,
    },
    contractors,
    upcomingInstallments,
    chart: {
      paid: paidToDate,
      remaining,
    },
  };
}

export async function getProjectDetail(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
      kind: { not: ProjectKind.MASTER_BUILD },
    },
    include: {
      parent: { select: { id: true, title: true } },
      transactions: {
        orderBy: { occurredAt: "desc" },
        include: { paymentMethod: true, category: true },
      },
      paymentPlans: {
        include: {
          paymentMethod: true,
          installments: {
            orderBy: { sequence: "asc" },
            include: { transaction: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  for (const plan of project.paymentPlans) {
    if (
      plan.installments.some(
        (i) => i.status === InstallmentStatus.PAID && !i.transactionId
      )
    ) {
      await repairPaidInstallmentTransactions(userId, {
        id: plan.id,
        projectId: plan.projectId,
        payeeName: plan.payeeName,
        paymentMethodId: plan.paymentMethodId,
        project: { title: project.title },
        installments: plan.installments,
      });
    }
  }

  const plansWithInstallments = project.paymentPlans.map((plan) => ({
    id: plan.id,
    title: plan.title ?? null,
    mode: plan.mode,
    totalAmount: decimalToNumber(plan.totalAmount),
    installmentCount: plan.installmentCount,
    firstPaymentAmount: plan.firstPaymentAmount
      ? decimalToNumber(plan.firstPaymentAmount)
      : null,
    recurringAmount: plan.recurringAmount
      ? decimalToNumber(plan.recurringAmount)
      : null,
    payeeName: plan.payeeName ?? null,
    startDate: plan.startDate?.toISOString().slice(0, 10) ?? null,
    paymentMethod: plan.paymentMethod?.name ?? null,
    paymentMethodId: plan.paymentMethodId ?? null,
    installments: plan.installments.map((inst) => ({
      id: inst.id,
      planId: plan.id,
      sequence: inst.sequence,
      label: inst.label ?? `الدفعة ${inst.sequence}`,
      dueDate: inst.dueDate.toISOString().slice(0, 10),
      amount: decimalToNumber(inst.amount),
      status: inst.status,
      notes: inst.notes,
      payeeName: plan.payeeName ?? null,
      paymentMethod: plan.paymentMethod?.name ?? null,
      paidAt: inst.transaction?.occurredAt.toISOString().slice(0, 10) ?? null,
      transactionId: inst.transactionId,
    })),
  }));

  const allInstallments = plansWithInstallments.flatMap((p) => p.installments);
  const hasPlanInstallments = allInstallments.length > 0;

  const planBudgetTotal = plansWithInstallments.reduce(
    (sum, p) => sum + p.totalAmount,
    0
  );
  const totalBudget =
    planBudgetTotal > 0
      ? planBudgetTotal
      : decimalToNumber(project.totalBudget);

  const paidFromPlans = project.paymentPlans.reduce(
    (sum, plan) => sum + sumPaidInstallments(plan.installments),
    0
  );
  const paid = hasPlanInstallments
    ? paidFromPlans
    : project.transactions.reduce(
        (sum, t) => sum + decimalToNumber(t.amount),
        0
      );

  const installments = allInstallments;

  return {
    id: project.id,
    kind: project.kind,
    title: project.title,
    profession: project.profession,
    description: project.description,
    status: project.status,
    targetDate: project.targetDate?.toISOString().slice(0, 10) ?? null,
    totalBudget,
    paid,
    remaining: Math.max(0, totalBudget - paid),
    percentComplete:
      totalBudget > 0 ? Math.round((paid / totalBudget) * 100) : 0,
    parent: project.parent,
    installments,
    transactions: (() => {
      const txToInstallment = new Map<string, string>();
      for (const plan of project.paymentPlans) {
        for (const inst of plan.installments) {
          if (inst.transactionId) {
            txToInstallment.set(inst.transactionId, inst.id);
          }
        }
      }
      return project.transactions.map((tx) => ({
        id: tx.id,
        amount: decimalToNumber(tx.amount),
        occurredAt: tx.occurredAt.toISOString().slice(0, 10),
        description: tx.description,
        notes: tx.notes,
        paymentMethod: tx.paymentMethod?.name ?? null,
        installmentId: txToInstallment.get(tx.id) ?? null,
      }));
    })(),
    paymentPlans: plansWithInstallments.map(
      ({ installments: _i, ...plan }) => plan
    ),
    plans: plansWithInstallments,
  };
}

export async function getSubscriptionsMonthly(
  userId: string,
  year: number,
  month: number
) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true },
    orderBy: { title: "asc" },
    include: {
      payments: {
        where: { periodYear: year, periodMonth: month },
      },
      monthSkips: {
        where: { periodYear: year, periodMonth: month },
      },
      category: true,
      paymentMethod: true,
    },
  });

  const visible = subscriptions.filter((sub) => sub.monthSkips.length === 0);

  const items = visible.map((sub) => {
    const payment = sub.payments[0] ?? null;
    return {
      id: sub.id,
      title: sub.title,
      amount: decimalToNumber(sub.amount),
      billingDay: sub.billingDay,
      categoryName: sub.category?.name ?? "اشتراكات",
      paymentMethodName: sub.paymentMethod?.name ?? null,
      notes: sub.notes,
      isDefault: sub.isDefault,
      paid: payment?.paid ?? false,
      paidAt: payment?.paidAt?.toISOString().slice(0, 10) ?? null,
      paymentId: payment?.id ?? null,
      transactionId: payment?.transactionId ?? null,
    };
  });

  const totalDue = items.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = items
    .filter((i) => i.paid)
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    year,
    month,
    monthLabel: monthLabel(month),
    items,
    totalDue,
    totalPaid,
    totalRemaining: totalDue - totalPaid,
    paidCount: items.filter((i) => i.paid).length,
    totalCount: items.length,
  };
}

export async function getEmployerKupot(userId: string) {
  const employers = await prisma.employer.findMany({
    where: { userId, active: true },
    include: {
      salarySlips: {
        where: { worked: true, paid: true, periodYear: { gte: 2026 } },
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      },
      savingsPlans: {
        where: { type: "KUPOT", status: "ACTIVE" },
      },
    },
    orderBy: { name: "asc" },
  });

  return employers.map((emp) => {
    const slipAmounts = emp.salarySlips.map((s) => kupotAmountsFromSlip(s));
    const totals = sumKupotAmounts(slipAmounts);
    const latest = emp.salarySlips[emp.salarySlips.length - 1];
    const latestAmounts = latest ? kupotAmountsFromSlip(latest) : null;
    const monthlyHistory = emp.salarySlips
      .filter((s) => kupotAmountsFromSlip(s).total > 0)
      .map((s) => {
        const amounts = kupotAmountsFromSlip(s);
        return {
          year: s.periodYear,
          month: s.periodMonth,
          label: `${monthLabel(s.periodMonth)} ${s.periodYear}`,
          pension: amounts.pensionEmployee,
          keren: amounts.kerenEmployee,
          pensionEmployer: amounts.pensionEmployer,
          kerenEmployer: amounts.kerenEmployer,
          employeeTotal: amounts.employeeTotal,
          employerTotal: amounts.employerTotal,
          total: amounts.total,
          paid: s.paid,
          paidAt: s.paidAt?.toISOString().slice(0, 10) ?? null,
          breakdown: (s.slipBreakdown as SalarySlipBreakdown | null) ?? null,
        };
      });

    return {
      id: emp.id,
      name: emp.name,
      color: emp.color,
      pensionTotal: totals.pensionEmployee + totals.pensionEmployer,
      kerenTotal: totals.kerenEmployee + totals.kerenEmployer,
      employeeTotal: totals.employeeTotal,
      employerTotal: totals.employerTotal,
      kupotTotal: totals.total,
      latestMonth: latest
        ? { year: latest.periodYear, month: latest.periodMonth }
        : null,
      latestPension: latestAmounts?.pensionEmployee ?? 0,
      latestKeren: latestAmounts?.kerenEmployee ?? 0,
      latestEmployerTotal: latestAmounts?.employerTotal ?? 0,
      monthlyHistory,
      plans: emp.savingsPlans.map((p) => ({
        id: p.id,
        title: p.title,
        monthlyContribution: decimalToNumber(p.monthlyContribution),
      })),
    };
  });
}

export async function getKupotPageData(userId: string) {
  const employers = await getEmployerKupot(userId);
  const active = employers.filter((e) => e.kupotTotal > 0);
  const employeeGrand = active.reduce((s, e) => s + e.employeeTotal, 0);
  const employerGrand = active.reduce((s, e) => s + e.employerTotal, 0);
  const kupotGrand = active.reduce((s, e) => s + e.kupotTotal, 0);
  return {
    summary: {
      pensionTotal: active.reduce((s, e) => s + e.pensionTotal, 0),
      kerenTotal: active.reduce((s, e) => s + e.kerenTotal, 0),
      employeeTotal: employeeGrand,
      employerTotal: employerGrand,
      kupotTotal: kupotGrand,
      employerCount: active.length,
    },
    employers: active,
  };
}

export async function getLookups(userId: string) {
  const [categories, paymentMethods, payees, projects] = await Promise.all([
    prisma.category.findMany({
      where: { userId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.payee.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: {
        userId,
        kind: { in: [ProjectKind.MASTER_BUILD, ProjectKind.GENERAL] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { categories, paymentMethods, payees, projects };
}

/**
 * Lookups for the day-to-day Quick Add (coffee, groceries, ...).
 * Excludes the building category so daily spending stays separate from build.
 */
export async function getQuickAddLookups(userId: string) {
  const [categories, paymentMethods] = await Promise.all([
    prisma.category.findMany({
      where: {
        userId,
        isActive: true,
        kind: { in: [CategoryKind.EXPENSE, CategoryKind.INCOME] },
        name: { not: BUILD_CATEGORY },
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.paymentMethod.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { categories, paymentMethods };
}

export async function listEmployers(userId: string) {
  return prisma.employer.findMany({
    where: { userId },
    include: {
      salarySlips: {
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        take: 12,
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getEmployerDetail(
  userId: string,
  employerId: string,
  year: number
) {
  const employer = await prisma.employer.findFirst({
    where: { id: employerId, userId },
    include: {
      salarySlips: {
        where: { periodYear: year },
        orderBy: { periodMonth: "asc" },
      },
    },
  });
  if (!employer) return null;

  const base = {
    gross: decimalToNumber(employer.baseGross),
    net: decimalToNumber(employer.baseNet),
    tax: decimalToNumber(employer.baseTax),
    pension: decimalToNumber(employer.basePension),
    keren: decimalToNumber(employer.baseKeren),
    fees: decimalToNumber(employer.baseFees),
    bonus: decimalToNumber(employer.baseBonus),
    slipBreakdown: (employer.baseSlipBreakdown as SalarySlipBreakdown | null) ?? null,
  };

  const slipByMonth = new Map(employer.salarySlips.map((s) => [s.periodMonth, s]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const slip = slipByMonth.get(month);
    if (!slip) {
      return {
        month,
        label: monthLabel(month),
        slipId: null as string | null,
        exists: false,
        worked: true,
        paid: false,
        paidAt: null as string | null,
        gross: 0,
        net: 0,
        tax: 0,
        pension: 0,
        kerenHishtalmut: 0,
        fees: 0,
        bonus: 0,
        effectiveNet: 0,
        notes: null as string | null,
        slipBreakdown: null as SalarySlipBreakdown | null,
      };
    }
    const net = decimalToNumber(slip.net);
    const fees = decimalToNumber(slip.fees);
    const bonus = decimalToNumber(slip.bonus);
    const breakdown = slip.slipBreakdown as SalarySlipBreakdown | null;
    return {
      month,
      label: monthLabel(month),
      slipId: slip.id as string | null,
      exists: true,
      worked: slip.worked,
      paid: slip.paid,
      paidAt: slip.paidAt?.toISOString().slice(0, 10) ?? null,
      gross: decimalToNumber(slip.gross),
      net,
      tax: decimalToNumber(slip.tax),
      pension: decimalToNumber(slip.pension),
      kerenHishtalmut: decimalToNumber(slip.kerenHishtalmut),
      fees,
      bonus,
      effectiveNet: slip.worked ? net + bonus - fees : 0,
      notes: slip.notes,
      slipBreakdown: breakdown,
    };
  });

  const countsInTotals = (m: (typeof months)[number]) =>
    m.worked && m.paid && m.exists;

  const totals = {
    gross: months.reduce((s, m) => (countsInTotals(m) ? s + m.gross : s), 0),
    net: months.reduce((s, m) => (countsInTotals(m) ? s + m.effectiveNet : s), 0),
    tax: months.reduce((s, m) => (countsInTotals(m) ? s + m.tax : s), 0),
    pension: months.reduce((s, m) => (countsInTotals(m) ? s + m.pension : s), 0),
    fees: months.reduce((s, m) => (countsInTotals(m) ? s + m.fees : s), 0),
    bonus: months.reduce((s, m) => (countsInTotals(m) ? s + m.bonus : s), 0),
    workedMonths: months.filter((m) => m.worked && m.exists).length,
    stoppedMonths: months.filter((m) => !m.worked && m.exists).length,
    paidMonths: months.filter((m) => m.paid && m.exists).length,
  };

  return {
    id: employer.id,
    name: employer.name,
    role: employer.role,
    color: employer.color,
    active: employer.active,
    startDate: employer.startDate?.toISOString().slice(0, 10) ?? null,
    base,
    year,
    months,
    totals,
  };
}

export async function getDashboardSummary(userId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const overview = await getMonthlyOverview(userId, year, month);
  const projects = await prisma.project.findMany({
    where: {
      userId,
      kind: { in: [ProjectKind.MASTER_BUILD, ProjectKind.GENERAL] },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    income: overview.income.total,
    expenses: overview.expenses.total,
    savings: overview.savings.contributions,
    balance: overview.net,
    activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
    projects,
    recentTransactions: overview.transactions.slice(0, 8),
  };
}

export async function listTransactions(params: {
  userId: string;
  page: number;
  pageSize: number;
  q?: string;
  year?: number;
  month?: number | null;
  type?: string;
  categoryId?: string;
  projectId?: string;
  paymentMethodId?: string;
}) {
  const skip = (params.page - 1) * params.pageSize;

  let dateFilter = {};
  if (params.year && params.month) {
    const { start, end } = monthRangeUTC(params.year, params.month);
    dateFilter = { occurredAt: { gte: start, lte: end } };
  } else if (params.year) {
    const { start, end } = yearRangeUTC(params.year);
    dateFilter = { occurredAt: { gte: start, lte: end } };
  }

  const where = {
    userId: params.userId,
    ...dateFilter,
    ...(params.type ? { type: params.type as TransactionType } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.paymentMethodId ? { paymentMethodId: params.paymentMethodId } : {}),
    ...(params.q
      ? {
          OR: [
            { description: { contains: params.q, mode: "insensitive" as const } },
            { notes: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        project: true,
        payee: true,
        paymentMethod: true,
        salarySlip: { include: { employer: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip,
      take: params.pageSize,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    }),
  ]);

  const summary = { income: 0, expense: 0, savings: 0, transfer: 0 };
  for (const g of grouped) {
    const amt = g._sum.amount ? decimalToNumber(g._sum.amount) : 0;
    if (g.type === TransactionType.INCOME) summary.income += amt;
    else if (g.type === TransactionType.EXPENSE) summary.expense += amt;
    else if (g.type === TransactionType.SAVINGS_CONTRIBUTION) summary.savings += amt;
    else summary.transfer += amt;
  }

  return {
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    summary,
  };
}

export async function listProjects(params: {
  userId: string;
  page: number;
  pageSize: number;
  q?: string;
}) {
  const skip = (params.page - 1) * params.pageSize;
  const where = {
    userId: params.userId,
    kind: { in: [ProjectKind.MASTER_BUILD, ProjectKind.GENERAL] },
    ...(params.q
      ? { title: { contains: params.q, mode: "insensitive" as const } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function listSavings(userId: string) {
  return prisma.savingsPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSavingsSummary(userId: string) {
  const marketRates = await getMarketRates(21).catch(() => null);
  const liveUsdIls = marketRates?.usdIls ?? null;

  const [plans, assets] = await Promise.all([
    prisma.savingsPlan.findMany({
      where: { userId, type: { not: "KUPOT" } },
      include: { entries: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.savingsAsset.findMany({
      where: { userId },
      include: {
        entries: { orderBy: { purchasedAt: "desc" } },
      },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  let jamiyaPaidTotal = 0;
  let committedTotal = 0;
  let monthlyThisMonth = 0;
  let activePlans = 0;

  const planProgress = plans.map((plan) => {
    const monthly = decimalToNumber(plan.monthlyContribution);
    const target = plan.targetAmount ? decimalToNumber(plan.targetAmount) : null;
    const paid = plan.entries
      .filter((e) => e.paid)
      .reduce((sum, e) => sum + decimalToNumber(e.amount), 0);

    jamiyaPaidTotal += paid;

    if (plan.status === "ACTIVE") {
      activePlans++;
      monthlyThisMonth += monthly;
      if (target) committedTotal += target;
    }

    const planTarget = target ?? 0;
    return {
      id: plan.id,
      title: plan.title,
      type: plan.type,
      status: plan.status,
      monthlyContribution: monthly,
      paid,
      target: planTarget,
      remaining: planTarget > 0 ? Math.max(0, planTarget - paid) : 0,
      progress:
        planTarget > 0 ? Math.min(100, Math.round((paid / planTarget) * 100)) : 0,
    };
  });

  const assetItems = assets.map((asset) => {
    const quantity = decimalToNumber(asset.quantity);
    const storedRate = decimalToNumber(asset.unitPrice);
    const isUsd = asset.kind === "USD";
    const unitPrice =
      isUsd && liveUsdIls != null ? liveUsdIls : storedRate;
    const valueIls = computeAssetValueIls(
      asset.kind,
      quantity,
      unitPrice,
      isUsd ? liveUsdIls : null
    );
    return {
      id: asset.id,
      kind: asset.kind as "GOLD" | "USD",
      title: asset.title,
      quantity,
      unitPrice,
      goldKarat: asset.goldKarat ?? 21,
      priceCurrency: asset.priceCurrency,
      valueIls,
      updatedAt: asset.updatedAt.toISOString().slice(0, 10),
      history: asset.entries.map((e) => {
        const entryQty = decimalToNumber(e.quantity);
        return {
          id: e.id,
          quantity: entryQty,
          unitPrice: isUsd && liveUsdIls != null ? liveUsdIls : decimalToNumber(e.unitPrice),
          valueIls: computeAssetValueIls(
            asset.kind,
            entryQty,
            decimalToNumber(e.unitPrice),
            isUsd ? liveUsdIls : null
          ),
          purchasedAt: e.purchasedAt.toISOString().slice(0, 10),
          notes: e.notes,
        };
      }),
    };
  });

  const goldTotal = assetItems
    .filter((a) => a.kind === "GOLD")
    .reduce((sum, a) => sum + a.valueIls, 0);
  const usdTotal = assetItems
    .filter((a) => a.kind === "USD")
    .reduce((sum, a) => sum + a.valueIls, 0);
  const assetsTotal = goldTotal + usdTotal;
  const accumulatedTotal = jamiyaPaidTotal + assetsTotal;
  const remainingToPay = Math.max(0, committedTotal - jamiyaPaidTotal);

  const portfolioChart = [
    ...(jamiyaPaidTotal > 0
      ? [{ name: "جمعيات (مدفوع)", value: jamiyaPaidTotal, fill: "#6366f1" }]
      : []),
    ...(goldTotal > 0 ? [{ name: "ذهب", value: goldTotal, fill: "#f59e0b" }] : []),
    ...(usdTotal > 0 ? [{ name: "دولار", value: usdTotal, fill: "#059669" }] : []),
  ];

  const commitmentChart = [
    ...(jamiyaPaidTotal > 0
      ? [{ name: "مدفوع", value: jamiyaPaidTotal, fill: "#6366f1" }]
      : []),
    ...(remainingToPay > 0
      ? [{ name: "متبقي", value: remainingToPay, fill: "#fca5a5" }]
      : []),
  ];

  return {
    summary: {
      monthlyThisMonth,
      accumulatedTotal,
      committedTotal,
      remainingToPay,
      activePlans,
      jamiyaPaidTotal,
      assetsTotal,
      goldTotal,
      usdTotal,
      kupotTotal: 0,
    },
    liveRates: marketRates
      ? {
          usdIls: marketRates.usdIls,
          usdIlsDate: marketRates.usdIlsDate,
          usdIlsSource: marketRates.usdIlsSource,
          fetchedAt: marketRates.fetchedAt,
        }
      : null,
    planProgress,
    assets: assetItems,
    kupot: [],
    charts: {
      portfolio: portfolioChart,
      commitment: commitmentChart,
      plans: planProgress.map((p) => ({
        name: p.title.length > 14 ? `${p.title.slice(0, 14)}…` : p.title,
        paid: p.paid,
        remaining: p.remaining,
      })),
    },
  };
}

export async function getSavingsPlanDetail(userId: string, planId: string) {
  const plan = await prisma.savingsPlan.findFirst({
    where: { id: planId, userId },
    include: { entries: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] } },
  });
  if (!plan) return null;

  const monthly = decimalToNumber(plan.monthlyContribution);
  const target = plan.targetAmount ? decimalToNumber(plan.targetAmount) : null;

  const start = plan.startDate ?? plan.createdAt;
  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth() + 1;
  const duration = plan.durationMonths ?? 12;

  const entryByKey = new Map(
    plan.entries.map((e) => [`${e.periodYear}-${e.periodMonth}`, e])
  );

  const payoutKey = plan.payoutDate
    ? `${plan.payoutDate.getUTCFullYear()}-${plan.payoutDate.getUTCMonth() + 1}`
    : null;

  const schedule = Array.from({ length: duration }, (_, i) => {
    const date = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const key = `${y}-${m}`;
    const entry = entryByKey.get(key);
    return {
      sequence: i + 1,
      periodYear: y,
      periodMonth: m,
      label: `${monthLabel(m)} ${y}`,
      amount: entry ? decimalToNumber(entry.amount) : monthly,
      paid: entry?.paid ?? false,
      isPayout: entry?.isPayout ?? payoutKey === key,
      paidAt: entry?.paid
        ? (() => {
            const expected = paidAtForPeriod(y, m).toISOString().slice(0, 10);
            if (!entry.paidAt) return expected;
            const py = entry.paidAt.getUTCFullYear();
            const pm = entry.paidAt.getUTCMonth() + 1;
            return py === y && pm === m
              ? entry.paidAt.toISOString().slice(0, 10)
              : expected;
          })()
        : null,
      notes: entry?.notes ?? null,
    };
  });

  const paidTotal = schedule
    .filter((s) => s.paid)
    .reduce((sum, s) => sum + s.amount, 0);
  const scheduledTotal = schedule.reduce((sum, s) => sum + s.amount, 0);
  const paidCount = schedule.filter((s) => s.paid).length;

  return {
    id: plan.id,
    title: plan.title,
    type: plan.type,
    status: plan.status,
    monthlyContribution: monthly,
    targetAmount: target,
    durationMonths: duration,
    startDate: plan.startDate?.toISOString().slice(0, 10) ?? null,
    payoutDate: plan.payoutDate?.toISOString().slice(0, 10) ?? null,
    notes: plan.notes,
    schedule,
    summary: {
      paidTotal,
      scheduledTotal,
      paidCount,
      totalMonths: schedule.length,
      progress:
        target && target > 0
          ? Math.min(100, Math.round((paidTotal / target) * 100))
          : scheduledTotal > 0
            ? Math.round((paidTotal / scheduledTotal) * 100)
            : 0,
    },
  };
}

export async function listSalary(userId: string, employerId?: string) {
  return prisma.salarySlip.findMany({
    where: { userId, ...(employerId ? { employerId } : {}) },
    include: { employer: true },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
}
