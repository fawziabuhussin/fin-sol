"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import {
  DOWN_PAYMENT_LABEL,
  resolveInstallmentAmounts,
} from "@/lib/payment-plan";
import { localTodayIso } from "@/lib/dates";
import type { SplitPlanView } from "@/lib/split-payments";

type SplitPlan = SplitPlanView;

export function SplitsPageClient({
  items,
  categories,
  paymentMethods,
}: {
  items: SplitPlan[];
  categories: { id: string; name: string }[];
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    occurredAt: localTodayIso(),
    installmentCount: 3,
    downPayment: "",
    payDownPaymentNow: false,
    categoryId: "",
    paymentMethodId: "",
  });

  const splitPreview = useMemo(() => {
    const value = Number(form.amount);
    if (!value || value <= 0) return null;
    const down = form.downPayment ? Number(form.downPayment) : null;
    if (down != null && down >= value) return { invalid: true as const };
    const amounts = resolveInstallmentAmounts(
      value,
      form.installmentCount,
      down
    );
    return {
      invalid: false as const,
      first: amounts[0] ?? 0,
      monthly: amounts[1] ?? amounts[0] ?? 0,
      hasDown: down != null && down > 0,
    };
  }, [form.amount, form.installmentCount, form.downPayment]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, p) => {
        acc.total += p.totalAmount;
        acc.paid += p.paid;
        acc.remaining += p.remaining;
        return acc;
      },
      { total: 0, paid: 0, remaining: 0 }
    );
  }, [items]);

  const submit = () => {
    const value = Number(form.amount);
    if (!value || value <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const down = form.downPayment ? Number(form.downPayment) : 0;
    if (down > 0 && down >= value) {
      toast.error("المقدمة يجب أن تكون أصغر من المبلغ الإجمالي");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/split-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          occurredAt: form.occurredAt,
          description: form.description || "",
          installmentCount: form.installmentCount,
          downPayment: down > 0 ? down : null,
          payDownPaymentNow: form.payDownPaymentNow,
          categoryId: form.categoryId || null,
          paymentMethodId: form.paymentMethodId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(
          typeof err?.error === "string" ? err.error : "تعذّر حفظ التقسيط"
        );
        return;
      }
      const created = await res.json().catch(() => null);
      toast.success(`تم تقسيم المصروف على ${form.installmentCount} أشهر`);
      setShowAdd(false);
      setForm({
        description: "",
        amount: "",
        occurredAt: localTodayIso(),
        installmentCount: 3,
        downPayment: "",
        payDownPaymentNow: false,
        categoryId: "",
        paymentMethodId: "",
      });
      if (created?.id) router.push(`/splits/${created.id}`);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {items.length === 0
                ? "لا أقساط بعد — أضف مصروفاً مقسّطاً من هنا أو من الإضافة السريعة"
                : `${items.length} مصروف مقسّط`}
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-4 w-4" /> إضافة تقسيط
            </Button>
          </div>
          {items.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: "الإجمالي", value: totals.total },
                { label: "المدفوع", value: totals.paid },
                { label: "المتبقي", value: totals.remaining },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className="text-lg font-extrabold text-slate-900">
                    {formatCurrency(kpi.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">مصروف مقسّط جديد</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>الوصف</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="مثال: ثلاجة، هاتف، أثاث"
              />
            </div>
            <div>
              <Label>المبلغ الإجمالي</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>تاريخ البداية</Label>
              <Input
                type="date"
                value={form.occurredAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, occurredAt: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>عدد الدفعات (תשלומים)</Label>
              <Select
                value={String(form.installmentCount)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    installmentCount: Number(e.target.value),
                  }))
                }
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "دفعة واحدة" : `${n} دفعات`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{DOWN_PAYMENT_LABEL} (اختياري)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.downPayment}
                onChange={(e) =>
                  setForm((f) => ({ ...f, downPayment: e.target.value }))
                }
                placeholder="تقسيم متساوٍ إن تُرك فارغاً"
              />
            </div>
            {categories.length > 0 && (
              <div>
                <Label>التصنيف</Label>
                <Select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {paymentMethods.length > 0 && (
              <div>
                <Label>طريقة الدفع</Label>
                <Select
                  value={form.paymentMethodId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentMethodId: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {splitPreview?.invalid ? (
              <p className="sm:col-span-2 text-xs text-rose-700">
                المقدمة يجب أن تكون أصغر من المبلغ الإجمالي
              </p>
            ) : splitPreview ? (
              <p className="sm:col-span-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                {splitPreview.hasDown
                  ? `${DOWN_PAYMENT_LABEL}: ${formatCurrency(splitPreview.first)} · ${form.installmentCount - 1} × ${formatCurrency(splitPreview.monthly)}`
                  : `${form.installmentCount} دفعات × ${formatCurrency(splitPreview.monthly)}`}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, payDownPaymentNow: !f.payDownPaymentNow }))
              }
              className={cn(
                "sm:col-span-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-medium",
                form.payDownPaymentNow
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              ادفع القسط الأول الآن
            </button>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={isPending}>
                حفظ التقسيط
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !showAdd ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-slate-500">
            من الإضافة السريعة اختر مصروف + بطاقة + عدد الدفعات، أو اضغط «إضافة
            تقسيط» أعلاه.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((plan) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link href={`/splits/${plan.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="truncate">{plan.title}</span>
                      <CreditCard className="h-4 w-4 shrink-0 text-slate-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-extrabold text-slate-900">
                        {formatCurrency(plan.totalAmount)}
                      </span>
                      <span className="text-slate-500">
                        {plan.paidCount}/{plan.installmentCount} دفعات
                      </span>
                    </div>
                    <Progress value={plan.percentComplete} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>مدفوع {formatCurrency(plan.paid)}</span>
                      <span>متبقي {formatCurrency(plan.remaining)}</span>
                    </div>
                    {plan.nextDue && (
                      <p className="flex items-center gap-1 text-xs text-amber-700">
                        <Calendar className="h-3.5 w-3.5" />
                        التالي: {plan.nextDue.label} · {plan.nextDue.dueDate} ·{" "}
                        {formatCurrency(plan.nextDue.amount)}
                      </p>
                    )}
                    {plan.paymentMethodName && (
                      <p className="text-xs text-slate-400">{plan.paymentMethodName}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
