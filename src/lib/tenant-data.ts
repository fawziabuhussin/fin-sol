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
import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import {
  repairPaidInstallmentTransactions,
  sumPaidInstallments,
} from "@/lib/installment-transactions";
import { dedupePlanBuildingExpensesForUser } from "@/lib/plan-expense-dedupe";
import {
  CategoryKind,
  InstallmentStatus,
  ProjectKind,
  TransactionType,
} from "@/generated/prisma/client";

const BUILD_CATEGORY = "بناء";

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

  const [transactions, salarySlips, savingsPlans] =
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
    ]);

  const incomeSources = INCOME_SOURCES.map((source) => {
    const matching = transactions.filter(
      (t) =>
        t.type === TransactionType.INCOME &&
        !isSavingsRelatedIncome(t) &&
        (t.payee?.name === source.name || t.description === source.name)
    );
    const linked = matching.filter((t) => t.salarySlipId);
    const toSum = linked.length > 0 ? linked : matching;
    const amount = toSum.reduce((sum, t) => sum + decimalToNumber(t.amount), 0);
    return {
      id: source.id,
      name: source.name,
      color: source.color,
      isSalary: "isSalary" in source ? source.isSalary : false,
      amount,
    };
  });

  const savingsIncomeExcluded = transactions
    .filter((t) => t.type === TransactionType.INCOME && isSavingsRelatedIncome(t))
    .reduce((sum, t) => sum + decimalToNumber(t.amount), 0);

  const totalIncome = incomeSources.reduce((sum, s) => sum + s.amount, 0);
  const salaryFromSlips = salarySlips
    .filter((s) => s.paid && s.worked)
    .reduce((sum, s) => sum + decimalToNumber(s.net), 0);
  const salaryAmount =
    incomeSources.find((s) => s.isSalary)?.amount || salaryFromSlips;

  const [dailyExpenses, buildExpenses, savingsContributions] =
    await Promise.all([
      sumExpensesByBuildFlag(userId, year, month, false),
      sumExpensesByBuildFlag(userId, year, month, true),
      sumByType(userId, year, month, TransactionType.SAVINGS_CONTRIBUTION),
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

  const savingsPlanned = savingsPlans
    .filter((plan) => planAppliesInMonth(plan, year, month))
    .reduce((sum, plan) => sum + decimalToNumber(plan.monthlyContribution), 0);
  const savingsTotal = savingsContributions + savingsPlanned;

  const undertracked = isUndertrackedExpenseMonth(year, month);
  const expenseAdjust = undertracked
    ? adjustUndertrackedExpenses(totalIncome, totalExpenses)
    : { expenses: totalExpenses, net: totalIncome - totalExpenses, adjusted: false };

  const net = expenseAdjust.net;
  const netAfterSavings = net - savingsTotal;
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
      salary: salaryAmount,
      savingsExcluded: savingsIncomeExcluded,
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
      contributions: savingsContributions,
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
  const [months, masterBuild, savingsPlans, salarySlips] = await Promise.all([
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
    savings: m.savings.total,
    savingsContributions: m.savings.contributions,
    savingsPlanned: m.savings.planned,
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

  const incomeBySource = INCOME_SOURCES.map((src) => {
    const amount = months.reduce((sum, m) => {
      const s = m.income.sources.find((x) => x.id === src.id);
      return sum + (s?.amount ?? 0);
    }, 0);
    return {
      id: src.id,
      name: src.name,
      color: src.color,
      isSalary: "isSalary" in src ? src.isSalary : false,
      amount,
    };
  })
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
    const childPaid = child.transactions.reduce(
      (sum, t) => sum + decimalToNumber(t.amount),
      0
    );
    const activePlan = child.paymentPlans[0];
    const pendingInstallments =
      activePlan?.installments.filter((i) => i.status === "PENDING") ?? [];
    return {
      id: child.id,
      title: child.title,
      profession: child.profession,
      status: child.status,
      targetDate: child.targetDate?.toISOString().slice(0, 10) ?? null,
      totalBudget: decimalToNumber(child.totalBudget),
      paid: childPaid,
      remaining: Math.max(0, decimalToNumber(child.totalBudget) - childPaid),
      pendingCount: pendingInstallments.length,
    };
  });

  const upcomingInstallments = master.children
    .filter((child) => child.status !== "PLANNED" && child.status !== "CANCELLED")
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

  const dedupe = await dedupePlanBuildingExpensesForUser(userId, prisma, {
    projectId,
  });
  if (dedupe.deleted > 0) {
    return getProjectDetail(userId, projectId);
  }

  const activePlan = project.paymentPlans[0] ?? null;

  if (
    activePlan?.installments.some(
      (i) => i.status === InstallmentStatus.PAID && !i.transactionId
    )
  ) {
    await repairPaidInstallmentTransactions(userId, {
      id: activePlan.id,
      projectId: activePlan.projectId,
      payeeName: activePlan.payeeName,
      paymentMethodId: activePlan.paymentMethodId,
      project: { title: project.title },
      installments: activePlan.installments,
    });
    return getProjectDetail(userId, projectId);
  }

  const totalBudget = decimalToNumber(project.totalBudget);
  const paid =
    activePlan && activePlan.installments.length > 0
      ? sumPaidInstallments(activePlan.installments)
      : project.transactions.reduce(
          (sum, t) => sum + decimalToNumber(t.amount),
          0
        );

  const installments = (activePlan?.installments ?? []).map((inst) => ({
    id: inst.id,
    planId: activePlan!.id,
    sequence: inst.sequence,
    label: inst.label ?? `الدفعة ${inst.sequence}`,
    dueDate: inst.dueDate.toISOString().slice(0, 10),
    amount: decimalToNumber(inst.amount),
    status: inst.status,
    notes: inst.notes,
    payeeName: activePlan!.payeeName ?? null,
    paymentMethod: activePlan!.paymentMethod?.name ?? null,
    paidAt: inst.transaction?.occurredAt.toISOString().slice(0, 10) ?? null,
    transactionId: inst.transactionId,
  }));

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
      for (const inst of activePlan?.installments ?? []) {
        if (inst.transactionId) {
          txToInstallment.set(inst.transactionId, inst.id);
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
    paymentPlans: project.paymentPlans.map((plan) => ({
      id: plan.id,
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
    })),
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
  const [plans, assets] = await Promise.all([
    prisma.savingsPlan.findMany({
      where: { userId },
      include: { entries: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.savingsAsset.findMany({
      where: { userId },
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

  const assetItems = assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind as "GOLD" | "USD",
    title: asset.title,
    quantity: decimalToNumber(asset.quantity),
    unitPrice: decimalToNumber(asset.unitPrice),
    goldKarat: asset.goldKarat ?? 21,
    priceCurrency: asset.priceCurrency,
    valueIls: decimalToNumber(asset.valueIls),
    updatedAt: asset.updatedAt.toISOString().slice(0, 10),
  }));

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
    },
    planProgress,
    assets: assetItems,
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
      paidAt: entry?.paidAt?.toISOString().slice(0, 10) ?? null,
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
