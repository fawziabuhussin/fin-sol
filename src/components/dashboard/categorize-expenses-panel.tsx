"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import type { UncategorizedExpense } from "@/lib/expense-category-groups";
import { EXPENSE_GROUPS } from "@/lib/expense-category-groups";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";

type CategoryOption = { id: string; name: string };

type Props = {
  items: UncategorizedExpense[];
  categories: CategoryOption[];
};

export function CategorizeExpensesPanel({ items, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const defaultCategoryId = (item: UncategorizedExpense) => {
    const fromSelection = selections[item.id];
    if (fromSelection) return fromSelection;
    const suggested = categoryByName[item.suggestedCategoryName];
    return suggested?.id ?? "";
  };

  const assignCategory = async (txId: string, categoryId: string) => {
    if (!categoryId) {
      toast.error("اختر فئة أولاً");
      return;
    }
    setBusyId(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "فشل التحديث");
      }
      toast.success("تم تصنيف المصروف");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusyId(null);
    }
  };

  const applyAllSuggestions = async () => {
    setBusyId("batch");
    let ok = 0;
    for (const item of items) {
      const catId = defaultCategoryId(item);
      if (!catId) continue;
      try {
        const res = await fetch(`/api/transactions/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: catId }),
        });
        if (res.ok) ok++;
      } catch {
        /* continue */
      }
    }
    setBusyId(null);
    if (ok > 0) {
      toast.success(`تم تصنيف ${ok} مصروف تلقائياً`);
      setOpen(false);
      router.refresh();
    } else {
      toast.error("لم يتم تصنيف أي مصروف");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold text-indigo-950">
              {items.length} مصروف بانتظار التصنيف
            </p>
            <p className="mt-0.5 text-sm text-indigo-800/80">
              نظام ذكي يقترح الفئة المناسبة من وصف المعاملة — مثل تطبيقات البطاقة
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
          onClick={() => setOpen(true)}
        >
          <Tag className="me-2 h-4 w-4" />
          اختر الفئة
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>تصنيف المصروفات</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-8">
            <Button
              type="button"
              variant="outline"
              className="w-full border-indigo-200 text-indigo-800"
              disabled={busyId === "batch"}
              onClick={applyAllSuggestions}
            >
              <Sparkles className="me-2 h-4 w-4" />
              تطبيق كل الاقتراحات الذكية
            </Button>

            {items.map((item) => {
              const selected = defaultCategoryId(item);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {item.description || "بدون وصف"}
                      </p>
                      <p className="text-xs text-slate-500">{item.occurredAt}</p>
                    </div>
                    <span className="shrink-0 font-extrabold text-rose-700">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  <p className="mb-2 text-xs text-indigo-700">
                    اقتراح ذكي:{" "}
                    <strong>{item.suggestedGroupLabel}</strong>
                    {item.suggestedCategoryName !== "أخرى" && (
                      <> · {item.suggestedCategoryName}</>
                    )}
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      className="flex-1"
                      value={selected}
                      onChange={(e) =>
                        setSelections((s) => ({ ...s, [item.id]: e.target.value }))
                      }
                    >
                      <option value="">اختر الفئة</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!selected || busyId === item.id}
                      onClick={() => assignCategory(item.id, selected)}
                    >
                      حفظ
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {EXPENSE_GROUPS.slice(0, 8).map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                {g.label}
              </span>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
