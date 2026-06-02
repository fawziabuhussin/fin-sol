import { CategoryKind, TransactionType } from "@/generated/prisma/client";

/** Months before expense tracking was reliable (spent but not logged). */
export const EXPENSE_TRACKING_START_MONTH = 4;

/** Share of income assumed spent when expenses were not tracked. */
export const UNDERTRACKED_SPEND_RATIO = 0.97;

export function reportThroughMonth(year: number, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (year < y) return 12;
  if (year > y) return 0;
  return m;
}

export function isUndertrackedExpenseMonth(year: number, month: number) {
  return month < EXPENSE_TRACKING_START_MONTH;
}

export function isSavingsRelatedIncomeText(text: string) {
  return /ادخار|جمعية|جمع/i.test(text);
}

export function isSavingsRelatedIncome(t: {
  type: string;
  category?: { name?: string; kind?: string } | null;
  description?: string | null;
  payee?: { name?: string } | null;
}) {
  if (t.type !== TransactionType.INCOME) return false;
  const cat = t.category;
  if (cat?.kind === CategoryKind.SAVINGS || cat?.name === "ادخار") return true;
  const blob = `${cat?.name ?? ""} ${t.description ?? ""} ${t.payee?.name ?? ""}`;
  return isSavingsRelatedIncomeText(blob);
}

export function planAppliesInMonth(
  plan: {
    status: string;
    startDate: Date | null;
    payoutDate: Date | null;
  },
  year: number,
  month: number
) {
  if (plan.status !== "ACTIVE") return false;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  if (plan.startDate && plan.startDate > monthEnd) return false;
  if (plan.payoutDate && plan.payoutDate < monthStart) return false;
  return true;
}

export function adjustUndertrackedExpenses(income: number, expenses: number) {
  if (income <= 0) {
    return { expenses, net: income - expenses, adjusted: false };
  }
  if (expenses >= income * 0.5) {
    return { expenses, net: income - expenses, adjusted: false };
  }
  const effectiveExpenses =
    Math.round(income * UNDERTRACKED_SPEND_RATIO * 100) / 100;
  return {
    expenses: effectiveExpenses,
    net: income - effectiveExpenses,
    adjusted: true,
  };
}

export type YearForecastRow = {
  label: string;
  actual: number;
  projected: number;
  expectedTotal: number;
};

export function buildYearForecast(params: {
  year: number;
  throughMonth: number;
  monthly: {
    month: number;
    income: number;
    expenses: number;
    savings: number;
    net: number;
    expensesAdjusted?: boolean;
  }[];
}) {
  const { throughMonth, monthly } = params;
  const elapsed = monthly.filter((m) => m.month <= throughMonth);
  const remaining = 12 - throughMonth;

  const sum = (key: "income" | "expenses" | "savings" | "net") =>
    elapsed.reduce((s, m) => s + m[key], 0);

  const actual = {
    income: sum("income"),
    expenses: sum("expenses"),
    savings: sum("savings"),
    net: sum("net"),
  };

  const tracked = elapsed.filter(
    (m) => m.month >= EXPENSE_TRACKING_START_MONTH && (m.expenses > 0 || m.income > 0)
  );
  const incomeBasis = tracked.length > 0 ? tracked : elapsed.filter((m) => m.income > 0);
  const expenseBasis = tracked.length > 0 ? tracked : elapsed.filter((m) => m.expenses > 0);
  const savingsBasis = elapsed.filter((m) => m.savings > 0);

  const avg = (items: typeof elapsed, key: "income" | "expenses" | "savings" | "net") => {
    if (items.length === 0) return 0;
    return items.reduce((s, m) => s + m[key], 0) / items.length;
  };

  const avgIncome = avg(incomeBasis, "income");
  const avgExpenses = avg(expenseBasis, "expenses");
  const avgSavings = savingsBasis.length
    ? avg(savingsBasis, "savings")
    : avg(elapsed, "savings");

  const projected = {
    income: avgIncome * remaining,
    expenses: avgExpenses * remaining,
    savings: avgSavings * remaining,
    net: (avgIncome - avgExpenses - avgSavings) * remaining,
  };

  const expectedTotal = {
    income: actual.income + projected.income,
    expenses: actual.expenses + projected.expenses,
    savings: actual.savings + projected.savings,
    net: actual.net + projected.net,
  };

  const rows: YearForecastRow[] = [
    {
      label: "الدخل",
      actual: actual.income,
      projected: projected.income,
      expectedTotal: expectedTotal.income,
    },
    {
      label: "المصروفات",
      actual: actual.expenses,
      projected: projected.expenses,
      expectedTotal: expectedTotal.expenses,
    },
    {
      label: "الادخار",
      actual: actual.savings,
      projected: projected.savings,
      expectedTotal: expectedTotal.savings,
    },
    {
      label: "الصافي (بعد الادخار)",
      actual: actual.net,
      projected: projected.net,
      expectedTotal: expectedTotal.net,
    },
  ];

  return {
    throughMonth,
    remainingMonths: remaining,
    actual,
    projected,
    expectedTotal,
    rows,
    basis: {
      incomeMonths: incomeBasis.length,
      expenseMonths: expenseBasis.length,
      savingsMonths: savingsBasis.length || elapsed.length,
    },
  };
}
