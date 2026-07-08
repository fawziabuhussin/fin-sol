"use client";

import type { ExpenseGroupRow } from "@/lib/expense-category-groups";
import { EXPENSE_GROUPS, getExpenseGroup } from "@/lib/expense-category-groups";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Predefined relative positions for a clustered bubble layout (top %, left %, scale). */
const BUBBLE_LAYOUT: { top: string; left: string; z: number }[] = [
  { top: "28%", left: "38%", z: 30 },
  { top: "8%", left: "58%", z: 20 },
  { top: "52%", left: "62%", z: 25 },
  { top: "12%", left: "18%", z: 15 },
  { top: "58%", left: "12%", z: 18 },
  { top: "38%", left: "72%", z: 12 },
];

type Props = {
  groups: ExpenseGroupRow[];
  total: number;
  className?: string;
};

export function CategoryBubbleChart({ groups, total, className }: Props) {
  const sorted = [...groups]
    .filter((g) => g.amount > 0 && g.id !== "misc")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500",
          className
        )}
      >
        لا توجد مصروفات مصنّفة لهذا الشهر
      </div>
    );
  }

  const maxAmount = sorted[0]?.amount ?? 1;

  return (
    <div
      className={cn(
        "relative min-h-[260px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 sm:min-h-[300px]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent_50%)]" />

      {sorted.map((group, index) => {
        const layout = BUBBLE_LAYOUT[index] ?? BUBBLE_LAYOUT[5];
        const Icon = getExpenseGroup(group.id).icon;
        const sizeRatio = 0.55 + (group.amount / maxAmount) * 0.45;
        const size = Math.round(88 * sizeRatio);
        const fontSize = size < 100 ? "text-[10px]" : "text-xs";

        return (
          <div
            key={group.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-105"
            style={{
              top: layout.top,
              left: layout.left,
              zIndex: layout.z,
              width: size,
              height: size,
            }}
          >
            <div
              className="flex h-full w-full flex-col items-center justify-center rounded-full px-2 text-center text-white shadow-lg ring-2 ring-white/40"
              style={{ backgroundColor: group.color }}
            >
              <Icon className="mb-0.5 h-5 w-5 shrink-0 opacity-95 sm:h-6 sm:w-6" />
              <p className={cn("line-clamp-2 font-bold leading-tight", fontSize)}>
                {group.label}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold opacity-90 sm:text-xs">
                {formatCurrency(group.amount)}
              </p>
            </div>
          </div>
        );
      })}

      {sorted.length < 3 && (
        <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500 shadow-sm ring-1 ring-slate-100">
          أضف المزيد من المصروفات لرؤية توزيع أوضح
        </div>
      )}

      <div className="absolute bottom-3 right-3 hidden flex-wrap justify-end gap-1.5 sm:flex">
        {EXPENSE_GROUPS.filter((g) =>
          sorted.some((s) => s.id === g.id)
        ).map((g) => (
          <span
            key={g.id}
            className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-slate-600 shadow-sm ring-1 ring-slate-100"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            {g.label}
          </span>
        ))}
      </div>

      {total > 0 && (
        <p className="absolute left-4 top-3 text-xs text-slate-500">
          إجمالي المصروفات:{" "}
          <span className="font-bold text-slate-800">{formatCurrency(total)}</span>
        </p>
      )}
    </div>
  );
}
