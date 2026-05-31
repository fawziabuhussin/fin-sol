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
  calcRecurringInstallment,
  type PaymentPlanInput,
} from "@/lib/validations/payment-plan";
import { formatCurrency } from "@/lib/utils";

export function BuildingPaymentSheet({
  projectId,
  projectTitle,
  paymentMethods,
  defaultTotal = 0,
  defaultPayee = "",
  triggerLabel = "خطة دفع",
}: {
  projectId: string;
  projectTitle: string;
  paymentMethods: { id: string; name: string }[];
  defaultTotal?: number;
  defaultPayee?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"FULL" | "INSTALLMENTS">(
    defaultTotal > 0 ? "INSTALLMENTS" : "FULL"
  );
  const [totalAmount, setTotalAmount] = useState(defaultTotal);
  const [installmentCount, setInstallmentCount] = useState(4);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(
    defaultTotal > 0 ? Math.round(defaultTotal * 0.25) : 0
  );
  const [payeeName, setPayeeName] = useState(defaultPayee);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethodId, setPaymentMethodId] = useState("");

  const recurring = useMemo(() => {
    if (mode !== "INSTALLMENTS" || installmentCount < 2) return 0;
    return calcRecurringInstallment(totalAmount, firstPaymentAmount, installmentCount);
  }, [mode, totalAmount, firstPaymentAmount, installmentCount]);

  const submit = () => {
    const payload: PaymentPlanInput = {
      mode,
      totalAmount,
      installmentCount: mode === "INSTALLMENTS" ? installmentCount : undefined,
      firstPaymentAmount: mode === "INSTALLMENTS" ? firstPaymentAmount : undefined,
      payeeName,
      paymentMethodId,
      startDate,
    };

    startTransition(async () => {
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
          <SheetTitle>خطة دفع — {projectTitle}</SheetTitle>
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
          <Button className="w-full" disabled={isPending} onClick={submit}>
            {isPending ? "جاري الحفظ..." : "حفظ الخطة"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
