import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import {
  InsightType,
  InsightSeverity,
  TransactionType,
  BuildContractorStatus,
  SavingsPlanStatus,
  type Prisma,
} from "@/generated/prisma/client";
import {
  addDays,
  addMonths,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";

type InsightInput = {
  householdId: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function generateInsights(householdId: string): Promise<number> {
  const now = new Date();
  const insights: InsightInput[] = [];

  const [contractors, savingsPlans, keren, recentTx, categories] =
    await Promise.all([
      prisma.buildContractor.findMany({
        where: {
          householdId,
          status: {
            in: [
              BuildContractorStatus.IN_PROGRESS,
              BuildContractorStatus.NOT_STARTED,
            ],
          },
        },
      }),
      prisma.savingsPlan.findMany({
        where: { householdId, status: SavingsPlanStatus.ACTIVE },
      }),
      prisma.kerenHishtalmutProfile.findUnique({ where: { householdId } }),
      prisma.transaction.findMany({
        where: {
          householdId,
          date: { gte: subMonths(now, 6) },
        },
        include: { category: true },
      }),
      prisma.category.findMany({ where: { householdId } }),
    ]);

  // Liquidity: installments due in 30 days vs 3-month avg net
  const dueIn30 = contractors.filter((c) => {
    if (!c.firstPaymentDueDate) return false;
    const days = differenceInDays(c.firstPaymentDueDate, now);
    return days >= 0 && days <= 30;
  });
  const dueAmount = dueIn30.reduce(
    (s, c) => s + decimalToNumber(c.installmentAmount ?? c.remainingBalance),
    0
  );

  const last3Net = computeRollingNet(
    recentTx.map((t) => ({
      type: t.type,
      amount: t.amount,
      date: t.date,
      isBuildExpense: t.isBuildExpense,
    })),
    3
  );
  if (dueAmount > 0 && dueAmount > last3Net * 0.4) {
    const names = dueIn30.map((c) => c.name).join("، ");
    insights.push({
      householdId,
      type: InsightType.LIQUIDITY_WARNING,
      severity: InsightSeverity.WARNING,
      title: "تحذير سيولة — دفعات البناء",
      body: `لديك دفعات مقاولين بقيمة ₪${Math.round(dueAmount).toLocaleString("he-IL")} خلال 30 يوماً (${names})، بينما متوسط صافي التدفق لآخر 3 أشهر منخفض. فكّر بتقليل مصروفات "طعام خارج" و"قهوة" مؤقتاً.`,
      actionLabel: "عرض حسابات البناء",
      actionHref: "/dashboard/build",
      metadata: { dueAmount, last3Net, contractors: dueIn30.map((c) => c.id) },
    });
  }

  // Investment: Jam'iya payout before next build phase
  for (const plan of savingsPlans) {
    const payout = plan.payoutDate;
    const daysToPayout = differenceInDays(payout, now);
    if (daysToPayout < 30 || daysToPayout > 365) continue;

    const nextBuild = contractors
      .filter((c) => decimalToNumber(c.remainingBalance) > 0)
      .sort(
        (a, b) =>
          (a.firstPaymentDueDate?.getTime() ?? Infinity) -
          (b.firstPaymentDueDate?.getTime() ?? Infinity)
      )[0];

    if (
      nextBuild?.firstPaymentDueDate &&
      differenceInDays(nextBuild.firstPaymentDueDate, payout) > 60
    ) {
      const payoutAmt = decimalToNumber(plan.totalCommitment);
      insights.push({
        householdId,
        type: InsightType.INVESTMENT_OPPORTUNITY,
        severity: InsightSeverity.INFO,
        title: "فرصة استثمار — فجوة نقدية",
        body: `دفعة ${plan.name} بقيمة ₪${Math.round(payoutAmt).toLocaleString("he-IL")} في ${payout.toLocaleDateString("ar")}، بينما المرحلة القادمة للبناء (${nextBuild.name}) أبعد. يُنصح بإيداع ₪${Math.round(payoutAmt * 0.75).toLocaleString("he-IL")} في פק"מ لـ 3 أشهر.`,
        actionLabel: "تفاصيل الادخار",
        actionHref: "/dashboard/savings",
        metadata: { planId: plan.id, payoutDate: payout },
      });
      break;
    }
  }

  // Budget anomaly: category vs 6-month average
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const currentExpenses = recentTx.filter(
    (t) =>
      t.type === TransactionType.EXPENSE &&
      !t.isBuildExpense &&
      t.date >= currentMonthStart &&
      t.date <= currentMonthEnd &&
      t.category
  );

  const byCategory = groupExpensesByCategory(currentExpenses);
  const historicalByCategory = groupExpensesByCategory(
    recentTx.filter(
      (t) =>
        t.type === TransactionType.EXPENSE &&
        !t.isBuildExpense &&
        t.date < currentMonthStart &&
        t.category
    )
  );

  const monthsOfHistory = 5;
  const anomalies: string[] = [];
  for (const [cat, amount] of Object.entries(byCategory)) {
    const hist = historicalByCategory[cat] ?? 0;
    const avg = hist / monthsOfHistory;
    if (avg > 0 && amount > avg * 1.15) {
      const pct = Math.round(((amount - avg) / avg) * 100);
      if (pct >= 15) anomalies.push(`${cat} (+${pct}%)`);
    }
  }

  if (anomalies.length > 0) {
    const totalDaily = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const totalHist =
      Object.values(historicalByCategory).reduce((a, b) => a + b, 0) /
      monthsOfHistory;
    const overallPct =
      totalHist > 0
        ? Math.round(((totalDaily - totalHist) / totalHist) * 100)
        : 0;

    insights.push({
      householdId,
      type: InsightType.BUDGET_ANOMALY,
      severity:
        overallPct >= 25 ? InsightSeverity.WARNING : InsightSeverity.INFO,
      title: "انحراف في المصروفات اليومية",
      body: `مصروفاتك اليومية أعلى بـ ${overallPct}% من متوسط 6 أشهر، وخصوصاً: ${anomalies.slice(0, 3).join(" و")}.`,
      actionLabel: "تحليل الفئات",
      actionHref: "/dashboard",
      metadata: { anomalies, overallPct },
    });
  }

  // Keren Hishtalmut
  if (keren) {
    const balance = decimalToNumber(keren.currentBalance);
    if (keren.vestingEligibleDate && keren.vestingEligibleDate <= addDays(now, 90)) {
      insights.push({
        householdId,
        type: InsightType.TAX_SALARY_OPTIMIZATION,
        severity: InsightSeverity.INFO,
        title: "קרן השתלמות — قرب الأهلية",
        body: `رصيد קרן השתלמות ₪${Math.round(balance).toLocaleString("he-IL")} يقترب من تاريخ السيولة المعفاة (${keren.vestingEligibleDate.toLocaleDateString("ar")}). راجع خيارات السحب الضريبي.`,
        actionLabel: "תלוש משכורת",
        actionHref: "/dashboard/salary",
      });
    } else if (balance >= 50000) {
      insights.push({
        householdId,
        type: InsightType.TAX_SALARY_OPTIMIZATION,
        severity: InsightSeverity.INFO,
        title: "تتبع קרן השתלמות",
        body: `الرصيد المتراكم ₪${Math.round(balance).toLocaleString("he-IL")}. حدّث تاريخ الأهلية في الإعدادات لتفعيل تنبيهات الضريبة.`,
        actionLabel: "الإعدادات",
        actionHref: "/dashboard/settings",
      });
    }
  }

  // Build payment due (specific contractor)
  for (const c of contractors) {
    if (
      c.firstPaymentDueDate &&
      differenceInDays(c.firstPaymentDueDate, now) <= 14 &&
      differenceInDays(c.firstPaymentDueDate, now) >= 0
    ) {
      const amt = decimalToNumber(
        c.installmentAmount ?? c.remainingBalance
      );
      insights.push({
        householdId,
        type: InsightType.BUILD_PAYMENT_DUE,
        severity: InsightSeverity.CRITICAL,
        title: `دفعة قريبة: ${c.name}`,
        body: `₪${Math.round(amt).toLocaleString("he-IL")} مستحقة في ${c.firstPaymentDueDate.toLocaleDateString("ar")}.`,
        actionLabel: "تسجيل دفعة",
        actionHref: "/dashboard/build",
        metadata: { contractorId: c.id },
      });
    }
  }

  const validUntil = addDays(now, 7);
  await prisma.insight.deleteMany({ where: { householdId } });

  await prisma.insight.createMany({
    data: insights.map((i) => ({
      householdId: i.householdId,
      type: i.type,
      severity: i.severity,
      title: i.title,
      body: i.body,
      actionLabel: i.actionLabel,
      actionHref: i.actionHref,
      metadata: i.metadata ?? undefined,
      validUntil,
    })),
  });

  return insights.length;
}

function computeRollingNet(
  tx: {
    type: TransactionType;
    amount: { toString(): string };
    date: Date;
    isBuildExpense: boolean;
  }[],
  months: number
): number {
  const now = new Date();
  let total = 0;
  for (let m = 0; m < months; m++) {
    const start = startOfMonth(subMonths(now, m + 1));
    const end = endOfMonth(start);
    const monthTx = tx.filter((t) => t.date >= start && t.date <= end);
    const income = monthTx
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);
    const out = monthTx
      .filter((t) => t.type !== TransactionType.INCOME)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);
    total += income - out;
  }
  return total / months;
}

