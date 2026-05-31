"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Calendar, Hammer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { BuildingPaymentSheet } from "@/components/forms/building-payment-sheet";

type Summary = {
  master: {
    id: string;
    title: string;
    totalBudget: number;
    paidToDate: number;
    remaining: number;
    percentComplete: number;
    imageUrl: string | null;
  };
  contractors: {
    id: string;
    title: string;
    profession: string | null;
    status: string;
    totalBudget: number;
    paid: number;
    remaining: number;
    pendingCount: number;
  }[];
  upcomingInstallments: {
    id: string;
    contractorId: string;
    contractorName: string;
    profession: string | null;
    sequence: number;
    label: string;
    dueDate: string;
    amount: number;
  }[];
  chart: { paid: number; remaining: number };
};

export function BuildingDashboardClient({
  summary,
  paymentMethods,
}: {
  summary: Summary;
  paymentMethods: { id: string; name: string }[];
}) {
  const pieData = useMemo(
    () => [
      { name: "مدفوع", value: summary.chart.paid, fill: "#059669" },
      { name: "متبقي", value: summary.chart.remaining, fill: "#e2e8f0" },
    ],
    [summary.chart]
  );

  const barData = summary.contractors.map((c) => ({
    name: c.title.slice(0, 12),
    paid: c.paid,
    remaining: c.remaining,
  }));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl"
        style={{ perspective: "1000px" }}
      >
        <div className="relative h-40 sm:h-48">
          <Image
            src={summary.master.imageUrl ?? "/placeholders/banner.svg"}
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
          <div className="absolute bottom-4 right-4 left-4 text-white">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <Building2 className="h-4 w-4" />
              مشروع البناء
            </div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{summary.master.title}</h1>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "الميزانية", value: summary.master.totalBudget, color: "text-slate-900" },
          { label: "المدفوع", value: summary.master.paidToDate, color: "text-emerald-700" },
          { label: "المتبقي", value: summary.master.remaining, color: "text-amber-700" },
          { label: "نسبة الإنجاز", value: `${summary.master.percentComplete}%`, color: "text-indigo-700" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="transform-gpu shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className={`text-2xl font-extrabold ${kpi.color}`}>
                  {typeof kpi.value === "number" ? formatCurrency(kpi.value) : kpi.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الميزانية — مدفوع vs متبقي</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المقاولون — حسب الإنفاق</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="paid" stackId="a" fill="#059669" radius={[0, 4, 4, 0]} />
                <Bar dataKey="remaining" stackId="a" fill="#fca5a5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {summary.upcomingInstallments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              الدفعات القادمة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.upcomingInstallments.slice(0, 8).map((inst) => (
              <div
                key={inst.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/projects/${inst.contractorId}`}
                    className="font-bold text-slate-900 hover:underline"
                  >
                    {inst.contractorName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {inst.label} · {inst.dueDate}
                    {inst.profession && ` · ${inst.profession}`}
                  </p>
                </div>
                <p className="font-extrabold text-amber-700">
                  {formatCurrency(inst.amount)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            المقاولون والموردون
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.contractors.map((c) => {
            const pct =
              c.totalBudget > 0 ? Math.round((c.paid / c.totalBudget) * 100) : 0;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-100 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/projects/${c.id}`} className="font-bold text-slate-900 hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.profession && `${c.profession} · `}
                      {c.status} · {c.pendingCount} أقساط معلّقة
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-emerald-700">
                      {formatCurrency(c.paid)}
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm text-slate-600">
                      {formatCurrency(c.totalBudget)}
                    </span>
                    <BuildingPaymentSheet
                      projectId={c.id}
                      projectTitle={c.title}
                      paymentMethods={paymentMethods}
                      defaultTotal={c.remaining}
                    />
                  </div>
                </div>
                <Progress value={pct} className="mt-3 h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
