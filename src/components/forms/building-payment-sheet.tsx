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
import { type PaymentPlanInput } from "@/lib/validations/payment-plan";
import {
  DOWN_PAYMENT_LABEL,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { formatCurrency } from "@/lib/utils";

export type ExistingPaymentPlan = {
  id: string;
  title?: string | null;
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
  forceCreate = false,
}: {
  projectId: string;
  projectTitle: string;
  paymentMethods: { id: string; name: string }[];
  defaultTotal?: number;
  defaultPayee?: string;
  triggerLabel?: string;
  existingPlan?: ExistingPaymentPlan | null;
  /** When true, always POST a new plan even if existingPlan is set */
  forceCreate?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(existingPlan) && !forceCreate;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"FULL" | "INSTALLMENTS">("INSTALLMENTS");
  const [totalAmount, setTotalAmount] = useState(defaultTotal);
  const [installmentCount, setInstallmentCount] = useState(4);
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(0);
  const [payFirstNow, setPayFirstNow] = useState(false);
  const [payeeName, setPayeeName] = useState(defaultPayee);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [planTitle, setPlanTitle] = useState("");

  const loadFromPlan = (plan: ExistingPaymentPlan | null | undefined) => {
    if (plan) {
      setMode(plan.mode === "FULL" ? "FULL" : "INSTALLMENTS");
      setTotalAmount(plan.totalAmount);
      setInstallmentCount(plan.installmentCount ?? 4);
      setFirstPaymentAmount(plan.firstPaymentAmount ?? 0);
      setPayFirstNow(false);
      setPayeeName(plan.payeeName ?? defaultPayee);
      setStartDate(plan.startDate ?? new Date().toISOString().slice(0, 10));
      setPaymentMethodId(plan.paymentMethodId ?? "");
      setPlanTitle(plan.title ?? "");
    } else {
      setPlanTitle("");
      setMode(defaultTotal > 0 ? "INSTALLMENTS" : "FULL");
      setTotalAmount(defaultTotal);
      setInstallmentCount(4);
      setFirstPaymentAmount(0);
      setPayFirstNow(false);
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
    return (
      recurringFromSplit(
        totalAmount,
        installmentCount,
        firstPaymentAmount > 0 ? firstPaymentAmount : null
      ) ?? 0
    );
  }, [mode, totalAmount, firstPaymentAmount, installmentCount]);

  const submit = () => {
    startTransition(async () => {
      if (isEdit && existingPlan) {
        const res = await fetch(`/api/payment-plans/${existingPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: planTitle || undefined,
            mode,
            totalAmount,
            installmentCount: mode === "INSTALLMENTS" ? installmentCount : undefined,
            firstPaymentAmount:
              mode === "INSTALLMENTS" && firstPaymentAmount > 0
                ? firstPaymentAmount
                : 0,
            payeeName,
            paymentMethodId,
            startDate,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          toast.error(err?.error || "فشل تحديث خطة الدفع");
          return;
        }
        toast.success("تم تحديث كل الدفعات المعلّقة");
      } else {
        const payload: PaymentPlanInput = {
          title: planTitle || undefined,
          mode,
          totalAmount,
          installmentCount: mode === "INSTALLMENTS" ? installmentCount : undefined,
          firstPaymentAmount:
            mode === "INSTALLMENTS" && firstPaymentAmount > 0
              ? firstPaymentAmount
              : undefined,
          payeeName,
          paymentMethodId,
          startDate,
          payFirstNow: !isEdit && payFirstNow,
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
            {isEdit ? "تعديل كل الدفعات" : "خطة دفع"} — {projectTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label>اسم الخطة (اختياري)</Label>
            <Input
              value={planTitle}
              placeholder="مثال: مرحلة 1، دفعة أولى..."
              onChange={(e) => setPlanTitle(e.target.value)}
            />
          </div>
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
                <Label>عدد الأقساط الشهرية (1–24)</Label>
                <Select
                  value={String(installmentCount)}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "شهر واحد" : `${n} أشهر`}
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
                    min={0}
                    value={firstPaymentAmount || ""}
                    onChange={(e) => setFirstPaymentAmount(Number(e.target.value))}
                    placeholder="اتركه فارغاً لتقسيم متساوٍ"
                  />
                </div>
              )}
              {installmentCount > 1 && (
                <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
                  {firstPaymentAmount > 0 ? (
                    <>
                      {DOWN_PAYMENT_LABEL}:{" "}
                      <strong>{formatCurrency(firstPaymentAmount)}</strong>
                      {" · "}
                      {installmentCount - 1} أقساط ×{" "}
                      <strong>{formatCurrency(recurring)}</strong>
                    </>
                  ) : (
                    <>
                      قيمة القسط الشهري:{" "}
                      <strong>{formatCurrency(recurring || totalAmount / installmentCount)}</strong>
                    </>
                  )}
                </div>
              )}
              {!isEdit && installmentCount >= 1 && (
                <button
                  type="button"
                  onClick={() => setPayFirstNow((v) => !v)}
                  className={
                    payFirstNow
                      ? "flex w-full items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-50 px-3 py-2 text-start text-sm font-medium text-indigo-800"
                      : "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-start text-sm font-medium text-slate-700"
                  }
                >
                  <span
                    className={
                      payFirstNow
                        ? "flex h-5 w-5 items-center justify-center rounded border border-indigo-600 bg-indigo-600 text-white"
                        : "flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white"
                    }
                  >
                    {payFirstNow ? "✓" : ""}
                  </span>
                  {firstPaymentAmount > 0
                    ? `ادفع ${DOWN_PAYMENT_LABEL} الآن`
                    : "ادفع القسط الأول الآن"}
                </button>
              )}
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
              «تعديل كل الدفعات» يحدّث الأقساط المعلّقة معاً (المبلغ، العدد،
              المقدّمة، والتواريخ). الدفعات المدفوعة وأي قسط عدّلته لوحده سابقاً
              وهو مدفوع يبقى كما هو. زيادة المبلغ الإجمالي تعيد المشروع إلى «قيد
              التنفيذ» إذا كان مكتملاً.
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
