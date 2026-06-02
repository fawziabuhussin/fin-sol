"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Hammer,
  Play,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import { projectStatusLabel } from "@/lib/finance-labels";
import {
  BuildingPaymentSheet,
  type ExistingPaymentPlan,
} from "@/components/forms/building-payment-sheet";
import { isContractorFullyPaid } from "@/lib/project-completion-utils";

type Contractor = {
  id: string;
  title: string;
  profession: string | null;
  status: string;
  targetDate: string | null;
  totalBudget: number;
  paid: number;
  remaining: number;
  pendingCount: number;
  paymentPlan: ExistingPaymentPlan | null;
};

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
  contractors: Contractor[];
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

function ContractorCard({
  c,
  paymentMethods,
  onStatusChange,
  isPending,
}: {
  c: Contractor;
  paymentMethods: { id: string; name: string }[];
  onStatusChange: (id: string, status: string) => void;
  isPending: boolean;
}) {
  const isPlanned = c.status === "PLANNED";
  const isCompleted = c.status === "COMPLETED";
  const pct =
    c.totalBudget > 0
      ? Math.min(100, Math.round((c.paid / c.totalBudget) * 100))
      : 0;
  const canMarkComplete =
    !isPlanned &&
    !isCompleted &&
    c.status === "ACTIVE" &&
    isContractorFullyPaid(c.paid, c.totalBudget) &&
    c.pendingCount === 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-sm transition",
        isPlanned
          ? "border-dashed border-indigo-200 bg-indigo-50/30"
          : isCompleted
            ? "border-emerald-100 bg-emerald-50/30"
            : "border-slate-100 bg-white"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/projects/${c.id}`}
              className="font-bold text-slate-900 hover:underline"
            >
              {c.title}
            </Link>
            <Badge
              variant={
                isPlanned
                  ? "warning"
                  : isCompleted
                    ? "default"
                    : c.status === "ACTIVE"
                      ? "success"
                      : "default"
              }
            >
              {projectStatusLabel(c.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {c.profession && `${c.profession} · `}
            {isPlanned
              ? c.targetDate
                ? `يبدأ ${c.targetDate}`
                : "لم يُحدد تاريخ البداية بعد"
              : `${c.pendingCount} أقساط معلّقة`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isPlanned && (
            <>
              <span className="text-sm font-bold text-emerald-700">
                {formatCurrency(c.paid)}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-sm text-slate-600">
                {formatCurrency(c.totalBudget)}
              </span>
            </>
          )}
          {isPlanned ? (
            <span className="text-sm font-semibold text-indigo-700">
              {formatCurrency(c.totalBudget)}
            </span>
          ) : (
            <BuildingPaymentSheet
              projectId={c.id}
              projectTitle={c.title}
              paymentMethods={paymentMethods}
              defaultTotal={c.remaining > 0 ? c.remaining : c.totalBudget}
              defaultPayee={c.title}
              existingPlan={c.paymentPlan}
              triggerLabel={
                c.paymentPlan
                  ? isCompleted
                    ? "زيادة الميزانية"
                    : "تعديل خطة الدفع"
                  : "خطة دفع"
              }
            />
          )}
          {isPlanned ? (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => onStatusChange(c.id, "ACTIVE")}
            >
              <Play className="h-4 w-4" /> بدء التنفيذ
            </Button>
          ) : isCompleted ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => onStatusChange(c.id, "ACTIVE")}
            >
              <RotateCcw className="h-4 w-4" /> إعادة فتح
            </Button>
          ) : (
            <>
              {canMarkComplete && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => onStatusChange(c.id, "COMPLETED")}
                >
                  <CheckCircle2 className="h-4 w-4" /> تم الإنجاز
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onStatusChange(c.id, "PLANNED")}
              >
                <Clock className="h-4 w-4" /> للمستقبل
              </Button>
            </>
          )}
        </div>
      </div>
      {!isPlanned && <Progress value={pct} className="mt-3 h-2" />}
    </div>
  );
}

export function BuildingDashboardClient({
  summary,
  paymentMethods,
}: {
  summary: Summary;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const { activeContractors, completedContractors, plannedContractors } =
    useMemo(() => {
      const planned = summary.contractors.filter((c) => c.status === "PLANNED");
      const completed = summary.contractors.filter(
        (c) => c.status === "COMPLETED"
      );
      const active = summary.contractors.filter(
        (c) =>
          c.status !== "PLANNED" &&
          c.status !== "COMPLETED" &&
          c.status !== "CANCELLED"
      );
      return {
        activeContractors: active,
        completedContractors: completed,
        plannedContractors: planned,
      };
    }, [summary.contractors]);

  const setStatus = (id: string, status: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("فشل تحديث الحالة");
        return;
      }
      const messages: Record<string, string> = {
        PLANNED: "تم نقله للمستقبل",
        ACTIVE: "تم إعادة فتح المشروع",
        COMPLETED: "تم نقله إلى المكتملة",
      };
      toast.success(messages[status] ?? "تم تحديث الحالة");
      router.refresh();
    });
  };

  const pieData = useMemo(
    () => [
      { name: "مدفوع", value: summary.chart.paid, fill: "#059669" },
      { name: "متبقي", value: summary.chart.remaining, fill: "#e2e8f0" },
    ],
    [summary.chart]
  );

  const barData = activeContractors.map((c) => ({
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
            <CardTitle>المقاولون النشطون — حسب الإنفاق</CardTitle>
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
              الدفعات القادمة (قيد التنفيذ فقط)
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

      {activeContractors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hammer className="h-5 w-5" />
              قيد التنفيذ ({activeContractors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeContractors.map((c) => (
              <ContractorCard
                key={c.id}
                c={c}
                paymentMethods={paymentMethods}
                onStatusChange={setStatus}
                isPending={isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {completedContractors.length > 0 && (
        <Card className="border-emerald-100 bg-emerald-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="h-5 w-5" />
              مكتملة ({completedContractors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-emerald-800/80">
              لإضافة ميزانية جديدة وإرجاع المقاول لقيد التنفيذ، استخدم «زيادة
              الميزانية» أو «إعادة فتح».
            </p>
            {completedContractors.map((c) => (
              <ContractorCard
                key={c.id}
                c={c}
                paymentMethods={paymentMethods}
                onStatusChange={setStatus}
                isPending={isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {plannedContractors.length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <Clock className="h-5 w-5" />
              مخطط للمستقبل ({plannedContractors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-indigo-800/80">
              هذه البنود لا تُحتسب في الدفعات القادمة حتى تضغط «بدء التنفيذ».
              حدّد تاريخ البداية من صفحة المشروع.
            </p>
            {plannedContractors.map((c) => (
              <ContractorCard
                key={c.id}
                c={c}
                paymentMethods={paymentMethods}
                onStatusChange={setStatus}
                isPending={isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
