"use client";

import { motion } from "framer-motion";
import { formatILS } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Kpis = {
  income: number;
  dailyExpenses: number;
  buildExpenses: number;
  savings: number;
  net: number;
  dailyExpensesDeltaPct: number;
  budgetProgress: number;
  activeJamiya: number;
};

const cards = [
  {
    key: "income",
    label: "الدخل",
    emoji: "💰",
    color: "text-[#10B981]",
    border: "border-emerald-100",
    getValue: (k: Kpis) => k.income,
    sub: () => "هذا الشهر",
  },
  {
    key: "daily",
    label: "المصروفات اليومية",
    emoji: "🛒",
    color: "text-[#EF4444]",
    border: "border-red-100",
    getValue: (k: Kpis) => k.dailyExpenses,
    sub: (k: Kpis) =>
      k.dailyExpensesDeltaPct !== 0
        ? `${k.dailyExpensesDeltaPct > 0 ? "▲" : "▼"} ${Math.abs(k.dailyExpensesDeltaPct)}%`
        : "مستقر",
  },
  {
    key: "build",
    label: "مصروفات البناء",
    emoji: "🏗️",
    color: "text-[#8B5CF6]",
    border: "border-violet-100",
    getValue: (k: Kpis) => k.buildExpenses,
    sub: (k: Kpis) => `${k.budgetProgress}% من الميزانية`,
  },
  {
    key: "savings",
    label: "الادخارات",
    emoji: "💎",
    color: "text-[#14B8A6]",
    border: "border-teal-100",
    getValue: (k: Kpis) => k.savings,
    sub: (k: Kpis) => `${k.activeJamiya} جمعيات نشطة`,
  },
  {
    key: "net",
    label: "الصافي",
    emoji: "📈",
    color: "text-gray-900",
    border: "border-gray-100",
    getValue: (k: Kpis) => k.net,
    sub: (k: Kpis) => (k.net >= 0 ? "فائض" : "عجز"),
  },
] as const;

export function KpiRow({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
        >
          <Card className={card.border}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{card.emoji}</span>
                <span>{card.label}</span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${card.color}`}>
                {formatILS(card.getValue(kpis))}
              </p>
              <p className="mt-1 text-xs text-gray-500">{card.sub(kpis)}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
