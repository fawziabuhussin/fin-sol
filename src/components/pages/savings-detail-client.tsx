"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Gift,
  PiggyBank,
  Save,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ScheduleRow = {
  sequence: number;
  periodYear: number;
  periodMonth: number;
  label: string;
  amount: number;
  paid: boolean;
  isPayout: boolean;
  paidAt: string | null;
  notes: string | null;
};

type SavingsDetail = {
  id: string;
  title: string;
  type: "JAMIYA" | "PERSONAL";
  status: string;
  monthlyContribution: number;
  targetAmount: number | null;
  durationMonths: number;
  startDate: string | null;
  payoutDate: string | null;
  notes: string | null;
  schedule: ScheduleRow[];
  summary: {
    paidTotal: number;
    scheduledTotal: number;
    paidCount: number;
    totalMonths: number;
    progress: number;
  };
};

function PaidCheckbox({
  planId,
  row,
}: {
  planId: string;
  row: ScheduleRow;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const res = await fetch(`/api/savings/${planId}/entries`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodYear: row.periodYear,
          periodMonth: row.periodMonth,
          amount: row.amount,
          paid: !row.paid,
          isPayout: row.isPayout,
        }),
      });
      if (!res.ok) {
        toast.error("تعذّر التحديث");
        return;
      }
      toast.success(row.paid ? "تم إلغاء الدفعة" : `تم تسجيل ${row.label}`);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={row.paid ? "إلغاء" : "تأكيد الدفع"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
        row.paid
          ? "border-violet-600 bg-violet-600 text-white"
          : "border-slate-300 bg-white text-transparent hover:border-violet-400 hover:text-violet-300",
        isPending && "opacity-50"
      )}
    >
      <Check className="h-5 w-5" strokeWidth={3} />
    </button>
  );
}

export function SavingsDetailClient({ detail }: { detail: SavingsDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editSettings, setEditSettings] = useState(false);
  const [settings, setSettings] = useState({
    title: detail.title,
    type: detail.type,
    monthlyContribution: detail.monthlyContribution,
    targetAmount: detail.targetAmount ?? 0,
    startDate: detail.startDate ?? "",
    payoutDate: detail.payoutDate ?? "",
    durationMonths: detail.durationMonths,
    notes: detail.notes ?? "",
    status: detail.status,
  });

  const saveSettings = () => {
    startTransition(async () => {
      const res = await fetch(`/api/savings/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        return;
      }
      toast.success("تم حفظ الإعدادات");
      setEditSettings(false);
      router.refresh();
    });
  };

  const isJamiya = detail.type === "JAMIYA";
  const TypeIcon = isJamiya ? Users : PiggyBank;

  return (
    <div className="space-y-4 pb-4 sm:space-y-6">
      <Link
        href="/savings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowRight className="h-4 w-4" />
        الجمعية والادخار
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white shadow-lg sm:p-6"
      >
        <div className="flex items-center gap-2 text-sm text-violet-100">
          <TypeIcon className="h-4 w-4" />
          {isJamiya ? "جمعية" : "ادخار شخصي"}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{detail.title}</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "المُدفوع", value: formatCurrency(detail.summary.paidTotal) },
            {
              label: "الهدف",
              value: detail.targetAmount
                ? formatCurrency(detail.targetAmount)
                : formatCurrency(detail.summary.scheduledTotal),
            },
            { label: "شهري", value: formatCurrency(detail.monthlyContribution) },
            {
              label: "الأشهر",
              value: `${detail.summary.paidCount}/${detail.summary.totalMonths}`,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-[10px] text-violet-100 sm:text-xs">{kpi.label}</p>
              <p className="text-sm font-extrabold sm:text-base">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-violet-100">
            <span>نسبة الإنجاز</span>
            <span>{detail.summary.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${detail.summary.progress}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg">الإعدادات</CardTitle>
          {editSettings ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveSettings} disabled={isPending}>
                <Save className="h-4 w-4" /> حفظ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditSettings(false)}>
                إلغاء
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditSettings(true)}>
              تعديل
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editSettings ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>العنوان</Label>
                <Input
                  value={settings.title}
                  onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>النوع</Label>
                <Select
                  value={settings.type}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, type: e.target.value as "JAMIYA" | "PERSONAL" }))
                  }
                >
                  <option value="JAMIYA">جمعية</option>
                  <option value="PERSONAL">ادخار شخصي</option>
                </Select>
              </div>
              <div>
                <Label>المساهمة الشهرية</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.monthlyContribution || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, monthlyContribution: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>الهدف</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settings.targetAmount || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, targetAmount: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>تاريخ البداية</Label>
                <Input
                  type="date"
                  value={settings.startDate}
                  onChange={(e) => setSettings((s) => ({ ...s, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>تاريخ القبض</Label>
                <Input
                  type="date"
                  value={settings.payoutDate}
                  onChange={(e) => setSettings((s) => ({ ...s, payoutDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>عدد الأشهر</Label>
                <Input
                  type="number"
                  value={settings.durationMonths || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, durationMonths: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>الحالة</Label>
                <Select
                  value={settings.status}
                  onChange={(e) => setSettings((s) => ({ ...s, status: e.target.value }))}
                >
                  <option value="ACTIVE">نشط</option>
                  <option value="COMPLETED">مكتمل</option>
                  <option value="PAUSED">متوقف</option>
                  <option value="CANCELLED">ملغى</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>ملاحظات</Label>
                <Input
                  value={settings.notes}
                  onChange={(e) => setSettings((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["البداية", detail.startDate ?? "—"],
                ["القبض", detail.payoutDate ?? "—"],
                ["المدة", `${detail.durationMonths} شهر`],
                ["الحالة", detail.status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-bold text-slate-900">{value}</p>
                </div>
              ))}
              {detail.notes && (
                <p className="col-span-2 text-sm text-slate-600 sm:col-span-4">
                  {detail.notes}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            جدول المساهمات الشهرية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.schedule.map((row) => (
            <div
              key={row.sequence}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                row.paid
                  ? "border-violet-100 bg-violet-50/40"
                  : "border-slate-100 bg-white"
              )}
            >
              <PaidCheckbox planId={detail.id} row={row} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">{row.label}</p>
                  {row.isPayout && (
                    <Badge variant="success">
                      <Gift className="ml-1 h-3 w-3" /> شهر القبض
                    </Badge>
                  )}
                  {row.paid && <Badge variant="default">مدفوع</Badge>}
                </div>
                {row.paid && row.paidAt && (
                  <p className="mt-0.5 text-xs text-slate-500">دُفع في {row.paidAt}</p>
                )}
              </div>
              <p
                className={cn(
                  "shrink-0 font-extrabold",
                  row.paid ? "text-violet-700" : "text-slate-900"
                )}
              >
                {formatCurrency(row.amount)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
