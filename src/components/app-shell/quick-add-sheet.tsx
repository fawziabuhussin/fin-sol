"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Coins, CreditCard, DollarSign, FolderKanban, ListPlus, Minus, Plus, Check } from "lucide-react";
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
import { cn, formatCurrency } from "@/lib/utils";
import { isLocalTodayDate, localTodayIso } from "@/lib/dates";
import {
  DOWN_PAYMENT_LABEL,
  resolveInstallmentAmounts,
} from "@/lib/payment-plan";
import { isCreditCardMethod } from "@/lib/payment-methods";

export type QuickAddLookups = {
  categories: { id: string; name: string; kind: string }[];
  paymentMethods: { id: string; name: string }[];
  projects?: { id: string; title: string }[];
};

const today = localTodayIso;

function isPurchaseToday(purchasedAt: string) {
  return isLocalTodayDate(purchasedAt);
}

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

  const [mode, setMode] = useState<"TRANSACTION" | "SAVINGS_ASSET" | "PROJECT">(
    "TRANSACTION"
  );
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
  const [projectTitle, setProjectTitle] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  const [projectDate, setProjectDate] = useState(today);
  const [projectStatus, setProjectStatus] = useState<"PLANNED" | "ACTIVE">("PLANNED");
  const [projectPlacement, setProjectPlacement] = useState<"new" | "nested">("new");
  const [parentProjectId, setParentProjectId] = useState("");
  const [projectProfession, setProjectProfession] = useState("");
  const [installmentCount, setInstallmentCount] = useState(1);
  const [downPayment, setDownPayment] = useState("");
  const [payDownPaymentNow, setPayDownPaymentNow] = useState(false);
  const [expenseParentId, setExpenseParentId] = useState("");
  const parentProjects = lookups.projects ?? [];
  const selectedPaymentMethod = lookups.paymentMethods.find(
    (m) => m.id === paymentMethodId
  );
  const isCardPayment = isCreditCardMethod(selectedPaymentMethod?.name);

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
    setAssetQuantity("");
    setAssetUnitPrice("");
    setProjectTitle("");
    setProjectBudget("");
    setProjectDate(today());
    setProjectStatus("PLANNED");
    setProjectPlacement("new");
    setParentProjectId("");
    setProjectProfession("");
    setInstallmentCount(1);
    setDownPayment("");
    setPayDownPaymentNow(false);
    setExpenseParentId("");
  }

  const usdHistoricalPurchase =
    mode === "SAVINGS_ASSET" && assetKind === "USD" && !isPurchaseToday(occurredAt);

  const usdPreviewRate = usdHistoricalPurchase
    ? Number(assetUnitPrice) || 0
    : liveUsdIls ?? 0;

  const usdPreviewValue =
    assetKind === "USD" && assetQuantity && usdPreviewRate > 0
      ? Math.round(Number(assetQuantity) * usdPreviewRate)
      : null;

  const splitPreview = useMemo(() => {
    const value = Number(amount);
    if (type !== "EXPENSE" || installmentCount <= 1 || !value || value <= 0) {
      return null;
    }
    const down = downPayment ? Number(downPayment) : null;
    if (down != null && down >= value) return { invalid: true as const };
    const amounts = resolveInstallmentAmounts(value, installmentCount, down);
    return {
      invalid: false as const,
      first: amounts[0] ?? 0,
      monthly: amounts[1] ?? amounts[0] ?? 0,
      hasDown: down != null && down > 0,
    };
  }, [type, amount, installmentCount, downPayment]);

  function submit() {
    if (mode === "PROJECT") {
      const title = projectTitle.trim();
      if (title.length < 2) {
        toast.error("أدخل عنوان المشروع");
        return;
      }
      const nested = projectPlacement === "nested";
      if (nested && !parentProjectId) {
        toast.error("اختر المشروع الرئيسي من القائمة");
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "PROJECT",
            payload: {
              title,
              description: description || "",
              profession: nested ? projectProfession : "",
              totalBudget: projectBudget ? Number(projectBudget) : null,
              targetDate: projectDate || null,
              status: projectStatus,
              parentProjectId: nested ? parentProjectId : "",
            },
          }),
        });
        if (!res.ok) {
          toast.error("تعذّر الحفظ");
          return;
        }
        const created = await res.json().catch(() => null);
        toast.success(nested ? "تمت إضافة البند داخل المشروع" : "تم إنشاء المشروع");
        reset();
        onOpenChange(false);
        const dest = nested ? parentProjectId : created?.id;
        if (dest) router.push(`/projects/${dest}`);
        else router.refresh();
      });
      return;
    }

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
      if (assetKind === "USD" && !isPurchaseToday(occurredAt)) {
        if (!price || price <= 0) {
          toast.error("أدخل سعر الدولار وقت الشراء");
          return;
        }
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
              ...(assetKind === "USD" && !isPurchaseToday(occurredAt)
                ? { unitPrice: price }
                : {}),
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

    if (type === "EXPENSE" && installmentCount > 1) {
      const down = downPayment ? Number(downPayment) : 0;
      if (down > 0 && down >= value) {
        toast.error("المقدمة يجب أن تكون أصغر من المبلغ الإجمالي");
        return;
      }
      startTransition(async () => {
        const res = await fetch("/api/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "EXPENSE_INSTALLMENTS",
            payload: {
              amount: value,
              occurredAt,
              description: description || "",
              installmentCount,
              downPayment: down > 0 ? down : null,
              payDownPaymentNow,
              categoryId: categoryId || null,
              paymentMethodId: paymentMethodId || null,
              parentProjectId: expenseParentId || "",
            },
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
        toast.success(
          payDownPaymentNow
            ? `تم تقسيم المصروف على ${installmentCount} أشهر ودفع المقدّمة`
            : `تم تقسيم المصروف على ${installmentCount} أشهر`
        );
        reset();
        onOpenChange(false);
        if (created?.id) router.push(`/projects/${created.id}`);
        else router.refresh();
      });
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
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="shrink-0 border-b border-slate-100 px-6 pb-4 pt-6">
            <SheetHeader className="mb-0">
              <SheetTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Coffee className="h-4 w-4" />
                </span>
                إضافة سريعة
              </SheetTitle>
              <SheetDescription>
                {mode === "PROJECT"
                  ? "أنشئ مشروعاً رئيسياً، أو أضف بنداً تحت مشروع موجود من القائمة."
                  : "مصاريف يومية بسيطة (قهوة، مشتريات اليوم...). للمشاريع اختر تبويب المشروع."}
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Mode: transaction vs savings asset */}
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("TRANSACTION")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all sm:text-sm",
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
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all sm:text-sm",
                mode === "SAVINGS_ASSET"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Coins className="h-4 w-4" /> ادخار
            </button>
            <button
              type="button"
              onClick={() => setMode("PROJECT")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all sm:text-sm",
                mode === "PROJECT"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FolderKanban className="h-4 w-4" /> مشروع
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
                  <div>
                    <Label>تاريخ الشراء</Label>
                    <Input
                      type="date"
                      value={occurredAt}
                      onChange={(e) => {
                        setOccurredAt(e.target.value);
                        if (isPurchaseToday(e.target.value)) {
                          setAssetUnitPrice("");
                        }
                      }}
                    />
                  </div>
                  {usdHistoricalPurchase ? (
                    <div>
                      <Label>سعر الدولار وقت الشراء (₪/$)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={assetUnitPrice}
                        onChange={(e) => setAssetUnitPrice(e.target.value)}
                        placeholder="3.65"
                      />
                      <p className="mt-1.5 text-xs text-amber-700">
                        تاريخ قديم — أدخل سعر الصرف الذي دفعته يوم الشراء
                      </p>
                    </div>
                  ) : (
                    liveUsdIls != null && (
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        سعر الصرف الحي: {liveUsdIls} ₪/$
                      </p>
                    )
                  )}
                  {usdPreviewValue != null && usdPreviewValue > 0 && (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {usdHistoricalPurchase ? (
                        <>
                          سعر وقت الشراء: {usdPreviewRate} ₪/$ · القيمة ≈{" "}
                          {usdPreviewValue.toLocaleString("ar-IL")} ₪
                        </>
                      ) : (
                        <>
                          سعر الصرف الحي: {usdPreviewRate} ₪/$ · القيمة ≈{" "}
                          {usdPreviewValue.toLocaleString("ar-IL")} ₪
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
                <>
                <div>
                  <Label>تاريخ الشراء</Label>
                  <Input
                    type="date"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                </div>
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
                </>
              )}
              <div>
                <Label>ملاحظة</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مصدر الشراء..."
                />
              </div>
            </>
          ) : mode === "PROJECT" ? (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setProjectPlacement("new")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                    projectPlacement === "new"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <FolderKanban className="h-4 w-4" />
                  مشروع رئيسي
                </button>
                <button
                  type="button"
                  onClick={() => setProjectPlacement("nested")}
                  disabled={parentProjects.length === 0}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
                    projectPlacement === "nested"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                    parentProjects.length === 0 && "cursor-not-allowed opacity-50"
                  )}
                >
                  <ListPlus className="h-4 w-4" />
                  بند داخل مشروع
                </button>
              </div>

              {projectPlacement === "nested" && (
                <div>
                  <Label>أضف إلى مشروع</Label>
                  <Select
                    value={parentProjectId}
                    onChange={(e) => setParentProjectId(e.target.value)}
                  >
                    <option value="">اختر مشروعاً موجوداً...</option>
                    {parentProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">
                    المشروع الواحد يضم أكثر من بند (قاعة، DJ، مقاول...).
                  </p>
                </div>
              )}

              <div>
                <Label>العنوان</Label>
                <Input
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder={
                    projectPlacement === "nested"
                      ? "مثال: DJ، قاعة، مصور"
                      : "مثال: العرس، بناء البيت"
                  }
                />
              </div>

              {projectPlacement === "nested" && (
                <div>
                  <Label>المهنة / الدور</Label>
                  <Input
                    value={projectProfession}
                    onChange={(e) => setProjectProfession(e.target.value)}
                    placeholder="مثال: DJ، مصور"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الميزانية</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={projectBudget}
                    onChange={(e) => setProjectBudget(e.target.value)}
                  />
                </div>
                <div>
                  <Label>تاريخ البداية</Label>
                  <Input
                    type="date"
                    value={projectDate}
                    onChange={(e) => setProjectDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>الحالة</Label>
                <Select
                  value={projectStatus}
                  onChange={(e) =>
                    setProjectStatus(e.target.value as "PLANNED" | "ACTIVE")
                  }
                >
                  <option value="PLANNED">مخطط للمستقبل</option>
                  <option value="ACTIVE">قيد التنفيذ</option>
                </Select>
              </div>

              <div>
                <Label>ملاحظة</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر..."
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
                setInstallmentCount(1);
                setDownPayment("");
                setPayDownPaymentNow(false);
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
              <Label>
                {type === "EXPENSE" && installmentCount > 1
                  ? "تاريخ البداية"
                  : "التاريخ"}
              </Label>
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

          {type === "EXPENSE" && (
            <div
              className={cn(
                "space-y-3 rounded-2xl border p-4",
                isCardPayment
                  ? "border-indigo-200 bg-indigo-50/50"
                  : "border-slate-200 bg-white"
              )}
            >
              <div>
                <Label className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  عدد الدفعات (תשלומים) 1–24
                </Label>
                <Select
                  value={String(installmentCount)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setInstallmentCount(next);
                    if (next <= 1) {
                      setDownPayment("");
                      setPayDownPaymentNow(false);
                    }
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "دفعة واحدة" : `${n} دفعات`}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  اختر البطاقة ثم عدد الدفعات. يمكنك تعديل قسط واحد لاحقاً أو كل
                  الدفعات معاً.
                </p>
              </div>

              {installmentCount > 1 && (
                <>
                  <div>
                    <Label>{DOWN_PAYMENT_LABEL} (اختياري)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                      placeholder="اتركه فارغاً لتقسيم متساوٍ"
                    />
                  </div>

                  {splitPreview?.invalid ? (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      المقدمة يجب أن تكون أصغر من المبلغ الإجمالي
                    </p>
                  ) : splitPreview ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-xs text-indigo-900">
                      {splitPreview.hasDown ? (
                        <>
                          {DOWN_PAYMENT_LABEL}: {formatCurrency(splitPreview.first)} ·{" "}
                          {installmentCount - 1} × {formatCurrency(splitPreview.monthly)}
                        </>
                      ) : (
                        <>
                          {installmentCount} دفعات × {formatCurrency(splitPreview.monthly)}
                        </>
                      )}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setPayDownPaymentNow((v) => !v)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-medium",
                      payDownPaymentNow
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border",
                        payDownPaymentNow
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {downPayment && Number(downPayment) > 0
                      ? `ادفع ${DOWN_PAYMENT_LABEL} الآن`
                      : "ادفع القسط الأول الآن"}
                  </button>

                  {parentProjects.length > 0 && (
                    <div>
                      <Label>ربط بمشروع (اختياري)</Label>
                      <Select
                        value={expenseParentId}
                        onChange={(e) => setExpenseParentId(e.target.value)}
                      >
                        <option value="">مصاريف مقسطة</option>
                        {parentProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
