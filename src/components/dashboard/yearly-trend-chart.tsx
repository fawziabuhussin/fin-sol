"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export type YearlyTrendPoint = {
  month: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  salary: number;
};

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
  payload?: { dataKey?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const income = Number(payload.find((p) => p.dataKey === "income")?.value ?? 0);
  const expenses = Number(
    payload.find((p) => p.dataKey === "expenses")?.value ?? 0
  );
  const net = income - expenses;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-sm font-bold text-slate-900">{label}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            الدخل
          </span>
          <span className="font-bold text-emerald-700">{formatCurrency(income)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
            المصروفات
          </span>
          <span className="font-bold text-rose-700">{formatCurrency(expenses)}</span>
        </div>
        <div className="mt-2 border-t border-slate-100 pt-2 flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-slate-600">
            <span className="h-0.5 w-3 rounded bg-indigo-500" />
            الصافي
          </span>
          <span
            className={`font-extrabold ${net >= 0 ? "text-indigo-700" : "text-amber-700"}`}
          >
            {net >= 0 ? "+" : ""}
            {formatCurrency(net)}
          </span>
        </div>
      </div>
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
  const totals = data.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      net: acc.net + m.net,
    }),
    { income: 0, expenses: 0, net: 0 }
  );

  const activeMonths = data.filter((m) => m.income > 0 || m.expenses > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {[
          { label: "دخل السنة", value: totals.income, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "مصروفات السنة", value: totals.expenses, color: "text-rose-700", bg: "bg-rose-50" },
          { label: "صافي السنة", value: totals.net, color: totals.net >= 0 ? "text-indigo-700" : "text-amber-700", bg: totals.net >= 0 ? "bg-indigo-50" : "bg-amber-50" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`flex-1 min-w-[120px] rounded-xl px-3 py-2 ${kpi.bg}`}
          >
            <p className="text-xs text-slate-600">{kpi.label}</p>
            <p className={`text-lg font-extrabold ${kpi.color}`}>
              {formatCurrency(kpi.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[300px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
            barGap={4}
            barCategoryGap="18%"
          >
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#e11d48" stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#e2e8f0"
              vertical={false}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={formatAxisTick}
              width={44}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.5 }} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-xs font-medium text-slate-600">{value}</span>
              )}
            />
            <Bar
              dataKey="income"
              name="الدخل"
              fill="url(#incomeGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              dataKey="expenses"
              name="المصروفات"
              fill="url(#expenseGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="الصافي"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{
                r: 4,
                fill: "#6366f1",
                stroke: "#fff",
                strokeWidth: 2,
              }}
              activeDot={{ r: 6, fill: "#4f46e5" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center text-xs text-slate-500">
        {year} · {activeMonths} أشهر بحركة مالية · الأعمدة: دخل ومصروف · الخط: الصافي الشهري
      </p>
    </div>
  );
}
