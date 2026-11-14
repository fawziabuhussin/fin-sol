"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Gem,
  Plus,
  Repeat,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { YearlyTrendChart } from "@/components/dashboard/yearly-trend-chart";
import { CategoryBubbleChart } from "@/components/dashboard/category-bubble-chart";
import { CategoryExpenseTable } from "@/components/dashboard/category-expense-table";
import { CategorizeExpensesPanel } from "@/components/dashboard/categorize-expenses-panel";
import { QUICK_ADD_EVENT } from "@/components/app-shell/nav-config";
import type { ExpenseGroupRow, UncategorizedExpense } from "@/lib/expense-category-groups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatSignedCurrency } from "@/lib/utils";
import { AR_MONTHS, monthLabel } from "@/lib/finance-labels";

type Overview = {
  year: number;
  month: number;
  monthLabel: string;
  hasIncomeNoExpenses?: boolean;
  income: {
    sources: { id: string; name: string; color: string; isSalary: boolean; amount: number }[];
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
    byGroup: ExpenseGroupRow[];
    uncategorized: UncategorizedExpense[];
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
  salarySlip: { gross: number; net: number; tax: number; pension: number; kerenHishtalmut: number } | null;
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

export type DashboardPulse = {
  subscriptions: { total: number; unpaid: number; remaining: number };
  installments: { due: number; amount: number; overdue: number; activePlans: number };
  salary: { employers: number; recorded: number; pendingPay: number };
};

type PulseTone = "ok" | "todo" | "alert" | "idle";
const PULSE_TONE: Record<PulseTone, string> = {
  ok: "text-emerald-600",
  todo: "text-amber-600",
  alert: "text-rose-600",
  idle: "text-slate-500",
};

function PulseCard({
  href,
  icon: Icon,
  title,
  value,
  status,
  tone,
}: {
  href: string;
  icon: typeof Repeat;
  title: string;
  value: string;
  status: string;
  tone: PulseTone;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-float"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-100 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-slate-500">{title}</span>
        <span className="num block truncate text-base font-bold text-slate-900">{value}</span>
        <span className={cn("block truncate text-xs font-medium", PULSE_TONE[tone])}>{status}</span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </Link>
  );
}

export function MonthlyDashboard({
  overview,
  trend,
  availableMonths,
  expenseMonths = [],
  buildingProjectId = null,
  totalSavingsExclKupot = 0,
  expenseCategories = [],
  year,
  month,
  currentPeriod,
  pulse,
}: {
  overview: Overview;
  trend: TrendPoint[];
  availableMonths: number[];
  expenseMonths?: number[];
  buildingProjectId?: string | null;
  totalSavingsExclKupot?: number;
  expenseCategories?: { id: string; name: string }[];
  year: number;
  month: number;
  currentPeriod: { year: number; month: number };
  pulse: DashboardPulse;
}) {
  const router = useRouter();
  const activeMonthRef = useRef<HTMLButtonElement>(null);
  // Keep the selected month visible in the horizontally scrolling strip (phones).
  useEffect(() => {
    activeMonthRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [month]);
  const go = (y: number, m: number) => router.push(`/dashboard?year=${y}&month=${m}`, { scroll: false });
  const shift = (delta: number) => {
    const idx = year * 12 + (month - 1) + delta;
    go(Math.floor(idx / 12), (idx % 12) + 1);
  };
  const isCurrent = year === currentPeriod.year && month === currentPeriod.month;

  const priorCumulativeNet = useMemo(
    () => trend.filter((m) => m.month < month).reduce((sum, m) => sum + m.net, 0),
    [trend, month]
  );
  const spentPct =
    overview.income.total > 0 ? Math.round((overview.expenses.total / overview.income.total) * 100) : null;
  const monthSavings = overview.savings.outflow ?? overview.savings.contributions;
  const recent = overview.transactions.slice(0, 8);

  const { subscriptions: subs, installments: inst, salary } = pulse;
  const salaryMissing = Math.max(0, salary.employers - salary.recorded);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">ملخص الشهر</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            {overview.monthLabel} {year}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          {!isCurrent && (
            <Button variant="ghost" size="sm" className="text-indigo-600" onClick={() => go(currentPeriod.year, currentPeriod.month)}>
              الشهر الحالي
            </Button>
          )}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-card">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="الشهر السابق">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="min-w-[88px] text-center text-sm font-semibold text-slate-800">{overview.monthLabel}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="الشهر التالي">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Month strip */}
      <nav aria-label="أشهر السنة" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          {AR_MONTHS.map((label, idx) => {
            const m = idx + 1;
            const active = m === month;
            const hasData = availableMonths.includes(m) || expenseMonths.includes(m);
            return (
              <button
                key={label}
                ref={active ? activeMonthRef : undefined}
                type="button"
                onClick={() => go(year, m)}
                aria-current={active ? "date" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  active
                    ? "bg-slate-900 text-white"
                    : hasData
                      ? "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-slate-300"
                      : "text-slate-400 hover:text-slate-600"
                )}
              >
                {label}
                {hasData && !active && <span className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-indigo-500" aria-hidden />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Hero + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section
          aria-label="صافي الشهر"
          className="relative min-w-0 overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-7 lg:col-span-3"
        >
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 right-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/60">صافي {overview.monthLabel}</p>
              <p className={cn("num mt-1 text-4xl font-bold tracking-tight sm:text-5xl", overview.net < 0 && "text-rose-300")}>
                {formatSignedCurrency(overview.net)}
              </p>
            </div>
            {month > 1 && (
              <div className="text-left">
                <p className="text-xs text-white/50">تراكمي حتى {AR_MONTHS[month - 2]}</p>
                <p className="num text-lg font-semibold text-white/90">{formatSignedCurrency(priorCumulativeNet)}</p>
              </div>
            )}
          </div>
          {spentPct != null && (
            <div className="relative mt-5">
              <div className="h-2 overflow-hidden rounded-full bg-emerald-400/25">
                <div
                  className={cn("h-full rounded-full", spentPct > 100 ? "bg-rose-400" : "bg-white/80")}
                  style={{ width: `${Math.min(100, spentPct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/60">
                صرفت <span className="num font-semibold text-white">{spentPct}%</span> من الدخل
              </p>
            </div>
          )}
          <dl className="relative mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
            {[
              { label: "الدخل", value: formatCurrency(overview.income.total) },
              { label: "المصروفات", value: formatCurrency(overview.expenses.total) },
              { label: "ادخار الشهر", value: formatCurrency(monthSavings) },
            ].map((s) => (
              <div key={s.label} className="px-2 text-center">
                <dt className="text-[11px] text-white/55">{s.label}</dt>
                <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(QUICK_ADD_EVENT))}
            className="col-span-2 flex items-center justify-between gap-3 rounded-2xl bg-brand p-4 text-start text-white shadow-lg shadow-indigo-600/25 transition-[background-color,transform] hover:bg-brand-strong active:scale-[0.99]"
          >
            <span>
              <span className="block text-base font-bold">إضافة سريعة</span>
              <span className="block text-xs text-white/70">مصروف أو دخل في ثوانٍ</span>
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </span>
          </button>
          {[
            { href: "/salary", label: "رفع قسيمة", sub: "اقرأ الراتب من PDF", icon: FileText },
            { href: "/savings", label: "الادخار", sub: formatCurrency(totalSavingsExclKupot), icon: Gem },
          ].map(({ href, label, sub, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-card transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-float"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{label}</span>
                <span className="num block truncate text-xs text-slate-500">{sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* This month across the app */}
      <section aria-label="هذا الشهر" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PulseCard
          href={`/subscriptions?year=${year}&month=${month}`}
          icon={Repeat}
          title="الاشتراكات"
          value={subs.total === 0 ? "—" : subs.unpaid === 0 ? "كلها مدفوعة" : formatCurrency(subs.remaining)}
          status={
            subs.total === 0
              ? "أضف اشتراكاتك لتتابعها"
              : subs.unpaid === 0
                ? `${subs.total} اشتراكات ✓`
                : `${subs.unpaid} من ${subs.total} متبقية`
          }
          tone={subs.total === 0 ? "idle" : subs.unpaid === 0 ? "ok" : "todo"}
        />
        <PulseCard
          href="/splits"
          icon={CreditCard}
          title="الأقساط"
          value={inst.due === 0 ? (inst.activePlans ? "لا دفعات مستحقة" : "—") : formatCurrency(inst.amount)}
          status={
            inst.overdue > 0
              ? `${inst.overdue} ${inst.overdue === 1 ? "دفعة متأخرة" : "دفعات متأخرة"}`
              : inst.due > 0
                ? `${inst.due} ${inst.due === 1 ? "دفعة" : "دفعات"} هذا الشهر`
                : inst.activePlans
                  ? `${inst.activePlans} أقساط نشطة`
                  : "لا مشتريات بالتقسيط"
          }
          tone={inst.overdue > 0 ? "alert" : inst.due > 0 ? "todo" : inst.activePlans ? "ok" : "idle"}
        />
        <PulseCard
          href="/salary"
          icon={WalletCards}
          title={`راتب ${monthLabel(month)}`}
          value={overview.income.salary > 0 ? formatCurrency(overview.income.salary) : salary.employers ? "لم يُسجّل" : "—"}
          status={
            salary.employers === 0
              ? "أضف جهة عمل وارفع القسيمة"
              : salaryMissing > 0
                ? `بانتظار ${salaryMissing} من ${salary.employers} — ارفع القسيمة`
                : salary.pendingPay > 0
                  ? `${salary.pendingPay} بانتظار تأكيد القبض`
                  : "سُجّل ✓"
          }
          tone={salary.employers === 0 ? "idle" : salaryMissing > 0 || salary.pendingPay > 0 ? "todo" : "ok"}
        />
      </section>

      {/* Income + expenses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex min-w-0 flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="h-4 w-4" />
              </span>
              الدخل
            </h2>
            <span className="num text-lg font-bold text-emerald-600">{formatCurrency(overview.income.total)}</span>
          </div>
          {overview.income.sources.length === 0 ? (
            <p className="mt-6 flex-1 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              لا دخل مسجّل لهذا الشهر.
              <Link href="/salary" className="mt-1 block font-semibold text-indigo-600">ارفع قسيمة الراتب</Link>
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {overview.income.sources.map((source) => {
                const share = overview.income.total > 0 ? (source.amount / overview.income.total) * 100 : 0;
                return (
                  <li key={source.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: source.color }} />
                        <span className="truncate text-sm font-medium text-slate-800" dir="auto">{source.name}</span>
                        {source.isSalary && (
                          <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-semibold text-indigo-700">راتب</span>
                        )}
                      </span>
                      <span className="num shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(source.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: source.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {(overview.income.savingsDeducted ?? 0) > 0 && (
            <p className="mt-4 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">
              <span>خصم ادخار/جمعية</span>
              <span className="num font-semibold">{formatSignedCurrency(-overview.income.savingsDeducted!)}</span>
            </p>
          )}
        </Card>

        <Card className="min-w-0 p-5 sm:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              المصروفات
            </h2>
            <span className="num text-lg font-bold text-rose-600">{formatCurrency(overview.expenses.total)}</span>
          </div>

          <div className="mt-4 space-y-4">
            <CategorizeExpensesPanel items={overview.expenses.uncategorized} categories={expenseCategories} />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShoppingBag className="h-3.5 w-3.5" /> يومية
                </p>
                <p className="num mt-1 text-lg font-bold text-slate-900">{formatCurrency(overview.expenses.daily)}</p>
              </div>
              {buildingProjectId ? (
                <Link href={`/projects/${buildingProjectId}`} className="rounded-2xl bg-slate-50 p-3.5 transition-colors hover:bg-slate-100">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> البناء <ChevronLeft className="h-3 w-3" />
                  </p>
                  <p className="num mt-1 text-lg font-bold text-slate-900">{formatCurrency(overview.expenses.build)}</p>
                </Link>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> مشاريع
                  </p>
                  <p className="num mt-1 text-lg font-bold text-slate-900">{formatCurrency(overview.expenses.build)}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
              <CategoryBubbleChart groups={overview.expenses.byGroup} total={overview.expenses.daily} />
              <CategoryExpenseTable groups={overview.expenses.byGroup} total={overview.expenses.daily} />
            </div>

            {overview.hasIncomeNoExpenses && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                لا مصروفات مسجّلة لهذا الشهر بعد — أضفها من «إضافة سريعة» لتكتمل الصورة.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Savings plans */}
      {(overview.savings.plans.length > 0 || monthSavings > 0) && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Gem className="h-4 w-4" />
              </span>
              الادخار والجمعيات
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/savings">
                إدارة <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.savings.plans.map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-hairline p-4">
                <p className="truncate text-sm font-semibold text-slate-900" dir="auto">{plan.title}</p>
                <p className="text-xs text-slate-500">{plan.type === "JAMIYA" ? "جمعية" : "ادخار شخصي"}</p>
                <p className="num mt-3 text-xl font-bold text-violet-700">
                  {formatCurrency(plan.monthlyContribution)}
                  <span className="text-xs font-medium text-slate-500"> / شهر</span>
                </p>
                {plan.targetAmount ? (
                  <p className="num mt-1 text-xs text-slate-500">الهدف {formatCurrency(plan.targetAmount)}</p>
                ) : null}
              </div>
            ))}
            {monthSavings > 0 && (
              <div className="flex flex-col justify-center rounded-2xl bg-violet-600 p-4 text-white">
                <p className="text-xs text-violet-100">ادخار هذا الشهر</p>
                <p className="num text-2xl font-bold">{formatCurrency(monthSavings)}</p>
                {(overview.savings.assetsPurchased ?? 0) > 0 && (
                  <p className="num mt-1 text-xs text-violet-200">
                    جمعية {formatCurrency(overview.savings.contributions)} · أصول {formatCurrency(overview.savings.assetsPurchased!)}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Trend + recent */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="min-w-0 p-4 sm:p-6 lg:col-span-3">
          <h2 className="text-base font-bold text-slate-900">سنة {year}</h2>
          <p className="mt-0.5 text-xs text-slate-500">الدخل والمصروفات شهرياً</p>
          <div className="mt-3">
            <YearlyTrendChart data={trend} year={year} />
          </div>
        </Card>

        <Card className="min-w-0 p-2 sm:p-3 lg:col-span-2">
          <div className="flex items-center justify-between px-3 pb-1 pt-3">
            <h2 className="text-base font-bold text-slate-900">آخر المعاملات</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/transactions?year=${year}&month=${month}`}>
                الكل <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          {recent.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-500">لا معاملات هذا الشهر</p>
          ) : (
            <ul className="divide-y divide-slate-100/80">
              {recent.map((item) => {
                const isIncome = item.type === "INCOME";
                const isSavings = item.type === "SAVINGS_CONTRIBUTION";
                const [, mm, dd] = item.occurredAt.split("-");
                return (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        isIncome ? "bg-emerald-50 text-emerald-600" : isSavings ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {isIncome ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900" dir="auto">
                        {item.description || item.payeeName || item.categoryName}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {Number(dd)} {monthLabel(Number(mm))} · {item.categoryName}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "num shrink-0 text-sm font-bold",
                        isIncome ? "text-emerald-600" : isSavings ? "text-violet-600" : "text-slate-900"
                      )}
                    >
                      {formatSignedCurrency(isIncome ? item.amount : -item.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
