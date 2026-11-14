"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Upload,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SLIP_FIELDS,
  SlipReviewDialog,
  parsePayslipFile,
  type ParseResponse,
  type SlipValues,
} from "@/components/salary/slip-review-dialog";
import { breakdownFromBaseForm, monthDefaultsFromBase, partsFromBreakdown } from "@/lib/salary-defaults";
import { cn, formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { getEmployerDetail } from "@/lib/tenant-data";

type Detail = NonNullable<Awaited<ReturnType<typeof getEmployerDetail>>>;
type MonthRow = Detail["months"][number];

const valuesOf = (r: Pick<MonthRow, SlipKeys>): SlipValues => ({
  gross: r.gross,
  net: r.net,
  tax: r.tax,
  pension: r.pension,
  kerenHishtalmut: r.kerenHishtalmut,
  fees: r.fees,
  bonus: r.bonus,
});
type SlipKeys = "gross" | "net" | "tax" | "pension" | "kerenHishtalmut" | "fees" | "bonus";

function statusOf(row: MonthRow, future: boolean, beforeStart: boolean) {
  if (!row.exists) {
    if (future) return { label: "لم يحن بعد", tone: "text-slate-400" };
    if (beforeStart) return { label: "لا راتب", tone: "text-slate-400" };
    return { label: "لم يُسجّل بعد", tone: "text-amber-600" };
  }
  if (!row.worked) return { label: "لم يعمل", tone: "text-slate-400" };
  return row.paid ? { label: "مقبوض", tone: "text-emerald-600" } : { label: "بانتظار القبض", tone: "text-amber-600" };
}

export function EmployerDetailClient({
  detail,
  currentPeriod,
  existing,
}: {
  detail: Detail;
  currentPeriod: { year: number; month: number };
  existing: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const seq = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadMonth = useRef<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<{ key: number; row: MonthRow | null; month: number; parsed: ParseResponse | null } | null>(null);
  const [baseOpen, setBaseOpen] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MonthRow | null>(null);

  const employerOption = [{ id: detail.id, name: detail.name, active: detail.active }];
  const curIdx = currentPeriod.year * 12 + currentPeriod.month;
  const isFuture = (m: number) => detail.year * 12 + m > curIdx;
  const recorded = detail.months.filter((m) => m.exists && m.worked);
  const pendingPay = recorded.filter((m) => !m.paid && !isFuture(m.month));
  // Months before the first recorded one (e.g. job started mid-year) aren't "missing".
  const firstMonth = detail.months.find((m) => m.exists)?.month ?? (detail.year === currentPeriod.year ? currentPeriod.month : 13);

  const openReview = (row: MonthRow | null, month: number, parsed: ParseResponse | null = null) =>
    setReview({ key: ++seq.current, row, month, parsed });

  const startUpload = (month: number | null) => {
    uploadMonth.current = month;
    fileInput.current?.click();
  };

  const onFile = async (file: File) => {
    setParsing(true);
    const { data, error } = await parsePayslipFile(file);
    setParsing(false);
    const month = uploadMonth.current ?? data?.periodMonth ?? currentPeriod.month;
    const row = detail.months.find((m) => m.month === month) ?? null;
    if (error || !data) {
      toast.error(error ?? "تعذّرت قراءة القسيمة");
      return openReview(row?.exists ? row : null, month);
    }
    // A month picked from a row wins over the month read from the file.
    openReview(row?.exists ? row : null, month, uploadMonth.current ? { ...data, periodMonth: month, periodYear: detail.year } : data);
  };

  const post = (row: MonthRow, patch: { worked?: boolean; paid?: boolean }, msg: string) =>
    startTransition(async () => {
      const values = row.exists ? valuesOf(row) : valuesOf({ ...monthDefaultsFromBase(detail.base) });
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: detail.id,
          periodYear: detail.year,
          periodMonth: row.month,
          worked: patch.worked ?? row.worked,
          ...(patch.paid !== undefined ? { paid: patch.paid } : {}),
          ...values,
        }),
      });
      if (!res.ok) return void toast.error("تعذّر التحديث");
      toast.success(msg);
      router.refresh();
    });

  const deleteSlip = () =>
    startTransition(async () => {
      if (!confirmDelete?.slipId) return;
      const res = await fetch(`/api/salary/${confirmDelete.slipId}`, { method: "DELETE" });
      if (!res.ok) return void toast.error("تعذّر الحذف");
      toast.success(`حُذف راتب ${confirmDelete.label}`);
      setConfirmDelete(null);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
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
      <Link href="/salary" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowRight className="h-4 w-4" /> الراتب
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
          style={{ backgroundColor: `${detail.color || "#4F46E5"}1a`, color: detail.color || "#4F46E5" }}
        >
          {detail.name.trim().charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl" dir="auto">{detail.name}</h1>
          <p className="truncate text-sm text-slate-500">{detail.role || (detail.active ? "جهة عمل نشطة" : "متوقفة")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" className="sm:hidden" onClick={() => setBaseOpen(++seq.current)} aria-label="الراتب الأساسي">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setBaseOpen(++seq.current)}>
            <Settings2 className="h-4 w-4" /> الراتب الأساسي
          </Button>
          <Button variant="brand" onClick={() => startUpload(null)} disabled={parsing}>
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} رفع قسيمة
          </Button>
        </div>
      </div>

      {/* Year summary */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-white/60">صافي {detail.year}</p>
            <p className="num mt-1 text-4xl font-bold tracking-tight">{formatCurrency(recorded.reduce((s, m) => s + m.effectiveNet, 0))}</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
            <button
              type="button"
              onClick={() => router.push(`/salary/${detail.id}?year=${detail.year - 1}`)}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="السنة السابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="num px-1 text-sm font-semibold">{detail.year}</span>
            <button
              type="button"
              onClick={() => router.push(`/salary/${detail.id}?year=${detail.year + 1}`)}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="السنة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
        <dl className="relative mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
          {[
            { label: "أشهر مسجّلة", value: `${recorded.length}` },
            { label: "ضرائب", value: formatCurrency(recorded.reduce((s, m) => s + m.tax, 0)) },
            { label: "تقاعد واستكمال", value: formatCurrency(recorded.reduce((s, m) => s + m.pension + m.kerenHishtalmut, 0)) },
          ].map((s) => (
            <div key={s.label} className="px-2 text-center">
              <dt className="text-[11px] text-white/55">{s.label}</dt>
              <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {pendingPay.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">{pendingPay.length === 1 ? `راتب ${pendingPay[0]!.label}` : `${pendingPay.length} رواتب`}</span> بانتظار تأكيد القبض
          </p>
          {pendingPay.length === 1 && (
            <Button size="sm" onClick={() => post(pendingPay[0]!, { paid: true }, `سُجّل قبض راتب ${pendingPay[0]!.label}`)} disabled={isPending}>
              <Banknote className="h-4 w-4" /> تم القبض
            </Button>
          )}
        </div>
      )}

      {/* Months */}
      <Card className="p-2 sm:p-3">
        <div className="px-3 pb-1 pt-3">
          <h2 className="text-sm font-semibold text-slate-900">رواتب {detail.year}</h2>
          <p className="mt-0.5 text-xs text-slate-500">كل راتب يُضاف تلقائياً إلى دخل شهره في المعاملات ولوحة التحكم.</p>
        </div>
        <ul className="mt-1 divide-y divide-slate-100/80">
          {detail.months.map((row) => {
            const future = isFuture(row.month);
            const beforeStart = row.month < firstMonth;
            const st = statusOf(row, future, beforeStart);
            return (
              <li key={row.month} className={cn("flex items-center gap-3 rounded-xl px-2 py-3 sm:px-3", (future || beforeStart) && !row.exists && "opacity-60")}>
                <span
                  className={cn(
                    "num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    row.exists && row.worked ? (row.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700") : "bg-slate-100 text-slate-400"
                  )}
                >
                  {row.month}
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  onClick={() => openReview(row.exists ? row : null, row.month)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {row.label}
                    {row.slipBreakdown && <FileText className="h-3.5 w-3.5 text-indigo-500" aria-label="من قسيمة" />}
                  </span>
                  <span className={cn("block text-xs font-medium", st.tone)}>
                    {st.label}
                    {row.exists && row.worked && row.paid && row.paidAt ? <span className="text-slate-400"> · {row.paidAt.slice(8, 10)}/{row.paidAt.slice(5, 7)}</span> : null}
                  </span>
                </button>
                {row.exists && row.worked ? (
                  <span className="num shrink-0 text-sm font-bold text-slate-900">{formatCurrencyPrecise(row.effectiveNet)}</span>
                ) : !row.exists && !future && !beforeStart ? (
                  <Button size="sm" variant="secondary" onClick={() => openReview(null, row.month)}>
                    <Plus className="h-3.5 w-3.5" /> إضافة
                  </Button>
                ) : null}
                {row.exists && row.worked && !row.paid && !future && (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    className="text-emerald-600"
                    aria-label={`تأكيد قبض ${row.label}`}
                    disabled={isPending}
                    onClick={() => post(row, { paid: true }, `سُجّل قبض راتب ${row.label}`)}
                  >
                    <Banknote className="h-4 w-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="shrink-0 text-slate-400" aria-label={`خيارات ${row.label}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => openReview(row.exists ? row : null, row.month)}>
                      <Pencil /> {row.exists ? "تعديل الأرقام" : "إدخال الراتب"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => startUpload(row.month)}>
                      <Upload /> قراءة من قسيمة PDF
                    </DropdownMenuItem>
                    {row.exists && row.worked && (
                      <DropdownMenuItem onSelect={() => post(row, { paid: !row.paid }, row.paid ? "أُلغي تأكيد القبض" : `سُجّل قبض راتب ${row.label}`)}>
                        <Banknote /> {row.paid ? "إلغاء تأكيد القبض" : "تم القبض"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() =>
                        post(
                          row,
                          // New month → record it as "didn't work"; existing → flip.
                          { worked: row.exists ? !row.worked : false },
                          row.exists && !row.worked ? `${row.label}: عاد للعمل` : `${row.label}: لم يعمل`
                        )
                      }
                    >
                      {row.worked || !row.exists ? <UserX /> : <UserCheck />}
                      {row.worked || !row.exists ? "لم أعمل هذا الشهر" : "عملت هذا الشهر"}
                    </DropdownMenuItem>
                    {row.exists && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600 [&_svg]:text-rose-500" onSelect={() => setConfirmDelete(row)}>
                          <Trash2 /> حذف الراتب
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      </Card>

      {review && (
        <SlipReviewDialog
          key={review.key}
          open
          onOpenChange={(o) => !o && setReview(null)}
          employers={employerOption}
          existing={existing}
          lockEmployer
          parsed={review.parsed}
          currentPeriod={currentPeriod}
          initial={{
            employerId: detail.id,
            year: detail.year,
            month: review.month,
            values: review.row ? valuesOf(review.row) : valuesOf(monthDefaultsFromBase(detail.base)),
            breakdown: review.row ? review.row.slipBreakdown : null,
            paid: review.row?.paid,
          }}
        />
      )}

      {baseOpen != null && <BaseSalaryDialog key={baseOpen} detail={detail} onClose={() => setBaseOpen(null)} />}

      <ConfirmDialog
        open={confirmDelete != null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        destructive
        pending={isPending}
        confirmLabel="حذف"
        title={`حذف راتب ${confirmDelete?.label ?? ""}؟`}
        description="يُحذف الراتب ودخله من المعاملات ولوحة التحكم."
        onConfirm={deleteSlip}
      />
    </div>
  );
}

/** Default monthly figures used to pre-fill new months. */
function BaseSalaryDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(detail.role ?? "");
  const [values, setValues] = useState<Record<SlipKeys, string>>(() => {
    const v = valuesOf({ ...monthDefaultsFromBase(detail.base) });
    return Object.fromEntries(Object.entries(v).map(([k, n]) => [k, n ? String(n) : ""])) as Record<SlipKeys, string>;
  });
  const [parts, setParts] = useState(() => partsFromBreakdown(detail.base.slipBreakdown));
  const n = (k: SlipKeys) => Number(values[k]) || 0;

  const save = () =>
    startTransition(async () => {
      const base = { gross: n("gross"), net: n("net"), tax: n("tax"), pension: n("pension"), keren: n("kerenHishtalmut"), fees: n("fees"), bonus: n("bonus") };
      const res = await fetch(`/api/employers/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          baseGross: base.gross,
          baseNet: base.net,
          baseTax: base.tax,
          basePension: base.pension,
          baseKeren: base.keren,
          baseFees: base.fees,
          baseBonus: base.bonus,
          baseSlipBreakdown: breakdownFromBaseForm(base, parts) ?? undefined,
        }),
      });
      if (!res.ok) return void toast.error("تعذّر الحفظ");
      toast.success("حُفظ الراتب الأساسي");
      onClose();
      router.refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>الراتب الأساسي</DialogTitle>
            <DialogDescription>يُستخدم لتعبئة الأشهر الجديدة تلقائياً — ويمكن تعديل كل شهر على حدة.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="base-role">المسمّى الوظيفي</Label>
              <Input id="base-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SLIP_FIELDS.map(({ key, label, he }) => (
                <div key={key}>
                  <Label htmlFor={`base-${key}`}>
                    {label} <span className="text-[11px] font-normal text-slate-400">{he}</span>
                  </Label>
                  <Input
                    id={`base-${key}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="num"
                  />
                </div>
              ))}
            </div>
            <details className="rounded-2xl border border-slate-200">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700">تفصيل الضرائب (اختياري)</summary>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
                {(
                  [
                    ["taxNationalInsurance", "ביטוח לאומי"],
                    ["taxHealthInsurance", "מס בריאות"],
                    ["taxIncome", "מס הכנסה"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`base-${key}`}>{label}</Label>
                    <Input
                      id={`base-${key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={parts[key] || ""}
                      onChange={(e) => setParts((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                      className="num"
                    />
                  </div>
                ))}
              </div>
            </details>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" variant="brand" disabled={isPending}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
