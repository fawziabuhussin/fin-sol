"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  PiggyBank,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type AnnualShowcaseData = {
  year: number;
  totals: {
    income: number;
    salary: number;
    expenses: number;
    daily: number;
    build: number;
    savings: number;
    net: number;
  };
  monthly: {
    month: number;
    label: string;
    income: number;
    salary: number;
    expenses: number;
    daily: number;
    build: number;
    savings: number;
    net: number;
    hasActivity: boolean;
  }[];
  incomeBySource: {
    id: string;
    name: string;
    color: string;
    isSalary: boolean;
    amount: number;
  }[];
  expensesByCategory: { name: string; amount: number }[];
  averages: { income: number; expenses: number };
  highlights: {
    bestNetMonth: { label: string; net: number; month: number } | null;
    worstNetMonth: { label: string; net: number; month: number } | null;
    highestExpenseMonth: {
      label: string;
      expenses: number;
      month: number;
    } | null;
  };
  building: {
    id: string;
    title: string;
    totalBudget: number;
    paidToDate: number;
    remaining: number;
    percentComplete: number;
    contractorsCount: number;
    pendingInstallments: number;
    contractors: {
      id: string;
      title: string;
      paid: number;
      totalBudget: number;
      remaining: number;
    }[];
  } | null;
  savingsPlans: {
    id: string;
    title: string;
    type: string;
    monthlyContribution: number;
    targetAmount: number | null;
    status: string;
    annualContribution: number;
  }[];
  salaryAnnual: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    monthsWithSlips: number;
  };
  insights: { type: "positive" | "neutral" | "warning"; text: string }[];
  buildingProjectId: string | null;
  activeMonthsCount: number;
};

const INSIGHT_STYLES = {
  positive: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  neutral: "border-slate-200 bg-slate-50/80 text-slate-800",
  warning: "border-amber-200 bg-amber-50/80 text-amber-900",
};

