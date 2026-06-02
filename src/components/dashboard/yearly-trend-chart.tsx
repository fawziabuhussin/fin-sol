"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AR_MONTHS } from "@/lib/finance-labels";
import { formatCurrency, cn } from "@/lib/utils";

export type YearlyTrendPoint = {
  month: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  savings?: number;
  netAfterSavings?: number;
  salary: number;
  expensesAdjusted?: boolean;
};

type ChartRow = YearlyTrendPoint & { shortLabel: string };

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);
  return isMobile;
}

function shortMonthLabel(month: number) {
  const full = AR_MONTHS[month - 1] ?? "";
  if (!full) return "";
  return full.length <= 4 ? full : `${full.slice(0, 3)}`;
}

function formatAxisTick(value: number) {
  const n = Number(value);
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; payload?: ChartRow }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  const income = Number(
    payload.find((p) => p.dataKey === "income")?.value ?? row?.income ?? 0
  );
  const expenses = Number(
    payload.find((p) => p.dataKey === "expenses")?.value ?? row?.expenses ?? 0
  );
  const savings = Number(row?.savings ?? 0);
  const net = row?.net ?? income - expenses;

  return (
    <div className="max-w-[min(100vw-2rem,16rem)] rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xl ring-1 ring-black/5">
      <p className="mb-2 text-sm font-bold text-slate-900">{row?.label ?? label}</p>
      <div className="space-y-2 text-sm">
        <TooltipRow color="bg-emerald-500" label="الدخل" value={income} valueClass="text-emerald-700" />
        <TooltipRow color="bg-rose-500" label="المصروفات" value={expenses} valueClass="text-rose-700" />
        {savings > 0 && (
          <TooltipRow
            color="bg-violet-500"
            label="الادخار"
            value={savings}
            valueClass="text-violet-700"
          />
        )}
        <div className="border-t border-slate-100 pt-2">
          <TooltipRow
            color="bg-indigo-500"
            label="الصافي"
            value={net}
            valueClass={net >= 0 ? "text-indigo-700" : "text-amber-700"}
            signed
          />
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
  valueClass,
  signed,
}: {
  color: string;
  label: string;
  value: number;
  valueClass: string;
  signed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />
        {label}
      </span>
      <span className={cn("font-bold tabular-nums", valueClass)}>
        {signed && value >= 0 ? "+" : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}

type LegendItem = {
  key: string;
  label: string;
  dot: string;
  line?: boolean;
  mobileHidden?: boolean;
};

const LEGEND_ITEMS: LegendItem[] = [
  { key: "income", label: "الدخل", dot: "bg-emerald-500" },
  { key: "expenses", label: "المصروف", dot: "bg-rose-500" },
  { key: "savings", label: "الادخار", dot: "bg-violet-500", mobileHidden: true },
  { key: "net", label: "الصافي", dot: "bg-indigo-500 ring-2 ring-indigo-200", line: true },
];

function ChartLegend({ mobile }: { mobile: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap justify-center gap-x-4 gap-y-2",
        mobile ? "gap-x-3 gap-y-1.5 px-1" : "gap-x-5"
      )}
    >
      {LEGEND_ITEMS.filter((item) => !(mobile && item.mobileHidden)).map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 sm:text-xs"
        >
          <span
            className={cn(
              item.line ? "h-0.5 w-4 rounded-full" : "h-2 w-2 rounded-full",
              item.dot
            )}
          />
          {item.label}
        </span>
      ))}
      {mobile && (
        <span className="w-full text-center text-[10px] text-slate-400">
          الادخار يظهر عند لمس العمود
        </span>
      )}
    </div>
  );
}

