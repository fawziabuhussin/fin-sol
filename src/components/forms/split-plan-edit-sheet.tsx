"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DOWN_PAYMENT_LABEL,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { formatCurrency } from "@/lib/utils";

export function SplitPlanEditSheet({
  plan,
  paymentMethods,
  triggerLabel = "تعديل كل الدفعات",
}: {
  plan: {
    id: string;
    title: string;
    totalAmount: number;
    installmentCount: number;
    firstPaymentAmount: number | null;
    startDate: string;
    paymentMethodId: string | null;
  };
  paymentMethods: { id: string; name: string }[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(plan.title);
  const [totalAmount, setTotalAmount] = useState(plan.totalAmount);
  const [installmentCount, setInstallmentCount] = useState(plan.installmentCount);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(
    plan.firstPaymentAmount ?? 0
  );
  const [startDate, setStartDate] = useState(plan.startDate);
  const [paymentMethodId, setPaymentMethodId] = useState(plan.paymentMethodId ?? "");

  const recurring = useMemo(() => {
    if (installmentCount < 2) return 0;
    return (
      recurringFromSplit(
        totalAmount,
        installmentCount,
        firstPaymentAmount > 0 ? firstPaymentAmount : null
      ) ?? 0
    );
  }, [totalAmount, firstPaymentAmount, installmentCount]);

  const submit = () => {
    startTransition(async () => {
      const res = await fetch(`/api/split-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          totalAmount,
          installmentCount,
          firstPaymentAmount: firstPaymentAmount > 0 ? firstPaymentAmount : 0,
          startDate,
          paymentMethodId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "فشل تحديث الأقساط");
        return;
      }
      toast.success("تم تحديث الدفعات المعلّقة");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>تعديل كل الدفعات — {plan.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <p className="text-xs text-slate-500">
            يحدّث الأقساط المعلّقة فقط. الدفعات المسجّلة لا تتغيّر.
          </p>
          <div>
            <Label>الاسم</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>المبلغ الإجمالي</Label>
            <Input
              type="number"
              step="0.01"
              value={totalAmount || ""}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>عدد الدفعات (1–24)</Label>
            <Select
              value={String(installmentCount)}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "دفعة واحدة" : `${n} دفعات`}
                </option>
              ))}
            </Select>
          </div>
          {installmentCount > 1 && (
            <div>
              <Label>{DOWN_PAYMENT_LABEL} (اختياري)</Label>
              <Input
                type="number"
                step="0.01"
                value={firstPaymentAmount || ""}
                onChange={(e) => setFirstPaymentAmount(Number(e.target.value))}
                placeholder="اتركه 0 لتقسيم متساوٍ"
              />
            </div>
          )}
          <div>
            <Label>تاريخ البداية</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          {paymentMethods.length > 0 && (
            <div>
              <Label>طريقة الدفع</Label>
              <Select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
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
          {installmentCount > 1 && recurring > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              القسط الشهري بعد المقدّمة: {formatCurrency(recurring)}
            </p>
          )}
          <Button className="w-full" onClick={submit} disabled={isPending}>
            حفظ التعديلات على المعلّق
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
