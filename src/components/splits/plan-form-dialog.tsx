"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
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
import { cn, formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { localTodayIso } from "@/lib/dates";
import {
  DOWN_PAYMENT_LABEL,
  MAX_INSTALLMENT_COUNT,
  resolveInstallmentAmounts,
} from "@/lib/payment-plan";
import { ServiceAvatar } from "@/components/subscriptions/service-avatar";
import { formatDay, formatMonth, type SplitPlan } from "./split-utils";

type Lookup = { id: string; name: string };

const COUNT_CHIPS = [2, 3, 4, 6, 10, 12, 18, 24, 36];

function addMonthsIso(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y!, m! - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d!, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Create a new installment purchase, or edit an existing plan (which
 * reschedules only the pending installments). Remount with `key` per target.
 */
export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
  categories,
  paymentMethods,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SplitPlan | null;
  categories: Lookup[];
  paymentMethods: Lookup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = plan != null;
  const [form, setForm] = useState(() => ({
    title: plan?.title ?? "",
    amount: plan ? String(plan.totalAmount) : "",
    count: plan?.installmentCount ?? 3,
    start: plan?.startDate ?? localTodayIso(),
    down: plan?.firstPaymentAmount ? String(plan.firstPaymentAmount) : "",
    categoryId: plan?.categoryId ?? "",
    paymentMethodId: plan?.paymentMethodId ?? "",
    payFirstNow: false,
  }));
  const [customCount, setCustomCount] = useState(!COUNT_CHIPS.includes(form.count));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const total = Number(form.amount);
  const down = form.down ? Number(form.down) : 0;
  const validTotal = Number.isFinite(total) && total > 0;
  const downInvalid = down > 0 && down >= total && form.count > 1;

  const schedule = useMemo(() => {
    if (!validTotal || downInvalid || !form.start) return [];
    return resolveInstallmentAmounts(total, form.count, down > 0 ? down : null).map((amount, i) => ({
      amount,
      date: addMonthsIso(form.start, i),
    }));
  }, [validTotal, downInvalid, total, down, form.count, form.start]);

  const submit = () => {
    if (!validTotal) return setError("أدخل المبلغ الإجمالي");
    if (form.count < 1 || form.count > MAX_INSTALLMENT_COUNT)
      return setError(`عدد الدفعات بين 1 و ${MAX_INSTALLMENT_COUNT}`);
    if (downInvalid) return setError("المقدّمة يجب أن تكون أصغر من المبلغ الإجمالي");
    setError(null);

    startTransition(async () => {
      const res = isEdit
        ? await fetch(`/api/split-plans/${plan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: form.title.trim(),
              totalAmount: total,
              installmentCount: form.count,
              firstPaymentAmount: down > 0 ? down : 0,
              startDate: form.start,
              categoryId: form.categoryId,
              paymentMethodId: form.paymentMethodId,
            }),
          })
        : await fetch("/api/split-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: form.title.trim(),
              amount: total,
              installmentCount: form.count,
              occurredAt: form.start,
              downPayment: down > 0 ? down : null,
              payDownPaymentNow: form.payFirstNow,
              categoryId: form.categoryId || null,
              paymentMethodId: form.paymentMethodId || null,
            }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "تعذّر الحفظ، حاول مرة أخرى");
        return;
      }
      const created = isEdit ? null : await res.json().catch(() => null);
      toast.success(
        isEdit ? "تم تحديث الدفعات المعلّقة" : `قُسّم المبلغ على ${form.count} ${form.count === 1 ? "دفعة" : "دفعات"}`
      );
      onOpenChange(false);
      if (created?.id) router.push(`/splits/${created.id}`);
      else router.refresh();
    });
  };

  const preview =
    schedule.length > 4 ? [...schedule.slice(0, 3), null, schedule.at(-1)!] : schedule;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <ServiceAvatar title={form.title || "؟"} className="h-11 w-11" />
              <div className="min-w-0">
                <DialogTitle>{isEdit ? "تعديل التقسيط" : "تقسيط جديد"}</DialogTitle>
                <DialogDescription>
                  {isEdit
                    ? "يُعاد حساب الدفعات المعلّقة فقط — المدفوعة لا تتغيّر."
                    : "شراء بالتقسيط (תשלומים) — نذكّرك بكل دفعة ونسجّلها في مصروفاتك."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div>
                <Label htmlFor="split-title">ماذا اشتريت؟</Label>
                <Input
                  id="split-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="ثلاجة، هاتف، أثاث…"
                  maxLength={120}
                  autoFocus={!isEdit}
                />
              </div>
              <div>
                <Label htmlFor="split-amount">المبلغ الإجمالي (₪)</Label>
                <Input
                  id="split-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  className="num font-semibold"
                />
              </div>
            </div>

            <div>
              <Label>عدد الدفعات</Label>
              <div className="flex flex-wrap gap-1.5">
                {COUNT_CHIPS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      set("count", n);
                      setCustomCount(false);
                    }}
                    aria-pressed={!customCount && form.count === n}
                    className={cn(
                      "num h-9 min-w-11 rounded-xl border px-3 text-sm font-semibold transition-colors",
                      !customCount && form.count === n
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomCount(true)}
                  aria-pressed={customCount}
                  className={cn(
                    "h-9 rounded-xl border px-3 text-sm font-semibold transition-colors",
                    customCount
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  عدد آخر
                </button>
              </div>
              {customCount && (
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_INSTALLMENT_COUNT}
                  value={form.count}
                  onChange={(e) => set("count", Math.trunc(Number(e.target.value)) || 1)}
                  className="num mt-2 w-32"
                  aria-label="عدد الدفعات"
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="split-start">تاريخ أول دفعة</Label>
                <Input id="split-start" type="date" value={form.start} onChange={(e) => set("start", e.target.value)} />
              </div>
              {form.count > 1 && (
                <div>
                  <Label htmlFor="split-down">{DOWN_PAYMENT_LABEL} (اختياري)</Label>
                  <Input
                    id="split-down"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.down}
                    onChange={(e) => set("down", e.target.value)}
                    placeholder="تقسيم متساوٍ"
                    aria-invalid={downInvalid}
                    className="num"
                  />
                </div>
              )}
              {paymentMethods.length > 0 && (
                <div>
                  <Label htmlFor="split-method">طريقة الدفع</Label>
                  <Select id="split-method" value={form.paymentMethodId} onChange={(e) => set("paymentMethodId", e.target.value)}>
                    <option value="">غير محددة</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {categories.length > 0 && (
                <div>
                  <Label htmlFor="split-category">الفئة</Label>
                  <Select id="split-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    <option value="">بدون فئة</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {!isEdit && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-800">الدفعة الأولى مدفوعة الآن</span>
                  <span className="block text-xs text-slate-500">تُسجَّل فوراً في مصروفات هذا الشهر</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.payFirstNow}
                  onChange={(e) => set("payFirstNow", e.target.checked)}
                  className="h-5 w-5 accent-indigo-600"
                />
              </label>
            )}

            {schedule.length > 0 && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <CalendarClock className="h-4 w-4 text-indigo-500" /> الجدول
                  </p>
                  <p className="text-xs text-slate-500">
                    ينتهي {formatMonth(schedule.at(-1)!.date)}
                  </p>
                </div>
                <ol className="mt-3 space-y-1.5">
                  {preview.map((row, i) =>
                    row ? (
                      <li key={row.date + i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{formatDay(row.date)}</span>
                        <span className="num font-semibold text-slate-900">{formatCurrencyPrecise(row.amount)}</span>
                      </li>
                    ) : (
                      <li key="gap" className="text-center text-xs text-slate-400">
                        ⋯ {schedule.length - 4} دفعات أخرى بقيمة {formatCurrency(schedule[1]!.amount)}
                      </li>
                    )
                  )}
                </ol>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="brand" disabled={isPending} className="min-w-32">
              {isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء التقسيط"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
