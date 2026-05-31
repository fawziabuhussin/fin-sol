"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  calcRecurringInstallment,
  type PaymentPlanInput,
} from "@/lib/validations/payment-plan";
import { formatCurrency } from "@/lib/utils";

export type ExistingPaymentPlan = {
  id: string;
  mode: string;
  totalAmount: number;
  installmentCount: number | null;
  firstPaymentAmount: number | null;
  recurringAmount: number | null;
  payeeName: string | null;
  startDate: string | null;
  paymentMethodId: string | null;
};

export function BuildingPaymentSheet({
  projectId,
  projectTitle,
  paymentMethods,
  defaultTotal = 0,
  defaultPayee = "",
  triggerLabel = "خطة دفع",
  existingPlan,
}: {
  projectId: string;
  projectTitle: string;
  paymentMethods: { id: string; name: string }[];
  defaultTotal?: number;
  defaultPayee?: string;
  triggerLabel?: string;
  existingPlan?: ExistingPaymentPlan | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(existingPlan);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"FULL" | "INSTALLMENTS">("INSTALLMENTS");
  const [totalAmount, setTotalAmount] = useState(defaultTotal);
  const [installmentCount, setInstallmentCount] = useState(4);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(0);
  const [payeeName, setPayeeName] = useState(defaultPayee);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethodId, setPaymentMethodId] = useState("");

  const loadFromPlan = (plan: ExistingPaymentPlan | null | undefined) => {
    if (plan) {
      setMode(plan.mode === "FULL" ? "FULL" : "INSTALLMENTS");
      setTotalAmount(plan.totalAmount);
      setInstallmentCount(plan.installmentCount ?? 4);
      setFirstPaymentAmount(plan.firstPaymentAmount ?? 0);
      setPayeeName(plan.payeeName ?? defaultPayee);
      setStartDate(plan.startDate ?? new Date().toISOString().slice(0, 10));
      setPaymentMethodId(plan.paymentMethodId ?? "");
    } else {
      setMode(defaultTotal > 0 ? "INSTALLMENTS" : "FULL");
      setTotalAmount(defaultTotal);
      setInstallmentCount(4);
      setFirstPaymentAmount(defaultTotal > 0 ? Math.round(defaultTotal * 0.25) : 0);
      setPayeeName(defaultPayee);
      setStartDate(new Date().toISOString().slice(0, 10));
      setPaymentMethodId("");
    }
  };

  useEffect(() => {
    if (open) loadFromPlan(existingPlan);
  }, [open, existingPlan]);

  const recurring = useMemo(() => {
    if (mode !== "INSTALLMENTS" || installmentCount < 2) return 0;
    return calcRecurringInstallment(totalAmount, firstPaymentAmount, installmentCount);
  }, [mode, totalAmount, firstPaymentAmount, installmentCount]);

  const submit = () => {
    startTransition(async () => {
      if (isEdit && existingPlan) {
        const res = await fetch(`/api/payment-plans/${existingPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            totalAmount,
            installmentCount: mode === "INSTALLMENTS" ? installmentCount : undefined,
            firstPaymentAmount: mode === "INSTALLMENTS" ? firstPaymentAmount : undefined,
            payeeName,
            paymentMethodId,
            startDate,
          }),
        });
        if (!res.ok) {
          toast.error("فشل تحديث خطة الدفع");
          return;
        }
        toast.success("تم تحديث خطة الدفع");
      } else {
        const payload: PaymentPlanInput = {
          mode,
          totalAmount,
          installmentCount: mode === "INSTALLMENTS" ? installmentCount : undefined,
          firstPaymentAmount: mode === "INSTALLMENTS" ? firstPaymentAmount : undefined,
          payeeName,
          paymentMethodId,
          startDate,
        };
        const res = await fetch(`/api/projects/${projectId}/payment-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          toast.error("فشل حفظ خطة الدفع");
          return;
        }
        toast.success("تم إنشاء خطة الدفع");
      }
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
          <SheetTitle>
            {isEdit ? "تعديل" : "خطة دفع"} — {projectTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label>لمن الدفع؟ (المستفيد / المقاول)</Label>
            <Input
              value={payeeName}
              placeholder="اسم الشخص أو الجهة"
              onChange={(e) => setPayeeName(e.target.value)}
            />
          </div>
          <div>
            <Label>نوع الدفع</Label>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as "FULL" | "INSTALLMENTS")}
            >
              <option value="FULL">دفعة كاملة</option>
              <option value="INSTALLMENTS">أقساط</option>
            </Select>
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
            <Label>تاريخ البداية (نقطة الانطلاق)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          {mode === "INSTALLMENTS" && (
            <>
              <div>
                <Label>عدد الأقساط</Label>
                <Input
                  type="number"
                  min={2}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>الدفعة الأولى</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={firstPaymentAmount || ""}
                  onChange={(e) => setFirstPaymentAmount(Number(e.target.value))}
                />
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                قيمة القسط المتبقي:{" "}
                <strong>{formatCurrency(recurring)}</strong>
              </div>
            </>
          )}
          <div>
            <Label>طريقة الدفع</Label>
            <Select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
            >
              <option value="">—</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </Select>
          </div>
          {isEdit && (
            <p className="text-xs text-amber-700">
              تغيير نقطة البداية يعيد جدولة تواريخ الدفعات المعلّقة فقط. الدفعات
              المدفوعة تبقى كما هي.
            </p>
          )}
          <Button className="w-full" disabled={isPending} onClick={submit}>
            {isPending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ الخطة"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
