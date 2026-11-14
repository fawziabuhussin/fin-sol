"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { localTodayIso } from "@/lib/dates";
import type { SplitInstallment } from "./split-utils";

/**
 * Add a new installment to a plan, or edit one installment (only that one).
 * Remount with a `key` per target so the form initialises from props.
 */
export function InstallmentDialog({
  open,
  onOpenChange,
  planId,
  installment,
  defaultAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  installment: SplitInstallment | null;
  defaultAmount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = installment != null;
  const isPaid = installment?.status === "PAID";
  const [form, setForm] = useState(() => ({
    label: installment?.label ?? "",
    amount: String(installment?.amount ?? (defaultAmount || "")),
    dueDate: installment?.dueDate ?? localTodayIso(),
    paidAt: installment?.paidAt ?? installment?.dueDate ?? "",
    notes: installment?.notes ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError("أدخل مبلغاً أكبر من صفر");
    if (!form.dueDate) return setError("اختر تاريخ الاستحقاق");
    setError(null);
    startTransition(async () => {
      const res = isEdit
        ? await fetch(`/api/split-installments/${installment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: form.label.trim(),
              amount,
              dueDate: form.dueDate,
              notes: form.notes.trim(),
              ...(isPaid && form.paidAt ? { occurredAt: form.paidAt } : {}),
            }),
          })
        : await fetch(`/api/split-plans/${planId}/installments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: form.label.trim(),
              amount,
              dueDate: form.dueDate,
              notes: form.notes.trim(),
            }),
          });
      if (!res.ok) {
        setError(isEdit ? "تعذّر حفظ الدفعة" : "تعذّر إضافة الدفعة");
        return;
      }
      toast.success(isEdit ? "تم تعديل هذه الدفعة فقط" : "تمت إضافة الدفعة");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? `تعديل الدفعة — ${installment.label}` : "دفعة جديدة"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "يغيّر هذه الدفعة فقط؛ باقي الأقساط تبقى كما هي."
                : "أضف دفعة إضافية لهذا التقسيط (مثلاً فائدة أو رسوم)."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="inst-label">الوصف</Label>
              <Input
                id="inst-label"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="الدفعة السابعة"
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inst-amount">المبلغ (₪)</Label>
                <Input
                  id="inst-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className="num font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="inst-due">تاريخ الاستحقاق</Label>
                <Input
                  id="inst-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </div>
            </div>
            {isPaid && (
              <div>
                <Label htmlFor="inst-paid">تاريخ الدفع الفعلي</Label>
                <Input
                  id="inst-paid"
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => set("paidAt", e.target.value)}
                />
                <p className="mt-1.5 text-xs text-slate-500">يُحدّث تاريخ المصروف المسجّل أيضاً.</p>
              </div>
            )}
            <div>
              <Label htmlFor="inst-notes">ملاحظات</Label>
              <Input
                id="inst-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={300}
              />
            </div>
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
              {isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
