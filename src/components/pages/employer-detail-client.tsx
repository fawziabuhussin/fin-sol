"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { SlipBreakdownCard } from "@/components/salary/slip-breakdown-card";
import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  breakdownFromBaseForm,
  monthDefaultsFromBase,
  partsFromBreakdown,
} from "@/lib/salary-defaults";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type MonthRow = {
  month: number;
  label: string;
  slipId: string | null;
  exists: boolean;
  worked: boolean;
  paid: boolean;
  paidAt: string | null;
  gross: number;
  net: number;
  tax: number;
  pension: number;
  kerenHishtalmut: number;
  fees: number;
  bonus: number;
  effectiveNet: number;
  notes: string | null;
  slipBreakdown: SalarySlipBreakdown | null;
};

type EmployerDetail = {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  startDate: string | null;
  base: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    keren: number;
    fees: number;
    bonus: number;
    slipBreakdown: SalarySlipBreakdown | null;
  };
  year: number;
  months: MonthRow[];
  totals: {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    fees: number;
    bonus: number;
    workedMonths: number;
    stoppedMonths: number;
    paidMonths: number;
  };
};

const FIELD_LABELS: Record<string, string> = {
  gross: "إجمالي (ברוטו)",
  net: "صافي (נטו)",
  tax: "מסים (סה״כ)",
  pension: "פנסיה — עובד",
  kerenHishtalmut: "קרן השתלמות — עובד",
  fees: "خصومات/رسوم",
  bonus: "إضافات/מكافآت",
};

const BASE_FIELD_KEYS = [
  "baseGross",
  "baseNet",
  "baseTax",
  "basePension",
  "baseKeren",
  "baseFees",
  "baseBonus",
] as const;

const BASE_FIELD_LABELS: Record<(typeof BASE_FIELD_KEYS)[number], string> = {
  baseGross: FIELD_LABELS.gross,
  baseNet: FIELD_LABELS.net,
  baseTax: FIELD_LABELS.tax,
  basePension: FIELD_LABELS.pension,
  baseKeren: FIELD_LABELS.kerenHishtalmut,
  baseFees: FIELD_LABELS.fees,
  baseBonus: FIELD_LABELS.bonus,
};

const TAX_PART_LABELS = {
  taxNationalInsurance: "ביטוח לאומי",
  taxHealthInsurance: "מס בריאות",
  taxIncome: "מס הכנסה",
} as const;

function previewBaseBreakdown(baseForm: {
  baseGross: number;
  baseNet: number;
  baseTax: number;
  basePension: number;
  baseKeren: number;
  baseFees: number;
  baseBonus: number;
  taxNationalInsurance: number;
  taxHealthInsurance: number;
  taxIncome: number;
}) {
  return breakdownFromBaseForm(
    {
      gross: baseForm.baseGross,
      net: baseForm.baseNet,
      tax: baseForm.baseTax,
      pension: baseForm.basePension,
      keren: baseForm.baseKeren,
      fees: baseForm.baseFees,
      bonus: baseForm.baseBonus,
    },
    {
      taxNationalInsurance: baseForm.taxNationalInsurance,
      taxHealthInsurance: baseForm.taxHealthInsurance,
      taxIncome: baseForm.taxIncome,
    }
  );
}

