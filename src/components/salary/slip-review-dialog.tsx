"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SlipBreakdownCard } from "@/components/salary/slip-breakdown-card";
import { cn, formatCurrencyPrecise } from "@/lib/utils";
import { AR_MONTHS, monthLabel } from "@/lib/finance-labels";
import type { SalarySlipBreakdown } from "@/lib/payslip-types";

export const SLIP_FIELDS = [
  { key: "gross", label: "الإجمالي", he: "ברוטו" },
  { key: "net", label: "الصافي", he: "נטו לתשלום" },
  { key: "tax", label: "الضرائب", he: "מסים" },
  { key: "pension", label: "التقاعد", he: "פנסיה" },
  { key: "kerenHishtalmut", label: "صندوق الاستكمال", he: "קרן השתלמות" },
  { key: "fees", label: "خصومات أخرى", he: "ניכויים" },
  { key: "bonus", label: "إضافات", he: "תוספות" },
] as const;

export type SlipField = (typeof SLIP_FIELDS)[number]["key"];
export type SlipValues = Record<SlipField, number>;
export type EmployerOption = { id: string; name: string; active: boolean };

export type ParseResponse = Partial<Record<SlipField, number | null>> & {
  periodYear: number | null;
  periodMonth: number | null;
  breakdown: SalarySlipBreakdown | null;
  suggestedEmployerId: string | null;
  suggestedEmployerName: string | null;
  foundFields: string[];
  estimatedFields?: string[];
  confidence: "high" | "medium" | "low";
  fileName: string;
};

const NEW_EMPLOYER = "__new__";

export async function parsePayslipFile(file: File): Promise<{ data?: ParseResponse; error?: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/salary/parse", { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: typeof body.error === "string" ? body.error : "تعذّرت قراءة القسيمة" };
  return { data: body as ParseResponse };
}

/**
 * Review / edit one month's payslip. Values read from a PDF are shown as
 * suggestions (marked) that the user can correct before saving.
 * Remount with a `key` per target so state initialises from props.
 */