function groupExpensesByCategory(
  tx: {
    category: { name: string } | null;
    amount: { toString(): string };
  }[]
): Record<string, number> {
  return tx.reduce<Record<string, number>>((acc, t) => {
    if (!t.category) return acc;
    const n = t.category.name;
    acc[n] = (acc[n] ?? 0) + decimalToNumber(t.amount);
    return acc;
  }, {});
}

export async function recomputeMonthlySnapshots(householdId: string) {
  const tx = await prisma.transaction.findMany({
    where: { householdId },
    include: { category: true, incomeSource: true },
  });

  const byMonth = new Map<string, typeof tx>();
  for (const t of tx) {
    const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(t);
  }

  for (const [key, monthTx] of byMonth) {
    const [y, m] = key.split("-").map(Number);
    const income = monthTx
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);
    const dailyExpenses = monthTx
      .filter(
        (t) =>
          t.type === TransactionType.EXPENSE &&
          !t.isBuildExpense
      )
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);
    const buildExpenses = monthTx
      .filter((t) => t.isBuildExpense || t.type === TransactionType.BUILD_EXPENSE)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);
    const savingsContributions = monthTx
      .filter((t) => t.type === TransactionType.SAVINGS_CONTRIBUTION)
      .reduce((s, t) => s + decimalToNumber(t.amount), 0);

    const incomeBySource: Record<string, number> = {};
    for (const t of monthTx.filter((t) => t.type === TransactionType.INCOME)) {
      const src = t.incomeSource?.name ?? "أخرى";
      incomeBySource[src] =
        (incomeBySource[src] ?? 0) + decimalToNumber(t.amount);
    }

    const net = income - dailyExpenses - buildExpenses - savingsContributions;

    await prisma.monthlySnapshot.upsert({
      where: { householdId_year_month: { householdId, year: y, month: m } },
      create: {
        householdId,
        year: y,
        month: m,
        totalIncome: income,
        dailyExpenses,
        buildExpenses,
        savingsContributions,
        netCashflow: net,
        incomeBySource,
      },
      update: {
        totalIncome: income,
        dailyExpenses,
        buildExpenses,
        savingsContributions,
        netCashflow: net,
        incomeBySource,
        computedAt: new Date(),
      },
    });
  }
}
