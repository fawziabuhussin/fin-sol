"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { Building2, Landmark, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SavingsTabs } from "@/components/savings/savings-tabs";

export type KupotPageData = {
  summary: {
    pensionTotal: number;
    kerenTotal: number;
    employeeTotal: number;
    employerTotal: number;
    kupotTotal: number;
    employerCount: number;
  };
  employers: {
    id: string;
    name: string;
    color: string | null;
    pensionTotal: number;
    kerenTotal: number;
    employeeTotal: number;
    employerTotal: number;
    kupotTotal: number;
    latestPension: number;
    latestKeren: number;
    latestEmployerTotal: number;
    latestMonth: { year: number; month: number } | null;
    monthlyHistory: {
      year: number;
      month: number;
      label: string;
      pension: number;
      keren: number;
      pensionEmployer: number;
      kerenEmployer: number;
      employeeTotal: number;
      employerTotal: number;
      total: number;
      paid: boolean;
      paidAt: string | null;
      breakdown: {
        pension?: {
          lines?: {
            fund?: string;
            type?: string;
            employee: number;
            employer: number;
            base?: number;
          }[];
        };
        keren?: { employee: number; employer: number };
      } | null;
    }[];
  }[];
};

export function KupotPageClient({ data }: { data: KupotPageData }) {
  const { summary, employers } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">الجمعية والادخار</h1>
        <p className="mt-1 text-sm text-slate-500">
          קופות — פנסיה וקרן השתלמות · חלקך + חלק המעסיק (חודשים שסומנו כ־✓ שולם)
        </p>
      </div>

      <SavingsTabs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "חלק העובד",
            sub: "ניכוי מהשכר",
            value: summary.employeeTotal,
            color: "text-violet-700",
            bg: "bg-violet-50",
            icon: Wallet,
          },
          {
            label: "חלק המעסיק",
            sub: "הפרשות מעבודה",
            value: summary.employerTotal,
            color: "text-indigo-700",
            bg: "bg-indigo-50",
            icon: Users,
          },
          {
            label: "פנסיה (כולל)",
            sub: "עובד + מעסיק",
            value: summary.pensionTotal,
            color: "text-purple-700",
            bg: "bg-purple-50",
            icon: Landmark,
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
                <p className={`mt-4 text-2xl font-extrabold sm:text-3xl ${kpi.color}`}>
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
                    <p className="text-sm font-semibold text-violet-800">חלקך</p>
                    <p className="mt-2 text-2xl font-extrabold text-violet-900">
                      {formatCurrency(emp.employeeTotal)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                    <p className="text-sm font-semibold text-indigo-800">חלק המעסיק</p>
                    <p className="mt-2 text-2xl font-extrabold text-indigo-900">
                      {formatCurrency(emp.employerTotal)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                    <p className="text-sm font-semibold text-emerald-800">סה״כ</p>
                    <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                      {formatCurrency(emp.kupotTotal)}
                    </p>
                  </div>
                </div>

                {emp.latestMonth && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">آخر شهر: </span>
                    עובד {formatCurrency(emp.latestPension + emp.latestKeren)}
                    <span className="mx-2 text-slate-300">·</span>
                    מעסיק {formatCurrency(emp.latestEmployerTotal)}
                    <span className="mr-2 text-slate-500">
                      ({emp.latestMonth.month}/{emp.latestMonth.year})
                    </span>
                  </div>
                )}

                {emp.monthlyHistory.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-slate-800">
                      السجل الشهري
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-right">
                            <th className="px-4 py-2.5 font-semibold text-slate-600">
                              الشهر
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-violet-700">
                              חלקך
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-indigo-700">
                              חלק המעסיק
                            </th>
                            <th className="px-4 py-2.5 font-semibold text-slate-800">
                              סה״כ
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.monthlyHistory.map((row) => {
                            const lines = row.breakdown?.pension?.lines ?? [];
                            return (
                              <Fragment key={`${row.year}-${row.month}`}>
                                <tr className="border-b border-slate-50">
                                  <td className="px-4 py-2.5 font-medium text-slate-900">
                                    {row.label}
                                    {row.paidAt && (
                                      <span className="mr-2 block text-[10px] text-emerald-600">
                                        ✓ {row.paidAt}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-violet-800">
                                    {formatCurrency(row.employeeTotal)}
                                  </td>
                                  <td className="px-4 py-2.5 text-indigo-800">
                                    {formatCurrency(row.employerTotal)}
                                  </td>
                                  <td className="px-4 py-2.5 font-bold text-slate-900">
                                    {formatCurrency(row.total)}
                                  </td>
                                </tr>
                                {lines.length > 0 &&
                                  lines.map((line, li) => (
                                    <tr
                                      key={`${row.year}-${row.month}-line-${li}`}
                                      className="border-b border-slate-50 bg-slate-50/50 text-xs last:border-0"
                                    >
                                      <td className="px-4 py-1.5 pr-8 text-slate-600">
                                        {line.type}
                                        {line.fund ? ` · ${line.fund}` : ""}
                                      </td>
                                      <td className="px-4 py-1.5 text-violet-700">
                                        {line.employee > 0
                                          ? formatCurrency(line.employee)
                                          : "—"}
                                      </td>
                                      <td className="px-4 py-1.5 text-indigo-700">
                                        {formatCurrency(line.employer)}
                                      </td>
                                      <td className="px-4 py-1.5 text-slate-600">
                                        {line.base
                                          ? `בסיס ${line.base.toLocaleString("ar-IL")} ₪`
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold">
                            <td className="px-4 py-2.5 text-slate-800">المجموع</td>
                            <td className="px-4 py-2.5 text-violet-800">
                              {formatCurrency(emp.employeeTotal)}
                            </td>
                            <td className="px-4 py-2.5 text-indigo-800">
                              {formatCurrency(emp.employerTotal)}
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
