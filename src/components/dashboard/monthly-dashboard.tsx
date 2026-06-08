"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { YearlyTrendChart } from "@/components/dashboard/yearly-trend-chart";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  Gem,
  GraduationCap,
  PiggyBank,
  Rocket,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { AR_MONTHS } from "@/lib/finance-labels";
import { cn } from "@/lib/utils";

type Overview = {
  year: number;
  month: number;
  monthLabel: string;
  hasIncomeNoExpenses?: boolean;
  income: {
    sources: {
      id: string;
      name: string;
      color: string;
      isSalary: boolean;
      amount: number;
    }[];
    total: number;
    grossTotal?: number;
    salary: number;
    savingsDeducted?: number;
  };
  expenses: {
    daily: number;
    build: number;
    total: number;
    byCategory: { name: string; amount: number }[];
  };
  savings: {
    contributions: number;
    assetsPurchased?: number;
    outflow?: number;
    plans: {
      id: string;
      title: string;
      type: string;
      monthlyContribution: number;
      targetAmount: number | null;
      startDate: string | null;
      payoutDate: string | null;
      status: string;
    }[];
  };
  net: number;
  salarySlip: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    kerenHishtalmut: number;
  } | null;
  transactions: {
    id: string;
    type: string;
    amount: number;
    occurredAt: string;
    description: string | null;
    categoryName: string;
    payeeName: string | null;
  }[];
};

type TrendPoint = {
  month: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  salary: number;
  savings?: number;
};

const SOURCE_ICONS: Record<string, typeof Briefcase> = {
  afaq: Briefcase,
  intilaqa: Rocket,
  scholarship: GraduationCap,
  salary: Wallet,
};

function IncomeIcon({ id, isSalary }: { id: string; isSalary?: boolean }) {
  const Icon = isSalary ? Wallet : SOURCE_ICONS[id] ?? TrendingUp;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-emerald-100">
      <Icon className="h-5 w-5 text-emerald-700" />
    </span>
  );
}

function savingsProgress(plan: Overview["savings"]["plans"][number]) {
  if (!plan.targetAmount || plan.targetAmount <= 0) return 35;
  const months =
    plan.startDate && plan.payoutDate
      ? Math.max(
          1,
          Math.round(
            (new Date(plan.payoutDate).getTime() -
              new Date(plan.startDate).getTime()) /
              (1000 * 60 * 60 * 24 * 30)
          )
        )
      : 12;
  const estimated = plan.monthlyContribution * Math.min(months, 6);
  return Math.min(100, Math.round((estimated / plan.targetAmount) * 100));
}