export function AnnualShowcaseClient({ data }: { data: AnnualShowcaseData }) {
  const router = useRouter();
  const { year, totals } = data;
  const netPositive = totals.net >= 0;

  const chartData = data.monthly.map((m) => ({
    name: m.label.slice(0, 3),
    fullLabel: m.label,
    income: m.income,
    expenses: m.expenses,
    net: m.net,
    month: m.month,
  }));

  const cumulativeNet = data.monthly.reduce<{ label: string; cumulative: number }[]>(
    (acc, m) => {
      const prev = acc.length ? acc[acc.length - 1].cumulative : 0;
      acc.push({ label: m.label, cumulative: prev + m.net });
      return acc;
    },
    []
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900 p-5 text-white shadow-xl sm:p-8"
      >
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-indigo-200">
              <Sparkles className="h-4 w-4" />
              التقرير السنوي — Showcase
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              ملخّص {year}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100 sm:text-base">
              نظرة شاملة على الدخل والمصروفات والادخار ومشروع البناء — شهر
              بشهر مع استنتاجات واضحة.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => router.push(`/showcase?year=${year - 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="rounded-xl bg-white/15 px-4 py-2 text-lg font-bold">
              {year}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => router.push(`/showcase?year=${year + 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "الدخل", value: totals.income, color: "text-emerald-300" },
            { label: "المصروفات", value: totals.expenses, color: "text-rose-300" },
            {
              label: "الصافي",
              value: totals.net,
              color: netPositive ? "text-emerald-300" : "text-amber-300",
            },
            { label: "الراتب", value: totals.salary, color: "text-blue-200" },
            { label: "يومي", value: totals.daily, color: "text-slate-200" },
            { label: "بناء", value: totals.build, color: "text-amber-200" },
            { label: "ادخار", value: totals.savings, color: "text-violet-200" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur-sm"
            >
              <p className="text-[10px] text-indigo-200 sm:text-xs">{kpi.label}</p>
              <p className={`text-sm font-extrabold sm:text-base ${kpi.color}`}>
                {formatCurrency(kpi.value)}
              </p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Conclusion / Insights */}
      <Card className="border-indigo-100 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            الخلاصة والاستنتاجات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm leading-relaxed",
                INSIGHT_STYLES[insight.type]
              )}
            >
              {insight.text}
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-emerald-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              أفضل شهر
            </div>
            {data.highlights.bestNetMonth ? (
              <>
                <p className="mt-2 text-xl font-extrabold text-slate-900">
                  {data.highlights.bestNetMonth.label}
                </p>
                <p className="text-lg font-bold text-emerald-700">
                  {formatCurrency(data.highlights.bestNetMonth.net)}
                </p>
                <Link
                  href={`/dashboard?year=${year}&month=${data.highlights.bestNetMonth.month}`}
                  className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                >
                  عرض تفاصيل الشهر ←
                </Link>
              </>
            ) : (
              <p className="mt-2 text-slate-500">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-rose-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <TrendingDown className="h-4 w-4 text-rose-700" />
              أصعب شهر
            </div>
            {data.highlights.worstNetMonth ? (
              <>
                <p className="mt-2 text-xl font-extrabold text-slate-900">
                  {data.highlights.worstNetMonth.label}
                </p>
                <p className="text-lg font-bold text-rose-700">
                  {formatCurrency(data.highlights.worstNetMonth.net)}
                </p>
                <Link
                  href={`/dashboard?year=${year}&month=${data.highlights.worstNetMonth.month}`}
                  className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                >
                  عرض تفاصيل الشهر ←
                </Link>
              </>
            ) : (
              <p className="mt-2 text-slate-500">—</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-amber-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ArrowUpRight className="h-4 w-4 text-amber-700" />
              أعلى إنفاق
            </div>
            {data.highlights.highestExpenseMonth ? (
              <>
                <p className="mt-2 text-xl font-extrabold text-slate-900">
                  {data.highlights.highestExpenseMonth.label}
                </p>
                <p className="text-lg font-bold text-amber-700">
                  {formatCurrency(data.highlights.highestExpenseMonth.expenses)}
                </p>
                <Link
                  href={`/dashboard?year=${year}&month=${data.highlights.highestExpenseMonth.month}`}
                  className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                >
                  عرض تفاصيل الشهر ←
                </Link>
              </>
            ) : (
              <p className="mt-2 text-slate-500">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الدخل vs المصروفات — شهرياً</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? ""
                  }
                />
                <Legend />
                <Bar dataKey="income" name="الدخل" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="المصروفات" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الصافي التراكمي</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeNet} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} angle={-35} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="الصافي التراكمي"
                  stroke="#6366f1"
                  fill="url(#netGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly table */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarRange className="h-5 w-5" />
            ملخّص الأشهر ({data.activeMonthsCount} نشط)
          </CardTitle>
          <p className="text-sm text-slate-500">
            متوسط: دخل {formatCurrency(data.averages.income)} · مصروف{" "}
            {formatCurrency(data.averages.expenses)}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-right text-xs text-slate-500">
                <th className="pb-3 pr-2 font-medium">الشهر</th>
                <th className="pb-3 font-medium">الدخل</th>
                <th className="pb-3 font-medium">المصروفات</th>
                <th className="pb-3 font-medium">يومي</th>
                <th className="pb-3 font-medium">بناء</th>
                <th className="pb-3 font-medium">ادخار</th>
                <th className="pb-3 pl-2 font-medium">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((m) => (
                <tr
                  key={m.month}
                  className={cn(
                    "border-b border-slate-50 transition-colors hover:bg-slate-50/80",
                    !m.hasActivity && "opacity-40"
                  )}
                >
                  <td className="py-3 pr-2">
                    <Link
                      href={`/dashboard?year=${year}&month=${m.month}`}
                      className="font-semibold text-indigo-700 hover:underline"
                    >
                      {m.label}
                    </Link>
                  </td>
                  <td className="py-3 font-medium text-emerald-700">
                    {m.income > 0 ? formatCurrency(m.income) : "—"}
                  </td>
                  <td className="py-3 font-medium text-rose-700">
                    {m.expenses > 0 ? formatCurrency(m.expenses) : "—"}
                  </td>
                  <td className="py-3 text-slate-600">
                    {m.daily > 0 ? formatCurrency(m.daily) : "—"}
                  </td>
                  <td className="py-3 text-amber-700">
                    {m.build > 0 ? formatCurrency(m.build) : "—"}
                  </td>
                  <td className="py-3 text-violet-700">
                    {m.savings > 0 ? formatCurrency(m.savings) : "—"}
                  </td>
                  <td className="py-3 pl-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-bold",
                        m.net >= 0 ? "text-emerald-700" : "text-rose-700"
                      )}
                    >
                      {m.net >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {m.hasActivity ? formatCurrency(m.net) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td className="rounded-br-xl py-3 pr-2 font-bold">الإجمالي</td>
                <td className="py-3 font-bold">{formatCurrency(totals.income)}</td>
                <td className="py-3 font-bold">{formatCurrency(totals.expenses)}</td>
                <td className="py-3">{formatCurrency(totals.daily)}</td>
                <td className="py-3">{formatCurrency(totals.build)}</td>
                <td className="py-3">{formatCurrency(totals.savings)}</td>
                <td className="rounded-bl-xl py-3 pl-2 font-bold">
                  {formatCurrency(totals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Breakdown row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">مصادر الدخل — السنة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-48 w-full sm:w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.incomeBySource}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                    >
                      {data.incomeBySource.map((s) => (
                        <Cell key={s.id} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {data.incomeBySource.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatCurrency(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المصروفات حسب الفئة — السنة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.expensesByCategory.slice(0, 8).map((cat, i) => {
              const pct =
                totals.expenses > 0
                  ? Math.round((cat.amount / totals.expenses) * 100)
                  : 0;
              return (
                <div key={cat.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{cat.name}</span>
                    <span className="font-bold">{formatCurrency(cat.amount)}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Salary + Savings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-indigo-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5" />
              الراتب — {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "إجمالي (ברוטו)", value: data.salaryAnnual.gross },
              { label: "صافي (נטו)", value: data.salaryAnnual.net },
              { label: "ضريبة", value: data.salaryAnnual.tax },
              { label: "تقاعد", value: data.salaryAnnual.pension },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-indigo-50/80 p-3">
                <p className="text-xs text-slate-500">{row.label}</p>
                <p className="font-bold text-indigo-900">
                  {formatCurrency(row.value)}
                </p>
              </div>
            ))}
            <p className="col-span-2 text-xs text-slate-500">
              {data.salaryAnnual.monthsWithSlips} أشهر بكشوف راتب مسجّلة
            </p>
          </CardContent>
        </Card>

        <Card className="border-violet-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-5 w-5" />
              خطط الادخار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.savingsPlans.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد خطط ادخار</p>
            ) : (
              data.savingsPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-violet-100 bg-violet-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900">{plan.title}</p>
                    <Badge variant="default">{plan.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatCurrency(plan.monthlyContribution)}/شهر
                    {plan.targetAmount &&
                      ` · هدف ${formatCurrency(plan.targetAmount)}`}
                  </p>
                </div>
              ))
            )}
            <Link href="/savings" className="text-sm text-violet-700 hover:underline">
              إدارة الادخار ←
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Building */}
      {data.building && (
        <Card className="overflow-hidden border-amber-100">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-amber-700" />
              مشروع البناء — {data.building.title}
            </CardTitle>
            <Link href={`/projects/${data.building.id}`}>
              <Button size="sm" variant="outline">
                فتح المشروع
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "الميزانية", value: data.building.totalBudget },
                { label: "المدفوع", value: data.building.paidToDate },
                { label: "المتبقي", value: data.building.remaining },
                {
                  label: "الإنجاز",
                  value: `${data.building.percentComplete}%`,
                  isText: true,
                },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-amber-50/80 p-3">
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <p className="font-extrabold text-amber-900">
                    {"isText" in k && k.isText
                      ? k.value
                      : formatCurrency(k.value as number)}
                  </p>
                </div>
              ))}
            </div>
            <Progress value={data.building.percentComplete} className="h-2" />
            <p className="text-sm text-slate-600">
              {data.building.contractorsCount} مقاول ·{" "}
              {data.building.pendingInstallments} دفعة قادمة
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.building.contractors.map((c) => (
                <Link
                  key={c.id}
                  href={`/projects/${c.id}`}
                  className="rounded-xl border border-slate-100 p-3 transition hover:border-amber-200 hover:bg-amber-50/30"
                >
                  <p className="truncate font-semibold text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(c.paid)} / {formatCurrency(c.totalBudget)}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          هذا التقرير يجمع بيانات {year} من جميع المعاملات والرواتب ومشروع
          البناء.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard?year=${year}`}>لوحة الشهر الحالي</Link>
          </Button>
          <Button asChild>
            <Link href="/transactions">جميع المعاملات</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