export function EmployerDetailClient({ detail }: { detail: EmployerDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<
    Partial<MonthRow> & { slipBreakdown?: SalarySlipBreakdown | null }
  >({});
  const [parseLoading, setParseLoading] = useState(false);
  const [editBase, setEditBase] = useState(false);
  const taxPartsInit = partsFromBreakdown(detail.base.slipBreakdown);
  const [baseForm, setBaseForm] = useState({
    baseGross: detail.base.gross,
    baseNet: detail.base.net,
    baseTax: detail.base.tax,
    basePension: detail.base.pension,
    baseKeren: detail.base.keren,
    baseFees: detail.base.fees,
    baseBonus: detail.base.bonus,
    role: detail.role ?? "",
    ...taxPartsInit,
  });

  const saveMonth = (month: number, values: Partial<MonthRow>, worked: boolean) => {
    startTransition(async () => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: detail.id,
          periodYear: detail.year,
          periodMonth: month,
          worked,
          gross: values.gross ?? 0,
          net: values.net ?? 0,
          tax: values.tax ?? 0,
          pension: values.pension ?? 0,
          kerenHishtalmut: values.kerenHishtalmut ?? 0,
          fees: values.fees ?? 0,
          bonus: values.bonus ?? 0,
          slipBreakdown: values.slipBreakdown ?? undefined,
        }),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        return;
      }
      toast.success("تم حفظ الشهر");
      setEditingMonth(null);
      router.refresh();
    });
  };

  const toggleWorked = (row: MonthRow) => {
    saveMonth(row.month, row, !row.worked);
  };

  const togglePaid = (row: MonthRow) => {
    startTransition(async () => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: detail.id,
          periodYear: detail.year,
          periodMonth: row.month,
          worked: row.worked,
          paid: !row.paid,
          gross: row.gross,
          net: row.net,
          tax: row.tax,
          pension: row.pension,
          kerenHishtalmut: row.kerenHishtalmut,
          fees: row.fees,
          bonus: row.bonus,
        }),
      });
      if (!res.ok) {
        toast.error("فشل التحديث");
        return;
      }
      toast.success(row.paid ? "تم إلغاء القبض" : "تم تسجيل القبض");
      router.refresh();
    });
  };

  const deleteSlip = (row: MonthRow) => {
    if (!row.slipId) return;
    if (!confirm(`حذف راتب ${row.label}؟`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/salary/${row.slipId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم حذف الراتب");
      router.refresh();
    });
  };

  const startEdit = (row: MonthRow) => {
    setEditingMonth(row.month);
    setEditForm(row.exists ? { ...row } : monthDefaultsFromBase(detail.base));
  };

  const uploadPayslip = async (month: number, file: File) => {
    setParseLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/salary/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "فشل قراءة التלוש");
        return;
      }
      setEditForm((f) => ({
        ...f,
        gross: data.gross ?? f.gross,
        net: data.net ?? f.net,
        tax: data.tax ?? f.tax,
        pension: data.pension ?? f.pension,
        kerenHishtalmut: data.kerenHishtalmut ?? f.kerenHishtalmut,
        slipBreakdown: data.breakdown ?? null,
      }));
      toast.success(
        data.confidence === "high"
          ? "تم استخراج التלוש بنجاح"
          : "تم الاستخراج — راجع الأرقام قبل الحفظ"
      );
    } catch {
      toast.error("فشل رفع الملف");
    } finally {
      setParseLoading(false);
    }
  };

  const saveBase = () => {
    const breakdown = previewBaseBreakdown(baseForm);

    startTransition(async () => {
      const res = await fetch(`/api/employers/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: baseForm.role,
          baseGross: baseForm.baseGross,
          baseNet: baseForm.baseNet,
          baseTax: baseForm.baseTax,
          basePension: baseForm.basePension,
          baseKeren: baseForm.baseKeren,
          baseFees: baseForm.baseFees,
          baseBonus: baseForm.baseBonus,
          baseSlipBreakdown: breakdown,
        }),
      });
      if (!res.ok) {
        toast.error("فشل حفظ الإعدادات");
        return;
      }
      toast.success("تم حفظ الراتب الأساسي");
      setEditBase(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 pb-4 sm:space-y-6">
      <Link
        href="/salary"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowRight className="h-4 w-4" />
        متابعة الراتب
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Briefcase className="h-4 w-4" />
              جهة عمل
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {detail.name}
            </h1>
            {detail.role && (
              <p className="mt-1 text-sm text-slate-600">{detail.role}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/salary/${detail.id}?year=${detail.year - 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold">
              {detail.year}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/salary/${detail.id}?year=${detail.year + 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "صافي المقبوض", value: detail.totals.net, color: "text-emerald-700" },
            { label: "إجمالي المقبوض", value: detail.totals.gross, color: "text-slate-900" },
            {
              label: "أشهر عمل",
              value: `${detail.totals.workedMonths}`,
              color: "text-indigo-700",
              isText: true,
            },
            {
              label: "أشهر توقف",
              value: `${detail.totals.stoppedMonths}`,
              color: "text-rose-700",
              isText: true,
            },
            {
              label: "أشهر مقبوضة",
              value: `${detail.totals.paidMonths}`,
              color: "text-amber-600",
              isText: true,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className={`text-lg font-extrabold ${kpi.color}`}>
                {"isText" in kpi && kpi.isText
                  ? (kpi.value as string)
                  : formatCurrency(kpi.value as number)}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Base template */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg">
            الراتب الأساسي (الافتراضي)
          </CardTitle>
          {editBase ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveBase} disabled={isPending}>
                <Save className="h-4 w-4" /> حفظ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditBase(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBaseForm({
                  baseGross: detail.base.gross,
                  baseNet: detail.base.net,
                  baseTax: detail.base.tax,
                  basePension: detail.base.pension,
                  baseKeren: detail.base.keren,
                  baseFees: detail.base.fees,
                  baseBonus: detail.base.bonus,
                  role: detail.role ?? "",
                  ...partsFromBreakdown(detail.base.slipBreakdown),
                });
                setEditBase(true);
              }}
            >
              <Pencil className="h-4 w-4" /> تعديل
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editBase ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label>المسمّى الوظيفي</Label>
                  <Input
                    value={baseForm.role}
                    onChange={(e) => setBaseForm((f) => ({ ...f, role: e.target.value }))}
                  />
                </div>
                {BASE_FIELD_KEYS.map((key) => (
                  <div key={key}>
                    <Label className="text-xs">{BASE_FIELD_LABELS[key]}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={baseForm[key] || ""}
                      onChange={(e) =>
                        setBaseForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                <p className="mb-2 text-xs font-bold text-rose-800">
                  פירוט מסים (اختياري — يُنسخ لكل شهر جديد)
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    Object.keys(TAX_PART_LABELS) as (keyof typeof TAX_PART_LABELS)[]
                  ).map((key) => (
                    <div key={key}>
                      <Label className="text-xs">{TAX_PART_LABELS[key]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={baseForm[key] || ""}
                        onChange={(e) =>
                          setBaseForm((f) => ({
                            ...f,
                            [key]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  إن تركت الفصل فارغاً يُستخدم «מסים (סה״כ)» فقط.
                </p>
              </div>
              {previewBaseBreakdown(baseForm) && (
                <SlipBreakdownCard breakdown={previewBaseBreakdown(baseForm)!} compact />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {(
                [
                  [FIELD_LABELS.gross, detail.base.gross],
                  [FIELD_LABELS.net, detail.base.net],
                  [FIELD_LABELS.tax, detail.base.tax],
                  [FIELD_LABELS.pension, detail.base.pension],
                  [FIELD_LABELS.kerenHishtalmut, detail.base.keren],
                  [FIELD_LABELS.fees, detail.base.fees],
                  [FIELD_LABELS.bonus, detail.base.bonus],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="font-bold text-slate-900">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          )}
          {!editBase && detail.base.slipBreakdown && (
            <div className="mt-3">
              <SlipBreakdownCard breakdown={detail.base.slipBreakdown} compact />
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            هذه القيم تُستخدم كقيمة افتراضية عند إضافة شهر جديد، ويمكن تعديل كل
            شهر على حدة.
          </p>
        </CardContent>
      </Card>

      {/* Monthly grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">رواتب {detail.year}</CardTitle>
          <p className="text-xs text-slate-500">
            يُزامَن الراتب تلقائياً مع دخل نفس الشهر في المعاملات.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.months.map((row) => {
            const isEditing = editingMonth === row.month;
            return (
              <div
                key={row.month}
                className={cn(
                  "rounded-xl border p-3",
                  !row.worked
                    ? "border-rose-100 bg-rose-50/40"
                    : row.exists
                      ? "border-emerald-100 bg-emerald-50/30"
                      : "border-slate-100 bg-white"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleWorked(row)}
                      disabled={isPending}
                      aria-label={row.worked ? "إيقاف العمل" : "تفعيل العمل"}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                        row.worked
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white text-transparent hover:border-emerald-400"
                      )}
                    >
                      <Check className="h-5 w-5" strokeWidth={3} />
                    </button>
                    <div>
                      <p className="font-bold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">
                        {row.worked
                          ? row.exists
                            ? `صافي ${formatCurrency(row.effectiveNet)}${row.paid && row.paidAt ? ` · قُبض ${row.paidAt}` : ""}`
                            : "لم يُسجّل بعد"
                          : "توقف عن العمل — لا يُحتسب"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!row.worked && <Badge variant="warning">متوقف</Badge>}
                    {row.worked && row.exists && (
                      <Badge variant={row.paid ? "success" : "warning"}>
                        {row.paid ? "تم القبض" : "بانتظار"}
                      </Badge>
                    )}
                    {row.worked && row.exists && (
                      <Button
                        size="sm"
                        variant={row.paid ? "outline" : "default"}
                        disabled={isPending}
                        onClick={() => togglePaid(row)}
                      >
                        <Banknote className="h-4 w-4" />
                        {row.paid ? "إلغاء القبض" : "تم القبض"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => (isEditing ? setEditingMonth(null) : startEdit(row))}
                    >
                      {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                    {row.exists && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50"
                        disabled={isPending}
                        onClick={() => deleteSlip(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm font-medium text-indigo-800 transition hover:bg-indigo-50">
                      <FileUp className="h-4 w-4" />
                      {parseLoading ? "جاري قراءة PDF…" : "رفع תלוש (PDF) — מסים ופנסיה"}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={parseLoading || isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPayslip(row.month, file);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {editForm.slipBreakdown && (
                      <SlipBreakdownCard breakdown={editForm.slipBreakdown} />
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        ["gross", "net", "tax", "pension", "kerenHishtalmut", "fees", "bonus"] as const
                      ).map((key) => (
                        <div key={key}>
                          <Label className="text-xs">{FIELD_LABELS[key]}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm[key] ?? 0}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                [key]: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => saveMonth(row.month, editForm, row.worked)}
                      >
                        <Save className="h-4 w-4" /> حفظ الشهر
                      </Button>
                    </div>
                  </div>
                )}

                {!isEditing && row.slipBreakdown && (
                  <div className="mt-3">
                    <SlipBreakdownCard breakdown={row.slipBreakdown} compact />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
