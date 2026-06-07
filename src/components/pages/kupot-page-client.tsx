"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Landmark, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SavingsTabs } from "@/components/savings/savings-tabs";

export type KupotPageData = {
  summary: {
    pensionTotal: number;
    kerenTotal: number;
    kupotTotal: number;
    employerCount: number;
  };
  employers: {
    id: string;
    name: string;
    color: string | null;
    pensionTotal: number;
    kerenTotal: number;
    kupotTotal: number;
    latestPension: number;
    latestKeren: number;
    latestMonth: { year: number; month: number } | null;
    monthlyHistory: {
      year: number;
      month: number;
      label: string;
      pension: number;
      keren: number;
      total: number;
    }[];
  }[];
};

export function KupotPageClient({ data }: { data: KupotPageData }) {
  const { summary, employers } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/savings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowRight className="h-4 w-4" />
          الجمعية والادخار
        </Link>
        <h1 className="text-2xl font-extrabold">קופות — פנסיה וקרן השתלמות</h1>
        <p className="mt-1 text-sm text-slate-500">
          أموال في صناديق العمل — ليست نقداً في اليد، لكنها جزء من ثروتك المتراكمة
        </p>
      </div>

      <SavingsTabs />

      {/* Grand totals */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "פנסיה מتراكمة",
            sub: "סה״כ מכל העבודות",
            value: summary.pensionTotal,
            color: "text-violet-700",
            bg: "bg-violet-50",
            icon: Landmark,
          },
          {
            label: "קרן השתלמות",
            sub: "סה״כ מכל העבודות",
            value: summary.kerenTotal,
            color: "text-indigo-700",
            bg: "bg-indigo-50",
            icon: Wallet,
          },
          {
            label: "إجمالي הקופות",
            sub: `${summary.employerCount} جهة عمل`,
            value: summary.kupotTotal,
            color: "text-emerald-700",
            bg: "bg-emerald-50",
            icon: Building2,
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl p-2.5 ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{kpi.label}</p>
                    <p className="text-xs text-slate-500">{kpi.sub}</p>
                  </div>
                </div>
                <p className={`mt-4 text-3xl font-extrabold ${kpi.color}`}>
                  {formatCurrency(kpi.value)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {employers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            لا توجد נתוני קופות بعد — أضف תלושי שכר من صفحة الراتب
          </CardContent>
        </Card>
      ) : (
        employers.map((emp, idx) => (
          <motion.div
            key={emp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: emp.color ?? "#6366f1" }}
                    />
                    {emp.name}
                  </CardTitle>
                  <p className="text-2xl font-extrabold text-violet-700">
                    {formatCurrency(emp.kupotTotal)}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                {/* Two clear stat blocks */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
                    <p className="text-sm font-semibold text-violet-800">
                      פנסיה מتراكمة
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-violet-900">
                      {formatCurrency(emp.pensionTotal)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <p className="text-sm font-semibold text-indigo-800">
                      קרן השתלמות
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-indigo-900">
                      {formatCurrency(emp.kerenTotal)}
                    </p>
                  </div>
                </div>

                {(emp.latestPension > 0 || emp.latestKeren > 0) && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">آخر شهر: </span>
                    פנסיה {formatCurrency(emp.latestPension)}
                    <span className="mx-2 text-slate-300">·</span>
                    קרן {formatCurrency(emp.latestKeren)}
                    {emp.latestMonth && (
                      <span className="mr-2 text-slate-500">
                        ({emp.latestMonth.month}/{emp.latestMonth.year})
                      </span>
                    )}
                  </div>
                )}

                {/* Monthly history table */}
                {emp.monthlyHistory.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-800">
                      السجل الشهري
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-right">
                            <th className="px-4 py-2.5 font-semibold text-slate-600">
                              الشهر
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-violet-700">
                              פנסיה
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-indigo-700">
                              קרן השתלמות
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-slate-800">
                              סה״כ
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.monthlyHistory.map((row) => (
                            <tr
                              key={`${row.year}-${row.month}`}
                              className="border-b border-slate-50 last:border-0"
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-900">
                                {row.label}
                              </td>
                              <td className="px-4 py-2.5 text-violet-800">
                                {formatCurrency(row.pension)}
                              </td>
                              <td className="px-4 py-2.5 text-indigo-800">
                                {formatCurrency(row.keren)}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold">
                            <td className="px-4 py-2.5 text-slate-800">المجموع</td>
                            <td className="px-4 py-2.5 text-violet-800">
                              {formatCurrency(emp.pensionTotal)}
                            </td>
                            <td className="px-4 py-2.5 text-indigo-800">
                              {formatCurrency(emp.kerenTotal)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-900">
                              {formatCurrency(emp.kupotTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </div>
  );
}
