"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, AlertTriangle, TrendingUp, PieChart, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Insight = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  actionLabel?: string | null;
  actionHref?: string | null;
};

const iconByType: Record<string, React.ReactNode> = {
  LIQUIDITY_WARNING: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  INVESTMENT_OPPORTUNITY: <TrendingUp className="h-5 w-5 text-amber-500" />,
  BUDGET_ANOMALY: <PieChart className="h-5 w-5 text-indigo-600" />,
  TAX_SALARY_OPTIMIZATION: <Wallet className="h-5 w-5 text-indigo-600" />,
  BUILD_PAYMENT_DUE: <AlertTriangle className="h-5 w-5 text-red-600" />,
};

export function SmartInsightsFeed({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold">توصيات ذكية</span>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          لا توجد توصيات حالياً. سيتم تحليل بياناتك تلقائياً.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">توصيات ذكية</h2>
        </div>
        <Link
          href="/dashboard/insights"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          عرض الكل ←
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {insights.map((insight, i) => (
          <motion.article
            key={insight.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              "min-w-[280px] max-w-sm shrink-0 rounded-xl p-4 shadow-sm",
              insight.severity === "CRITICAL"
                ? "insight-gradient-warning"
                : "insight-gradient"
            )}
          >
            <div className="flex items-start gap-3">
              {iconByType[insight.type] ?? (
                <Sparkles className="h-5 w-5 text-indigo-500" />
              )}
              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {insight.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-600">
                  {insight.body}
                </p>
                {insight.actionLabel && insight.actionHref && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={insight.actionHref}>{insight.actionLabel}</Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
