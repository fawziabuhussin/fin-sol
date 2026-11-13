"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
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
import { cn, formatCurrencyPrecise } from "@/lib/utils";
import { AR_MONTHS } from "@/lib/finance-labels";
import { POPULAR_SERVICES } from "@/lib/subscription-brands";
import type { SubscriptionItem } from "@/lib/subscriptions-data";
import { ServiceAvatar } from "./service-avatar";

export type Lookup = { id: string; name: string };

type FormState = {
  title: string;
  amount: string;
  billingCycle: "MONTHLY" | "YEARLY";
  billingDay: string;
  billingMonth: string;
  startMonth: string; // YYYY-MM or ""
  paymentMethodId: string;
  categoryId: string;
  notes: string;
};

function initialState(
  item: SubscriptionItem | null,
  preset: string | null,
  year: number,
  month: number
): FormState {
  if (item) {
    return {
      title: item.title,
      amount: String(item.baseAmount),
      billingCycle: item.billingCycle,
      billingDay: item.billingDay ? String(item.billingDay) : "",
      billingMonth: String(item.billingMonth ?? month),
      startMonth: item.startDate ? item.startDate.slice(0, 7) : "",
      paymentMethodId: item.paymentMethodId ?? "",
      categoryId: item.categoryId ?? "",
      notes: item.notes ?? "",
    };
  }
  return {
    title: preset ?? "",
    amount: "",
    billingCycle: "MONTHLY",
    billingDay: "1",
    billingMonth: String(month),
    startMonth: `${year}-${String(month).padStart(2, "0")}`,
    paymentMethodId: "",
    categoryId: "",
    notes: "",
  };
}

/**
 * Remount (via `key`) whenever the target changes so the form state is
 * initialised from props without syncing effects.
 */
export function SubscriptionFormDialog({
  open,
  onOpenChange,
  item,
  preset,
  year,
  month,
  paymentMethods,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SubscriptionItem | null;
  preset: string | null;
  year: number;
  month: number;
  paymentMethods: Lookup[];
  categories: Lookup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => initialState(item, preset, year, month));
  const [error, setError] = useState<string | null>(null);
  const isEdit = item != null;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const amount = Number(form.amount);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const monthly = form.billingCycle === "YEARLY" ? amount / 12 : amount;
  const yearly = form.billingCycle === "YEARLY" ? amount : amount * 12;

  const submit = () => {
    if (!form.title.trim()) return setError("اكتب اسم الخدمة");
    if (!validAmount) return setError("أدخل مبلغاً أكبر من صفر");
    setError(null);

    const payload = {
      title: form.title.trim(),
      amount,
      billingCycle: form.billingCycle,
      billingDay: form.billingDay ? Number(form.billingDay) : null,
      billingMonth: form.billingCycle === "YEARLY" ? Number(form.billingMonth) : null,
      startDate: form.startMonth ? `${form.startMonth}-01` : null,
      paymentMethodId: form.paymentMethodId || null,
      categoryId: form.categoryId || (isEdit ? null : undefined),
      notes: form.notes.trim() || null,
    };

    startTransition(async () => {
      const res = await fetch(isEdit ? `/api/subscriptions/${item.id}` : "/api/subscriptions", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "تعذّر الحفظ، حاول مرة أخرى");
        return;
      }
      toast.success(isEdit ? "تم حفظ التعديلات" : `تمت إضافة «${payload.title}»`);
      onOpenChange(false);
      router.refresh();
    });
  };

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
                <DialogTitle>{isEdit ? "تعديل الاشتراك" : "اشتراك جديد"}</DialogTitle>
                <DialogDescription>
                  {isEdit
                    ? "التغييرات تنطبق على الأشهر القادمة؛ المدفوعات المسجّلة تبقى كما هي."
                    : "سيظهر تلقائياً في كل دورة فوترة حتى تلغيه."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {!isEdit && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> خدمات شائعة
                </p>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                  {POPULAR_SERVICES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => set("title", name)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        form.title === name
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div>
                <Label htmlFor="sub-title">اسم الخدمة</Label>
                <Input
                  id="sub-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="مثال: Netflix"
                  maxLength={120}
                  autoFocus={!isEdit}
                />
              </div>
              <div>
                <Label htmlFor="sub-amount">المبلغ (₪)</Label>
                <Input
                  id="sub-amount"
                  inputMode="decimal"
                  type="number"
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
              <Label>دورة الفوترة</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    ["MONTHLY", "شهري"],
                    ["YEARLY", "سنوي"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("billingCycle", value)}
                    aria-pressed={form.billingCycle === value}
                    className={cn(
                      "rounded-lg py-2 text-sm font-semibold transition-all",
                      form.billingCycle === value
                        ? "bg-white text-slate-900 shadow-card"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {form.billingCycle === "YEARLY" && (
                <div>
                  <Label htmlFor="sub-month">شهر التجديد</Label>
                  <Select
                    id="sub-month"
                    value={form.billingMonth}
                    onChange={(e) => set("billingMonth", e.target.value)}
                  >
                    {AR_MONTHS.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="sub-day">يوم الخصم</Label>
                <Select
                  id="sub-day"
                  value={form.billingDay}
                  onChange={(e) => set("billingDay", e.target.value)}
                >
                  <option value="">بدون يوم ثابت</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sub-start">يبدأ من شهر</Label>
                <Input
                  id="sub-start"
                  type="month"
                  value={form.startMonth}
                  onChange={(e) => set("startMonth", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sub-method">طريقة الدفع</Label>
                <Select
                  id="sub-method"
                  value={form.paymentMethodId}
                  onChange={(e) => set("paymentMethodId", e.target.value)}
                >
                  <option value="">غير محددة</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              {categories.length > 0 && (
                <div>
                  <Label htmlFor="sub-category">الفئة</Label>
                  <Select
                    id="sub-category"
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                  >
                    <option value="">اشتراكات (افتراضي)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="sub-notes">ملاحظات</Label>
              <Input
                id="sub-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="خطة عائلية، يُلغى في الصيف…"
                maxLength={300}
              />
            </div>

            {validAmount && (
              <div className="flex items-center justify-between rounded-2xl bg-indigo-50/70 px-4 py-3 text-sm">
                <span className="text-indigo-900/80">التكلفة الفعلية</span>
                <span className="num font-semibold text-indigo-900">
                  {formatCurrencyPrecise(Math.round(monthly * 100) / 100)} شهرياً ·{" "}
                  {formatCurrencyPrecise(Math.round(yearly * 100) / 100)} سنوياً
                </span>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="brand" disabled={isPending} className="min-w-28">
              {isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة الاشتراك"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