export function MonthlyDashboard({
  overview,
  trend,
  availableMonths,
  expenseMonths = [],
  buildingProjectId = null,
  totalSavingsExclKupot = 0,
  year,
  month,
}: {
  overview: Overview;
  trend: TrendPoint[];
  availableMonths: number[];
  expenseMonths?: number[];
  buildingProjectId?: string | null;
  totalSavingsExclKupot?: number;
  year: number;
  month: number;
}) {
  const router = useRouter();

  const selectMonth = (m: number) => {
    router.push(`/dashboard?year=${year}&month=${m}`);
  };

  const expenseTx = overview.transactions.filter((t) => t.type === "EXPENSE");

  const priorCumulativeNet = useMemo(
    () =>
      trend
        .filter((m) => m.month < month)
        .reduce((sum, m) => sum + m.net, 0),
    [trend, month]
  );

  const priorMonthLabel = month > 1 ? AR_MONTHS[month - 2] : null;

  const incomeRatio =
    overview.income.total > 0
      ? Math.round((overview.expenses.total / overview.income.total) * 100)
      : 0;

  const monthSavings =
    overview.savings.outflow ?? overview.savings.contributions;

  return (
    <motion.div
      className="space-y-4 pb-4 sm:space-y-6 sm:pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">التلخيص الشهري</p>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {overview.monthLabel} {year}
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => selectMonth(Math.max(1, month - 1))}
            disabled={month <= 1}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => selectMonth(Math.min(12, month + 1))}
            disabled={month >= 12}
          >
            التالي
          </Button>
        </div>
      </div>

      <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-1 sm:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 snap-x snap-mandatory">
          {AR_MONTHS.map((label, idx) => {
            const m = idx + 1;
            const active = m === month;
            const hasData = availableMonths.includes(m);
            const hasExpenses = expenseMonths.includes(m);
            return (
              <button
                key={label}
                type="button"
                onClick={() => selectMonth(m)}
                className={cn(
                  "snap-start rounded-full px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm",
                  active
                    ? "bg-slate-900 text-white shadow-md"
                    : hasExpenses
                      ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                      : hasData
                        ? "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        : "bg-slate-50 text-slate-400 ring-1 ring-slate-100"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {overview.hasIncomeNoExpenses && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          هذا الشهر يحتوي على دخل مسجّل بدون مصروفات في Master Data. جرّب{" "}
          <strong>أبريل</strong> أو <strong>مايو</strong> لعرض المصروفات الفعلية.
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg sm:rounded-3xl sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, #1e3a5f 0%, #2563eb 45%, #6366f1 100%)",
        }}
      >
        <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-end gap-6 sm:gap-10">
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm text-blue-100">
                  <PiggyBank className="h-4 w-4" />
                  الصافي الشهري
                </p>
                <p className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                  {formatCurrency(overview.net)}
                </p>
              </div>
              {month > 1 && priorMonthLabel && (
                <div>
                  <p className="mb-1 text-sm text-blue-100/90">
                    تراكمي حتى {priorMonthLabel}
                  </p>
                  <p className="text-2xl font-extrabold tracking-tight text-blue-50 sm:text-3xl">
                    {formatCurrency(priorCumulativeNet)}
                  </p>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-blue-100 sm:text-sm">
              دخل {formatCurrency(overview.income.total)} − مصروفات{" "}
              {formatCurrency(overview.expenses.total)}
              {monthSavings > 0 && <> − ادخار {formatCurrency(monthSavings)}</>}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-blue-100">الراتب</p>
              <p className="text-lg font-bold">
                {formatCurrency(overview.income.salary)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs text-blue-100">نسبة المصروفات</p>
              <p className="text-lg font-bold">{incomeRatio}%</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm sm:col-span-1">
              <p className="text-xs text-blue-100">إجمالي الادخار</p>
              <p className="text-xs text-blue-200/80">بدون קופות</p>
              <p className="text-lg font-bold">
                {formatCurrency(totalSavingsExclKupot)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card className="overflow-hidden border-emerald-100">
          <CardHeader className="border-b border-emerald-100 bg-gradient-to-l from-emerald-50 to-white">
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <ArrowDownLeft className="h-5 w-5" />
              الدخل — مصادر الدخل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {overview.income.sources.length === 0 && (
              <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-6 text-center text-sm text-slate-500">
                لا توجد مصادر دخل مسجّلة لهذا الشهر.
              </p>
            )}
            {overview.income.sources.map((source) => (
              <div
                key={source.id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4",
                  source.isSalary
                    ? "border-indigo-200 bg-indigo-50/60"
                    : "border-emerald-100 bg-emerald-50/40"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IncomeIcon id={source.id} isSalary={source.isSalary} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">
                      {source.name}
                      {source.isSalary && (
                        <span className="mr-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">
                          راتب
                        </span>
                      )}
                    </p>
                    <div className="mt-2 h-2 w-full min-w-[120px] max-w-[200px] overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${
                            overview.income.total > 0
                              ? (source.amount / overview.income.total) * 100
                              : 0
                          }%`,
                          backgroundColor: source.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="shrink-0 text-base font-extrabold text-emerald-700 sm:text-lg">
                  {formatCurrency(source.amount)}
                </p>
              </div>
            ))}
            {(overview.income.savingsDeducted ?? 0) > 0 && (
              <div className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
                <span className="font-medium">خصم ادخار/جمعية</span>
                <span className="text-lg font-extrabold">
                  −{formatCurrency(overview.income.savingsDeducted!)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3 text-white">
              <span className="font-bold">إجمالي الدخل</span>
              <span className="text-xl font-extrabold">
                {formatCurrency(overview.income.total)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-rose-100">
          <CardHeader className="border-b border-rose-100 bg-gradient-to-l from-rose-50 to-white">
            <CardTitle className="flex items-center gap-2 text-rose-800">
              <ArrowUpRight className="h-5 w-5" />
              المصروفات — Outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <div className="flex flex-col gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <ShoppingBag className="h-5 w-5 text-rose-600" />
                </span>
                <div>
                  <p className="font-bold text-slate-900">المصروفات اليومية</p>
                  <p className="text-xs text-slate-500">بدون بناء</p>
                </div>
              </div>
              <p className="text-base font-extrabold text-rose-700 sm:text-lg">
                {formatCurrency(overview.expenses.daily)}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-100 bg-amber-50/50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Building2 className="h-5 w-5 text-amber-700" />
                </span>
                <div>
                  {buildingProjectId ? (
                    <Link
                      href={`/projects/${buildingProjectId}`}
                      className="font-bold text-slate-900 hover:underline"
                    >
                      مصروفات البناء
                    </Link>
                  ) : (
                    <p className="font-bold text-slate-900">مصروفات البناء</p>
                  )}
                  <p className="text-xs text-slate-500">مقاولين وأقساط — اضغط للتفاصيل</p>
                </div>
              </div>
              <p className="text-base font-extrabold text-amber-700 sm:text-lg">
                {formatCurrency(overview.expenses.build)}
              </p>
            </div>
            {overview.expenses.byCategory.slice(0, 5).map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-700">
                  {cat.name}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(cat.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-2xl bg-rose-600 px-4 py-3 text-white">
              <span className="font-bold">إجمالي المصروفات</span>
              <span className="text-xl font-extrabold">
                {formatCurrency(overview.expenses.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-violet-100">
        <CardHeader className="border-b border-violet-100 bg-gradient-to-l from-violet-50 to-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-violet-900">
              <Gem className="h-5 w-5" />
              الادخار والجمعيات
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/savings">إدارة الادخار</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {overview.savings.plans.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">
              لا توجد خطط ادخار — أضفها من صفحة الادخار
            </p>
          ) : (
            overview.savings.plans.map((plan) => {
              const progress = savingsProgress(plan);
              return (
                <div
                  key={plan.id}
                  className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/80 p-4 shadow-sm"
                >
                  <div className="pointer-events-none absolute -left-4 -top-4 h-16 w-16 rounded-full bg-violet-200/40" />
                  <div className="relative">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{plan.title}</p>
                        <p className="text-xs text-violet-600">
                          {plan.type === "JAMIYA" ? "جمعية" : "ادخار شخصي"}
                        </p>
                      </div>
                      <Gem className="h-5 w-5 shrink-0 text-violet-500" />
                    </div>
                    <p className="text-2xl font-extrabold text-violet-700">
                      {formatCurrency(plan.monthlyContribution)}
                      <span className="text-sm font-medium text-slate-500">
                        {" "}
                        / شهر
                      </span>
                    </p>
                    {plan.targetAmount && (
                      <>
                        <p className="mt-1 text-xs text-slate-500">
                          الهدف: {formatCurrency(plan.targetAmount)}
                        </p>
                        <Progress
                          value={progress}
                          className="mt-3 h-2 bg-violet-100"
                        />
                        <p className="mt-1 text-xs text-violet-600">
                          {progress}% من الهدف
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {(overview.savings.outflow ?? overview.savings.contributions) > 0 && (
            <div className="flex flex-col justify-center rounded-2xl border border-violet-200 bg-violet-600 p-4 text-white sm:col-span-2 lg:col-span-1">
              <p className="text-sm text-violet-100">ادخار هذا الشهر</p>
              <p className="text-2xl font-extrabold">
                {formatCurrency(
                  overview.savings.outflow ?? overview.savings.contributions
                )}
              </p>
              {(overview.savings.assetsPurchased ?? 0) > 0 && (
                <p className="mt-1 text-xs text-violet-200">
                  جمعية {formatCurrency(overview.savings.contributions)} · أصول{" "}
                  {formatCurrency(overview.savings.assetsPurchased!)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">مقارنة سنوية</CardTitle>
          <p className="text-xs text-slate-500 sm:text-sm">
            الدخل والمصروفات شهرياً — المسّ على الرسم للتفاصيل
          </p>
        </CardHeader>
        <CardContent className="px-3 pb-4 pt-0 sm:px-6 sm:pb-6">
          <YearlyTrendChart data={trend} year={year} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base sm:text-lg">
            معاملات الشهر ({expenseTx.length + overview.transactions.filter(t => t.type === 'INCOME').length})
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/transactions">عرض الكل</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {overview.transactions.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد معاملات هذا الشهر</p>
          ) : (
            overview.transactions.slice(0, 12).map((item) => {
              const isIncome = item.type === "INCOME";
              const isSavings = item.type === "SAVINGS_CONTRIBUTION";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {item.description || item.payeeName || item.categoryName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.occurredAt} · {item.categoryName}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 font-bold",
                      isIncome
                        ? "text-emerald-700"
                        : isSavings
                          ? "text-violet-700"
                          : "text-rose-700"
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