function KpiStrip({
  totals,
}: {
  totals: { income: number; expenses: number; savings: number; net: number };
}) {
  const items = [
    { label: "دخل السنة", value: totals.income, color: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-100" },
    { label: "مصروفات", value: totals.expenses, color: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-100" },
    { label: "ادخار", value: totals.savings, color: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-100" },
    {
      label: "الصافي",
      value: totals.net,
      color: totals.net >= 0 ? "text-indigo-700" : "text-amber-700",
      bg: totals.net >= 0 ? "bg-indigo-50" : "bg-amber-50",
      ring: totals.net >= 0 ? "ring-indigo-100" : "ring-amber-100",
    },
  ];

  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto pb-0.5 snap-x snap-mandatory px-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {items.map((kpi) => (
        <div
          key={kpi.label}
          className={cn(
            "snap-start shrink-0 rounded-2xl px-3.5 py-2.5 ring-1 sm:shrink sm:min-w-0",
            "min-w-[42%] max-w-[48%] sm:max-w-none",
            kpi.bg,
            kpi.ring
          )}
        >
          <p className="text-[11px] font-medium text-slate-500 sm:text-xs">{kpi.label}</p>
          <p className={cn("text-base font-extrabold tabular-nums sm:text-lg", kpi.color)}>
            {formatCurrency(kpi.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function YearlyTrendChart({
  data,
  year,
}: {
  data: YearlyTrendPoint[];
  year: number;
}) {
  const isMobile = useIsMobile();

  const chartData: ChartRow[] = useMemo(
    () =>
      data.map((m) => ({
        ...m,
        shortLabel: shortMonthLabel(m.month),
      })),
    [data]
  );

  const totals = data.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + (m.savings ?? 0),
      net: acc.net + m.net,
    }),
    { income: 0, expenses: 0, savings: 0, net: 0 }
  );

  const activeMonths = data.filter(
    (m) => m.income > 0 || m.expenses > 0 || (m.savings ?? 0) > 0
  ).length;

  const lastLabel = data[data.length - 1]?.label ?? "—";
  const showSavingsBar = !isMobile;

  return (
    <div className="space-y-3 sm:space-y-4">
      <KpiStrip totals={totals} />

      <ChartLegend mobile={isMobile} />

      <div
        className={cn(
          "relative w-full min-w-0 overflow-hidden rounded-2xl",
          "bg-gradient-to-b from-slate-50/90 to-white",
          "ring-1 ring-slate-100",
          isMobile ? "h-[min(58vw,280px)] min-h-[240px]" : "h-[320px]"
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={
              isMobile
                ? { top: 8, right: 6, left: -6, bottom: 0 }
                : { top: 16, right: 12, left: 8, bottom: 8 }
            }
            barGap={isMobile ? 2 : 4}
            barCategoryGap={isMobile ? "22%" : "18%"}
          >
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                <stop offset="100%" stopColor="#e11d48" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 6"
              stroke="#e2e8f0"
              vertical={false}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
            <XAxis
              dataKey={isMobile ? "shortLabel" : "label"}
              tick={{
                fontSize: isMobile ? 10 : 11,
                fill: "#64748b",
                fontWeight: 500,
              }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              interval={0}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              tick={{ fontSize: isMobile ? 9 : 10, fill: "#94a3b8" }}
              tickFormatter={formatAxisTick}
              width={isMobile ? 28 : 44}
              axisLine={false}
              tickLine={false}
              tickCount={isMobile ? 5 : 6}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "#f1f5f9", radius: 8 }}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
            />
            <Bar
              dataKey="income"
              name="الدخل"
              fill="url(#incomeGrad)"
              radius={[isMobile ? 4 : 6, isMobile ? 4 : 6, 0, 0]}
              maxBarSize={isMobile ? 14 : 22}
            />
            <Bar
              dataKey="expenses"
              name="المصروفات"
              fill="url(#expenseGrad)"
              radius={[isMobile ? 4 : 6, isMobile ? 4 : 6, 0, 0]}
              maxBarSize={isMobile ? 14 : 22}
            />
            {showSavingsBar && (
              <Bar
                dataKey="savings"
                name="الادخار"
                fill="url(#savingsGrad)"
                radius={[6, 6, 0, 0]}
                maxBarSize={18}
              />
            )}
            <Line
              type="monotone"
              dataKey="net"
              name="الصافي"
              stroke="#6366f1"
              strokeWidth={isMobile ? 2 : 2.5}
              dot={
                isMobile
                  ? false
                  : {
                      r: 4,
                      fill: "#6366f1",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }
              }
              activeDot={{
                r: isMobile ? 5 : 6,
                fill: "#4f46e5",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
        <span className="font-medium text-slate-600">{year}</span>
        {" · "}
        حتى {lastLabel}
        {" · "}
        {activeMonths} أشهر
        {!isMobile && (
          <>
            {" · "}
            الأعمدة: دخل، مصروف، ادخار · الخط: الصافي
          </>
        )}
      </p>
    </div>
  );
}
