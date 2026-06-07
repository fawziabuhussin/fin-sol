"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Coins, DollarSign, Minus, Plus } from "lucide-react";
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

  const [mode, setMode] = useState<"TRANSACTION" | "SAVINGS_ASSET">("TRANSACTION");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(today);
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [assetKind, setAssetKind] = useState<"USD" | "GOLD">("USD");
  const [assetQuantity, setAssetQuantity] = useState("");
  const [assetUnitPrice, setAssetUnitPrice] = useState("");
  const [goldKarat, setGoldKarat] = useState(21);
  const [liveUsdIls, setLiveUsdIls] = useState<number | null>(null);

  const fetchLiveUsd = useCallback(async () => {
    try {
      const res = await fetch("/api/savings/market-rates?karat=21", {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setLiveUsdIls(data.usdIls);
    } catch {
      /* optional preview */
    }
  }, []);

  useEffect(() => {
    if (open && mode === "SAVINGS_ASSET" && assetKind === "USD") {
      fetchLiveUsd();
    }
  }, [open, mode, assetKind, fetchLiveUsd]);

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
    if (mode === "SAVINGS_ASSET") {
      const qty = Number(assetQuantity);
      const price = Number(assetUnitPrice);
      if (!qty || qty <= 0) {
        toast.error("أدخل الكمية");
        return;
      }
      if (assetKind === "GOLD" && (!price || price <= 0)) {
        toast.error("أدخل سعر الغرام");
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "SAVINGS_ASSET",
            payload: {
              kind: assetKind,
              quantity: qty,
              ...(assetKind === "GOLD" ? { unitPrice: price, goldKarat } : {}),
              purchasedAt: occurredAt,
              notes: description || "",
            },
          }),
        });
        if (!res.ok) {
          toast.error("تعذّر الحفظ");
          return;
        }
        toast.success(
          assetKind === "USD"
            ? `تمت إضافة ${qty}$ للادخار`
            : `تمت إضافة ${qty} غرام ذهب`
        );
        reset();
        onOpenChange(false);
        router.refresh();
      });
      return;
    }

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
          {/* Mode: transaction vs savings asset */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("TRANSACTION")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                mode === "TRANSACTION"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Coffee className="h-4 w-4" /> معاملة
            </button>
            <button
              type="button"
              onClick={() => setMode("SAVINGS_ASSET")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                mode === "SAVINGS_ASSET"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Coins className="h-4 w-4" /> ادخار
            </button>
          </div>

          {mode === "SAVINGS_ASSET" ? (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAssetKind("USD")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                    assetKind === "USD"
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  <DollarSign className="h-4 w-4" /> دولار
                </button>
                <button
                  type="button"
                  onClick={() => setAssetKind("GOLD")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                    assetKind === "GOLD"
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  <Coins className="h-4 w-4" /> ذهب
                </button>
              </div>
              {assetKind === "USD" ? (
                <div className="space-y-3">
                  <div>
                    <Label>المبلغ ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={assetQuantity}
                      onChange={(e) => setAssetQuantity(e.target.value)}
                      placeholder="1200"
                    />
                  </div>
                  {liveUsdIls != null && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      سعر الصرف الحي: {liveUsdIls} ₪/$
                      {assetQuantity && Number(assetQuantity) > 0 && (
                        <>
                          {" "}
                          · القيمة ≈{" "}
                          {Math.round(
                            Number(assetQuantity) * liveUsdIls
                          ).toLocaleString("ar-IL")}{" "}
                          ₪
                        </>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الوزن (غرام)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={assetQuantity}
                      onChange={(e) => setAssetQuantity(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <Label>سعر الغرام (₪)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={assetUnitPrice}
                      onChange={(e) => setAssetUnitPrice(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {assetKind === "GOLD" && (
                <div>
                  <Label>العيار</Label>
                  <Select
                    value={String(goldKarat)}
                    onChange={(e) => setGoldKarat(Number(e.target.value))}
                  >
                    <option value="14">14K</option>
                    <option value="18">18K</option>
                    <option value="21">21K</option>
                    <option value="24">24K</option>
                  </Select>
                </div>
              )}
              <div>
                <Label>تاريخ الشراء</Label>
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </div>
              <div>
                <Label>ملاحظة</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مصدر الشراء..."
                />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

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
