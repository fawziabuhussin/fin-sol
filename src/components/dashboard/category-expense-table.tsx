"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { ExpenseGroupRow } from "@/lib/expense-category-groups";
import { getExpenseGroup } from "@/lib/expense-category-groups";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  groups: ExpenseGroupRow[];
  total: number;
};

export function CategoryExpenseTable({ groups, total }: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const visibleGroups = useMemo(
    () => groups.filter((g) => g.amount > 0),
    [groups]
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAll = () => setOpenIds(new Set(visibleGroups.map((g) => g.id)));
  const closeAll = () => setOpenIds(new Set());

  if (visibleGroups.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        لا توجد مصروفات في هذا الشهر
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">تفصيل حسب الفئة</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-slate-600"
            onClick={openAll}
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            فتح الكل
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-slate-600"
            onClick={closeAll}
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            إغلاق الكل
          </Button>
        </div>
      </div>

      <div className="hidden grid-cols-[1fr_auto_auto] gap-4 border-b border-slate-100 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 sm:grid">
        <span>الفئة</span>
        <span className="min-w-[100px] text-start">المجموع</span>
        <span className="min-w-[72px] text-start">من الإجمالي</span>
      </div>

      <div className="divide-y divide-slate-100">
        {visibleGroups.map((group, rowIndex) => {
          const Icon = getExpenseGroup(group.id).icon;
          const isOpen = openIds.has(group.id);
          const zebra = rowIndex % 2 === 1 ? "bg-slate-50/60" : "bg-white";

          return (
            <div key={group.id} className={zebra}>
              <button
                type="button"
                onClick={() => toggle(group.id)}
                className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-start transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: group.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                    <p className="text-xs text-slate-500 sm:hidden">
                      {group.transactions.length} معاملة
                    </p>
                  </div>
                </div>
                <span className="text-base font-extrabold text-slate-900 sm:text-start">
                  {formatCurrency(group.amount)}
                </span>
                <span className="text-sm font-semibold text-slate-600 sm:text-start">
                  {group.percent.toFixed(1)}%
                </span>
              </button>

              {isOpen && group.transactions.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-3 pt-1">
                  {group.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 border-b border-slate-100/80 py-2.5 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {tx.description || tx.categoryName || "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {tx.occurredAt}
                          {tx.paymentMethodName && ` · ${tx.paymentMethodName}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-rose-700">
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 border-t-2 border-rose-500 bg-rose-50/40 px-4 py-3 font-bold text-slate-900 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
        <span>إجمالي المصروفات</span>
        <span className="text-lg text-rose-700 sm:text-start">
          {formatCurrency(total)}
        </span>
        <span className="text-sm sm:text-start">100%</span>
      </div>
    </div>
  );
}
