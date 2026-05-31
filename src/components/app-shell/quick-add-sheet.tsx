"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type QuickAddLookups = {
  categories: { id: string; name: string; kind: string }[];
  paymentMethods: { id: string; name: string }[];
};

const today = () => new Date().toISOString().slice(0, 10);

export function QuickAddSheet({
  open,
  onOpenChange,
  lookups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups: QuickAddLookups;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(today);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");

  const categories = useMemo(
    () => lookups.categories.filter((c) => c.kind === type),
    [lookups.categories, type]
  );

  function reset() {
    setAmount("");
    setCategoryId("");
    setDescription("");
    setOccurredAt(today());
    setPaymentMethodId("");
  }

  function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    const payload = {
      type,
      amount: value,
      occurredAt,
      description: description || "",
      notes: "",
      categoryId: categoryId || null,
      paymentMethodId: paymentMethodId || null,
      currency: "ILS",
    };

    startTransition(async () => {
      const res = await fetch("/api/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "TRANSACTION", payload }),
      });
      if (!res.ok) {
        toast.error("تعذّر الحفظ");
        return;
      }
      toast.success(
        type === "EXPENSE" ? "تمت إضافة المصروف" : "تمت إضافة الدخل"
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Coffee className="h-4 w-4" />
            </span>
            إضافة سريعة
          </SheetTitle>
          <SheetDescription>
            مصاريف يومية بسيطة (قهوة، مشتريات اليوم...). للمشاريع استخدم صفحة المشاريع.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Expense / Income toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setType("EXPENSE");
                setCategoryId("");
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                type === "EXPENSE"
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Minus className="h-4 w-4" /> مصروف
            </button>
            <button
              type="button"
              onClick={() => {
                setType("INCOME");
                setCategoryId("");
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                type === "INCOME"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Plus className="h-4 w-4" /> دخل
            </button>
          </div>

          {/* Big amount */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-center">
            <Label className="text-xs text-slate-500">المبلغ</Label>
            <div className="mt-1 flex items-center justify-center gap-1">
              <input
                autoFocus
                inputMode="decimal"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={cn(
                  "w-40 bg-transparent text-center text-4xl font-extrabold outline-none placeholder:text-slate-300",
                  type === "EXPENSE" ? "text-rose-600" : "text-emerald-600"
                )}
              />
              <span className="text-lg font-bold text-slate-400">₪</span>
            </div>
          </div>

          {/* Category chips */}
          {categories.length > 0 && (
            <div>
              <Label className="text-xs text-slate-500">الفئة</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCategoryId((prev) => (prev === c.id ? "" : c.id))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm font-medium transition-all",
                      categoryId === c.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
            {lookups.paymentMethods.length > 0 && (
              <div>
                <Label>طريقة الدفع</Label>
                <Select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                >
                  <option value="">—</option>
                  {lookups.paymentMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>ملاحظة</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="قهوة، بقالة، ..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={isPending} onClick={submit}>
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