export function SlipReviewDialog({
  open,
  onOpenChange,
  employers,
  existing,
  initial,
  parsed,
  lockEmployer = false,
  currentPeriod,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employers: EmployerOption[];
  /** `${employerId}:${year}:${month}` → stored net, to warn before overwriting. */
  existing: Record<string, number>;
  initial: {
    employerId?: string | null;
    year: number;
    month: number;
    values?: Partial<SlipValues>;
    breakdown?: SalarySlipBreakdown | null;
    paid?: boolean;
  };
  parsed?: ParseResponse | null;
  lockEmployer?: boolean;
  currentPeriod: { year: number; month: number };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ParseResponse | null>(parsed ?? null);

  const fromParse = (p: ParseResponse | null | undefined) => ({
    employerId:
      (lockEmployer ? initial.employerId : p?.suggestedEmployerId) ??
      initial.employerId ??
      (p?.suggestedEmployerName && !employers.length ? NEW_EMPLOYER : employers.find((e) => e.active)?.id) ??
      NEW_EMPLOYER,
    year: p?.periodYear ?? initial.year,
    month: p?.periodMonth ?? initial.month,
  });

  const [employerId, setEmployerId] = useState<string>(() => fromParse(parsed).employerId);
  const [newEmployerName, setNewEmployerName] = useState(parsed?.suggestedEmployerName ?? "");
  const [year, setYear] = useState(() => fromParse(parsed).year);
  const [month, setMonth] = useState(() => fromParse(parsed).month);
  const [values, setValues] = useState<Record<SlipField, string>>(() => {
    const v = Object.fromEntries(
      SLIP_FIELDS.map(({ key }) => {
        const fromPdf = parsed?.[key];
        const val = fromPdf != null && fromPdf > 0 ? fromPdf : initial.values?.[key];
        return [key, val ? String(val) : ""];
      })
    );
    return v as Record<SlipField, string>;
  });
  const [breakdown, setBreakdown] = useState<SalarySlipBreakdown | null>(
    parsed?.breakdown ?? initial.breakdown ?? null
  );
  const [paid, setPaid] = useState(
    initial.paid ?? (year * 12 + month <= currentPeriod.year * 12 + currentPeriod.month)
  );

  const found = new Set(suggestion?.foundFields ?? []);
  const estimated = new Set(suggestion?.estimatedFields ?? []);
  const num = (k: SlipField) => Number(values[k]) || 0;
  const setVal = (k: SlipField, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const applyParse = (p: ParseResponse) => {
    setSuggestion(p);
    const next = fromParse(p);
    if (!lockEmployer) {
      setEmployerId(next.employerId);
      if (p.suggestedEmployerName && !p.suggestedEmployerId) setNewEmployerName(p.suggestedEmployerName);
    }
    setYear(next.year);
    setMonth(next.month);
    setValues((s) => {
      const out = { ...s };
      for (const { key } of SLIP_FIELDS) {
        const v = p[key];
        if (v != null && v > 0) out[key] = String(v);
      }
      return out;
    });
    if (p.breakdown) setBreakdown(p.breakdown);
  };

  const onFile = async (file: File) => {
    setParsing(true);
    setError(null);
    const { data, error } = await parsePayslipFile(file);
    setParsing(false);
    if (error || !data) return setError(error ?? "تعذّرت قراءة القسيمة");
    applyParse(data);
  };

  // Sanity check: gross − deductions + additions should equal net.
  const computedNet = num("gross") - num("tax") - num("pension") - num("kerenHishtalmut") - num("fees") + num("bonus");
  const diff = Math.round((computedNet - num("net")) * 100) / 100;
  const showDiff = num("gross") > 0 && num("net") > 0 && Math.abs(diff) > 1;

  const existingKey = employerId !== NEW_EMPLOYER ? `${employerId}:${year}:${month}` : null;
  // Editing a stored month isn't "overwriting" — only warn when the target is a different stored month.
  const editingKey = initial.values ? `${initial.employerId}:${initial.year}:${initial.month}` : null;
  const overwriting = existingKey != null && existingKey in existing && existingKey !== editingKey;
  const employerName =
    employerId === NEW_EMPLOYER ? newEmployerName.trim() : employers.find((e) => e.id === employerId)?.name ?? "";

  const save = () => {
    if (employerId === NEW_EMPLOYER && !newEmployerName.trim()) return setError("اكتب اسم جهة العمل");
    if (num("net") <= 0) return setError("أدخل الراتب الصافي");
    setError(null);
    startTransition(async () => {
      let targetId = employerId;
      if (employerId === NEW_EMPLOYER) {
        const res = await fetch("/api/employers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newEmployerName.trim() }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.id) return setError("تعذّر إنشاء جهة العمل");
        targetId = body.id;
      }
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: targetId,
          periodYear: year,
          periodMonth: month,
          worked: true,
          paid,
          ...Object.fromEntries(SLIP_FIELDS.map(({ key }) => [key, num(key)])),
          ...(breakdown ? { slipBreakdown: breakdown } : {}),
        }),
      });
      if (!res.ok) return setError("تعذّر حفظ الراتب، حاول مرة أخرى");
      toast.success(`حُفظ راتب ${monthLabel(month)} — ${employerName}`, {
        description: `${formatCurrencyPrecise(num("net"))} أُضيف إلى دخل ${monthLabel(month)}`,
        action: { label: "المعاملات", onClick: () => router.push(`/transactions?year=${year}&month=${month}&type=income`) },
      });
      onOpenChange(false);
      router.refresh();
    });
  };

  const years = Array.from({ length: 6 }, (_, i) => currentPeriod.year - 4 + i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{suggestion ? "راجع القسيمة قبل الحفظ" : "راتب الشهر"}</DialogTitle>
            <DialogDescription>
              {suggestion
                ? "قرأنا الأرقام من الملف — عدّل أي قيمة غير صحيحة ثم احفظ."
                : "أدخل الأرقام يدوياً أو اقرأها من قسيمة PDF."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {/* Source / upload */}
            {suggestion ? (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-2xl p-3.5",
                  suggestion.confidence === "high" ? "bg-emerald-50" : "bg-amber-50"
                )}
              >
                {suggestion.confidence === "high" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold", suggestion.confidence === "high" ? "text-emerald-900" : "text-amber-900")}>
                    {suggestion.confidence === "high"
                      ? "قُرئت القسيمة بثقة عالية"
                      : suggestion.confidence === "medium"
                        ? "قُرئ معظم القسيمة — تحقّق من الحقول غير المعلّمة"
                        : "قُرئ جزء فقط — أكمل الحقول الناقصة"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-600">
                    <FileText className="h-3.5 w-3.5 shrink-0" /> <span dir="auto" className="truncate">{suggestion.fileName}</span>
                    <span className="text-slate-400">· {found.size} حقول مقترحة</span>
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} disabled={parsing}>
                  ملف آخر
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={parsing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {parsing ? "نقرأ القسيمة…" : "اقرأ الأرقام من قسيمة PDF"}
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />

            {/* Employer + period */}
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr]">
              <div>
                <Label htmlFor="slip-employer" className="flex items-center gap-1.5">
                  جهة العمل
                  {suggestion?.suggestedEmployerId && employerId === suggestion.suggestedEmployerId && !lockEmployer && <SuggestedMark />}
                </Label>
                {lockEmployer ? (
                  <Input id="slip-employer" value={employerName} disabled />
                ) : (
                  <Select id="slip-employer" value={employerId} onChange={(e) => setEmployerId(e.target.value)}>
                    {employers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {!e.active ? " (متوقفة)" : ""}
                      </option>
                    ))}
                    <option value={NEW_EMPLOYER}>+ جهة عمل جديدة…</option>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="slip-month" className="flex items-center gap-1.5">
                  الشهر {found.has("period") && <SuggestedMark />}
                </Label>
                <Select id="slip-month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {AR_MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="slip-year">السنة</Label>
                <Select id="slip-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </div>
              {employerId === NEW_EMPLOYER && !lockEmployer && (
                <div className="sm:col-span-3">
                  <Label htmlFor="slip-new-employer">اسم جهة العمل الجديدة</Label>
                  <Input
                    id="slip-new-employer"
                    value={newEmployerName}
                    onChange={(e) => setNewEmployerName(e.target.value)}
                    placeholder="مثال: אוניברסיטת בן-גוריון"
                    maxLength={120}
                  />
                </div>
              )}
            </div>

            {overwriting && (
              <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                يوجد راتب مسجّل لـ{monthLabel(month)} {year} (صافي {formatCurrencyPrecise(existing[existingKey!]!)}) — الحفظ سيستبدله.
              </p>
            )}

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SLIP_FIELDS.map(({ key, label, he }) => {
                const suggested = found.has(key);
                const isEstimate = estimated.has(key);
                const missing = suggestion && !suggested && (key === "gross" || key === "net") && !values[key];
                return (
                  <div key={key} className={cn(key === "net" && "col-span-2 sm:col-span-1")}>
                    <Label htmlFor={`slip-${key}`} className="flex items-center gap-1.5">
                      {label} <span className="text-[11px] font-normal text-slate-400">{he}</span>
                      {suggested && <SuggestedMark />}
                      {isEstimate && <EstimateMark />}
                    </Label>
                    <Input
                      id={`slip-${key}`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={values[key]}
                      onChange={(e) => setVal(key, e.target.value)}
                      placeholder="0"
                      aria-invalid={Boolean(missing)}
                      className={cn(
                        "num",
                        key === "net" && "border-emerald-300 text-base font-bold text-emerald-700",
                        suggested && "bg-indigo-50/40",
                        isEstimate && "border-amber-300 bg-amber-50/40"
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {showDiff && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <span>
                  الإجمالي ناقص الخصومات = <span className="num font-semibold text-slate-900">{formatCurrencyPrecise(computedNet)}</span>، والصافي{" "}
                  <span className="num font-semibold text-slate-900">{formatCurrencyPrecise(num("net"))}</span> — فرق{" "}
                  <span className="num font-semibold text-amber-700">{formatCurrencyPrecise(Math.abs(diff))}</span>
                </span>
                {diff > 0 && (
                  <button
                    type="button"
                    onClick={() => setVal("fees", String(Math.round((num("fees") + diff) * 100) / 100))}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    أضفه إلى «خصومات أخرى»
                  </button>
                )}
              </div>
            )}

            {breakdown && (
              <details className="group rounded-2xl border border-slate-200">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700">
                  تفاصيل الضرائب والتقاعد من القسيمة
                </summary>
                <div className="px-3 pb-3">
                  <SlipBreakdownCard breakdown={breakdown} compact />
                </div>
              </details>
            )}

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-slate-800">تم قبض الراتب</span>
                <span className="block text-xs text-slate-500">
                  الصافي يُضاف إلى دخل {monthLabel(month)} في{" "}
                  <Link href="/transactions" className="text-indigo-600 underline-offset-2 hover:underline">المعاملات</Link>
                  {" "}ولوحة التحكم
                </span>
              </span>
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-indigo-600" />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="brand" disabled={isPending || parsing} className="min-w-32">
              {isPending ? "جارٍ الحفظ…" : "حفظ الراتب"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EstimateMark() {
  return (
    <span
      title="لم يظهر في القسيمة — حُسب من الفرق بين الإجمالي والصافي. تحقّق منه."
      className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700"
    >
      تقدير
    </span>
  );
}

function SuggestedMark() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-1.5 py-px text-[10px] font-semibold text-indigo-600">
      <Sparkles className="h-2.5 w-2.5" /> من القسيمة
    </span>
  );
}
