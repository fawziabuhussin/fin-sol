"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  ListChecks,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  TransactionFormDialog,
  deleteTransaction,
} from "@/components/transactions/transaction-form-dialog";
import type { TxCategory, TxRow, TxType } from "@/components/transactions/types";
import { assetMovementShortLabel } from "@/lib/asset-movement-labels";
import { monthLabel } from "@/lib/finance-labels";
import { cn, formatCurrency, formatCurrencyPrecise, formatSignedCurrency } from "@/lib/utils";

type Option = { id: string; name: string };
type TypeFilter = "all" | "expense" | "income" | "savings" | "transfer";

type Filters = {
  year: number;
  month: number | "all";
  q: string;
  type: string;
  category: string;
  project: string;
  method: string;
};

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const TYPE_TABS: { value: TypeFilter; label: string; match: (t: TxType) => boolean }[] = [
  { value: "all", label: "الكل", match: () => true },
  { value: "expense", label: "مصروفات", match: (t) => t === "EXPENSE" },
  { value: "income", label: "دخل", match: (t) => t === "INCOME" },
  { value: "savings", label: "ادخار", match: (t) => t === "SAVINGS_CONTRIBUTION" },
  { value: "transfer", label: "تحويلات", match: (t) => t === "TRANSFER" },
];

/** Signed effect on the wallet: income in, everything else out. */
const signed = (r: TxRow) => (r.type === "INCOME" ? r.amount : -r.amount);

function dayHeading(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()];
  return `${weekday}، ${d} ${monthLabel(m!)}`;
}

/* ───────────── Row ───────────── */

function RowIcon({ row }: { row: TxRow }) {
  const base = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold";
  if (row.salarySlipId) return <span className={cn(base, "bg-emerald-50 text-emerald-600")}><Briefcase className="h-[18px] w-[18px]" /></span>;
  if (row.assetMovement) return <span className={cn(base, "bg-amber-50 text-amber-600")}><Coins className="h-[18px] w-[18px]" /></span>;
  if (row.type === "TRANSFER") return <span className={cn(base, "bg-slate-100 text-slate-500")}><ArrowLeftRight className="h-[18px] w-[18px]" /></span>;
  if (row.type === "SAVINGS_CONTRIBUTION") return <span className={cn(base, "bg-indigo-50 text-indigo-600")}><PiggyBank className="h-[18px] w-[18px]" /></span>;
  if (row.categoryName) {
    const color = row.categoryColor ?? "#64748b";
    return (
      <span className={base} style={{ backgroundColor: `${color}1f`, color }}>
        {row.categoryName.trim().charAt(0)}
      </span>
    );
  }
  return (
    <span className={cn(base, row.type === "INCOME" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
      {row.type === "INCOME" ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
    </span>
  );
}

function TxListRow({
  row,
  selecting,
  selected,
  selectable,
  onOpen,
  onSelect,
}: {
  row: TxRow;
  selecting: boolean;
  selected: boolean;
  selectable: boolean;
  onOpen: () => void;
  onSelect: () => void;
}) {
  const title = row.description?.trim() || row.categoryName || (row.type === "INCOME" ? "دخل" : "مصروف");
  const meta = [
    row.description?.trim() && row.categoryName ? row.categoryName : null,
    row.paymentMethodName,
    row.projectName,
  ].filter(Boolean);
  const amountClass =
    row.type === "INCOME"
      ? "text-emerald-600"
      : row.type === "SAVINGS_CONTRIBUTION"
        ? "text-indigo-600"
        : row.type === "TRANSFER"
          ? "text-slate-500"
          : "text-slate-900";

  return (
    <li>
      <button
        type="button"
        onClick={selecting ? (selectable ? onSelect : undefined) : onOpen}
        aria-pressed={selecting ? selected : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-start transition-colors sm:px-3",
          selected ? "bg-indigo-50" : "hover:bg-slate-50",
          selecting && !selectable && "cursor-not-allowed opacity-50"
        )}
      >
        {selecting && (
          <span
            aria-hidden
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              selected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white"
            )}
          >
            {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
          </span>
        )}
        <RowIcon row={row} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-slate-900" dir="auto">{title}</span>
            {row.salarySlipId && <Tag tone="emerald">راتب</Tag>}
            {row.assetMovement && <Tag tone="amber">{assetMovementShortLabel(row.assetMovement)}</Tag>}
            {row.linkedTo === "subscription" && <Tag tone="indigo" icon={<Repeat className="h-2.5 w-2.5" />}>اشتراك</Tag>}
            {row.linkedTo === "installment" && <Tag tone="indigo" icon={<CreditCard className="h-2.5 w-2.5" />}>قسط</Tag>}
          </span>
          {meta.length > 0 && <span className="mt-0.5 block truncate text-xs text-slate-500">{meta.join(" · ")}</span>}
        </span>
        <span className={cn("num shrink-0 text-sm font-bold", amountClass)}>
          {row.type === "TRANSFER"
            ? formatCurrencyPrecise(row.amount)
            : formatSignedCurrency(signed(row), { precise: true })}
        </span>
      </button>
    </li>
  );
}

function Tag({ children, tone, icon }: { children: React.ReactNode; tone: "emerald" | "amber" | "indigo"; icon?: React.ReactNode }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold", tones[tone])}>
      {icon}
      {children}
    </span>
  );
}

/* ───────────── Page ───────────── */

export function TransactionsPageClient({
  rows,
  total,
  summary,
  filters,
  currentPeriod,
  lookups,
}: {
  rows: TxRow[];
  total: number;
  summary: { income: number; expense: number; savings: number; transfer: number };
  filters: Filters;
  currentPeriod: { year: number; month: number };
  lookups: { categories: TxCategory[]; projects: Option[]; paymentMethods: Option[] };
}) {
  const router = useRouter();
  const [isNavigating, startNav] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    (TYPE_TABS.some((t) => t.value === filters.type) ? filters.type : "all") as TypeFilter
  );
  const [category, setCategory] = useState(filters.category);
  const [q, setQ] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(filters.project !== "all" || filters.method !== "all");
  const [form, setForm] = useState<{ key: number; row: TxRow | null; type: TxType } | null>(null);
  const [blocked, setBlocked] = useState<TxRow | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const monthInput = useRef<HTMLInputElement>(null);
  const formSeq = useRef(0);
  const openForm = (row: TxRow | null, type: TxType) => setForm({ key: ++formSeq.current, row, type });

  /* navigation (server-side filters) */
  const go = (next: Partial<Filters>) => {
    const m = { ...filters, type: typeFilter, category, ...next };
    const sp = new URLSearchParams();
    sp.set("year", String(m.year));
    sp.set("month", m.month === "all" ? "all" : String(m.month));
    if (m.q) sp.set("q", m.q);
    if (m.type !== "all") sp.set("type", m.type);
    if (m.category !== "all") sp.set("category", m.category);
    if (m.project !== "all") sp.set("project", m.project);
    if (m.method !== "all") sp.set("method", m.method);
    startNav(() => router.push(`/transactions?${sp}`, { scroll: false }));
  };

  /* client-side filters: keep them in the URL without refetching */
  const syncUrl = (type: TypeFilter, cat: string) => {
    const sp = new URLSearchParams(window.location.search);
    if (type === "all") sp.delete("type");
    else sp.set("type", type);
    if (cat === "all") sp.delete("category");
    else sp.set("category", cat);
    sp.delete("expenseCategory");
    window.history.replaceState(null, "", `/transactions?${sp}`);
  };

  // Debounced search.
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const t = setTimeout(() => go({ q: q.trim() }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const shift = (delta: number) => {
    if (filters.month === "all") return go({ year: filters.year + delta });
    const idx = filters.year * 12 + (filters.month - 1) + delta;
    go({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  };
  const isCurrent = filters.month === currentPeriod.month && filters.year === currentPeriod.year;
  const periodLabel = filters.month === "all" ? `سنة ${filters.year}` : `${monthLabel(filters.month)} ${filters.year}`;

  /* derived */
  const typeCounts = useMemo(
    () => Object.fromEntries(TYPE_TABS.map((t) => [t.value, rows.filter((r) => t.match(r.type)).length])),
    [rows]
  );
  const spendByCategory = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null; amount: number }>();
    for (const r of rows) {
      if (r.type !== "EXPENSE" || !r.categoryId) continue;
      const cur = map.get(r.categoryId) ?? { id: r.categoryId, name: r.categoryName ?? "—", color: r.categoryColor, amount: 0 };
      cur.amount += r.amount;
      map.set(r.categoryId, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [rows]);

  const visible = useMemo(() => {
    const tab = TYPE_TABS.find((t) => t.value === typeFilter)!;
    return rows.filter((r) => tab.match(r.type) && (category === "all" || r.categoryId === category));
  }, [rows, typeFilter, category]);

  const groups = useMemo(() => {
    const map = new Map<string, TxRow[]>();
    for (const r of visible) {
      const list = map.get(r.occurredAt) ?? [];
      list.push(r);
      map.set(r.occurredAt, list);
    }
    return [...map.entries()];
  }, [visible]);

  const visibleNet = visible.reduce((s, r) => s + signed(r), 0);
  const net = summary.income - summary.expense;
  const spentPct = summary.income > 0 ? Math.round((summary.expense / summary.income) * 100) : null;
  const activeFilterCount = Number(filters.project !== "all") + Number(filters.method !== "all");
  const isLocked = (r: TxRow) => Boolean(r.salarySlipId || r.assetEntryId);

  /* actions */
  const openRow = (row: TxRow) => {
    if (isLocked(row)) setBlocked(row);
    else openForm(row, row.type);
  };
  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const bulkDelete = () =>
    startMutation(async () => {
      const ids = [...selected];
      const errors: string[] = [];
      for (const id of ids) {
        const err = await deleteTransaction(id);
        if (err) errors.push(err);
      }
      setConfirmBulk(false);
      exitSelect();
      router.refresh();
      const okCount = ids.length - errors.length;
      if (okCount) toast.success(`حُذفت ${okCount} ${okCount === 1 ? "معاملة" : "معاملات"}`);
      if (errors.length) toast.error(`تعذّر حذف ${errors.length}: ${errors[0]}`);
    });
  const selectedSum = rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.amount, 0);

  return (
    <div className={cn("space-y-5", selecting && "pb-24")}>
      <PageHeader
        title="المعاملات"
        description={`${periodLabel} · ${total} ${total === 1 ? "معاملة" : "معاملات"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => openForm(null, "INCOME")}>
              <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> دخل
            </Button>
            <Button variant="brand" onClick={() => openForm(null, "EXPENSE")}>
              <Plus className="h-4 w-4" /> مصروف
            </Button>
          </>
        }
      />

      {/* Period + summary */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="السابق">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="relative">
              <span className="block min-w-[120px] rounded-lg px-2 py-1 text-center text-sm font-bold text-slate-900 hover:bg-slate-100">
                {periodLabel}
              </span>
              {filters.month !== "all" && (
                <input
                  ref={monthInput}
                  type="month"
                  aria-label="اختر الشهر"
                  value={`${filters.year}-${String(filters.month).padStart(2, "0")}`}
                  onClick={() => monthInput.current?.showPicker?.()}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-").map(Number);
                    if (y && m) go({ year: y, month: m });
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              )}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="التالي">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            {!isCurrent && (
              <button
                type="button"
                onClick={() => go({ year: currentPeriod.year, month: currentPeriod.month })}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                الشهر الحالي
              </button>
            )}
            <button
              type="button"
              onClick={() => go(filters.month === "all" ? { month: currentPeriod.month, year: filters.year } : { month: "all" })}
              aria-pressed={filters.month === "all"}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                filters.month === "all"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              كل السنة
            </button>
          </div>
        </div>

        <div className={cn("p-4 transition-opacity sm:p-5", isNavigating && "opacity-60")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <Stat label="الدخل" value={formatSignedCurrency(summary.income)} tone="text-emerald-600" />
            <Stat label="المصروفات" value={formatSignedCurrency(-summary.expense)} tone="text-rose-600" />
            <Stat
              label="الصافي"
              value={formatSignedCurrency(net)}
              tone={net >= 0 ? "text-slate-900" : "text-rose-600"}
              emphasis
            />
            <Stat label="ادخار وتحويلات" value={formatCurrency(summary.savings + summary.transfer)} tone="text-indigo-600" />
          </dl>
          {spentPct != null && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", spentPct > 100 ? "bg-rose-500" : "bg-rose-400")}
                  style={{ width: `${Math.min(100, spentPct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                صرفت <span className="num font-semibold text-slate-700">{spentPct}%</span> من دخلك
                {spentPct > 100 ? " — المصروفات أعلى من الدخل" : spentPct <= 80 ? " — ممتاز 👌" : ""}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في الوصف والملاحظات…"
              aria-label="بحث"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-base shadow-card placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none sm:text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(activeFilterCount > 0 && "border-indigo-300 text-indigo-700")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">فلاتر</span>
            {activeFilterCount > 0 && (
              <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:grid-cols-3">
            <Select value={filters.project} onChange={(e) => go({ project: e.target.value })} aria-label="المشروع">
              <option value="all">كل المشاريع</option>
              {lookups.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select value={filters.method} onChange={(e) => go({ method: e.target.value })} aria-label="طريقة الدفع">
              <option value="all">كل طرق الدفع</option>
              {lookups.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                syncUrl(typeFilter, e.target.value);
              }}
              aria-label="الفئة"
            >
              <option value="all">كل الفئات</option>
              {lookups.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            {(activeFilterCount > 0 || category !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  go({ project: "all", method: "all", category: "all" });
                }}
                className="text-start text-xs font-semibold text-indigo-600 hover:text-indigo-800 sm:col-span-3"
              >
                مسح كل الفلاتر
              </button>
            )}
          </div>
        )}

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {TYPE_TABS.filter((t) => t.value === "all" || typeCounts[t.value] > 0).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTypeFilter(t.value);
                syncUrl(t.value, category);
              }}
              aria-pressed={typeFilter === t.value}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                typeFilter === t.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-slate-300"
              )}
            >
              {t.label} <span className="num opacity-60">{typeCounts[t.value]}</span>
            </button>
          ))}
        </div>

        {(typeFilter === "all" || typeFilter === "expense") && spendByCategory.length > 1 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">أين صرفت</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {spendByCategory.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = category === c.id ? "all" : c.id;
                    setCategory(next);
                    syncUrl(typeFilter, next);
                  }}
                  aria-pressed={category === c.id}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-colors",
                    category === c.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#94a3b8" }} />
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className="num font-semibold text-slate-900">{formatCurrency(c.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {total > rows.length && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          تُعرض أحدث {rows.length} معاملة من {total} — اختر شهراً أو استخدم البحث لرؤية الباقي.
        </p>
      )}

      {/* List */}
      <Card className={cn("p-2 transition-opacity sm:p-3", isNavigating && "opacity-60")}>
        <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2 sm:px-3">
          <p className="text-xs text-slate-500">
            <span className="num font-semibold text-slate-700">{visible.length}</span> معاملة · الصافي{" "}
            <span className={cn("num font-semibold", visibleNet >= 0 ? "text-emerald-600" : "text-slate-700")}>
              {formatSignedCurrency(visibleNet)}
            </span>
          </p>
          {visible.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              <ListChecks className="h-4 w-4" /> {selecting ? "إلغاء" : "تحديد"}
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              {rows.length === 0 ? `لا معاملات في ${periodLabel}` : "لا نتائج مطابقة"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {rows.length === 0 ? "أضف أول مصروف أو دخل لهذه الفترة." : "جرّب تغيير الفلتر أو كلمة البحث."}
            </p>
            {rows.length === 0 && (
              <Button variant="brand" size="sm" className="mt-4" onClick={() => openForm(null, "EXPENSE")}>
                <Plus className="h-4 w-4" /> إضافة معاملة
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(([day, list]) => {
              const dayNet = list.reduce((s, r) => s + signed(r), 0);
              return (
                <section key={day} aria-label={dayHeading(day)}>
                  <div className="sticky top-14 z-10 flex items-center justify-between bg-white/95 px-3 py-1.5 backdrop-blur lg:top-[72px]">
                    <h3 className="text-xs font-semibold text-slate-500">{dayHeading(day)}</h3>
                    <span className={cn("num text-xs font-semibold", dayNet >= 0 ? "text-emerald-600" : "text-slate-500")}>
                      {formatSignedCurrency(dayNet)}
                    </span>
                  </div>
                  <ul>
                    {list.map((row) => (
                      <TxListRow
                        key={row.id}
                        row={row}
                        selecting={selecting}
                        selected={selected.has(row.id)}
                        selectable={!isLocked(row)}
                        onOpen={() => openRow(row)}
                        onSelect={() => toggleSelected(row.id)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bulk bar */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 px-4 lg:bottom-6">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-float">
            <p className="text-sm">
              <span className="num font-bold">{selected.size}</span> محددة
              {selected.size > 0 && <span className="num text-white/60"> · {formatCurrency(selectedSum)}</span>}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={exitSelect}>
                إلغاء
              </Button>
              <Button size="sm" variant="destructive" disabled={selected.size === 0} onClick={() => setConfirmBulk(true)}>
                <Trash2 className="h-4 w-4" /> حذف
              </Button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <TransactionFormDialog
          key={form.key}
          open
          onOpenChange={(o) => !o && setForm(null)}
          transaction={form.row}
          defaultType={form.type}
          lookups={lookups}
        />
      )}

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        destructive
        pending={isMutating}
        confirmLabel={`حذف ${selected.size}`}
        title={`حذف ${selected.size} ${selected.size === 1 ? "معاملة" : "معاملات"}؟`}
        description="تُحذف من كل التقارير. دفعات الاشتراكات والأقساط المرتبطة تعود غير مدفوعة."
        onConfirm={bulkDelete}
      />

      <Dialog open={blocked != null} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <span
              className={cn(
                "mb-2 flex h-11 w-11 items-center justify-center rounded-xl",
                blocked?.salarySlipId ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              )}
            >
              {blocked?.salarySlipId ? <Briefcase className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
            </span>
            <DialogTitle>{blocked?.salarySlipId ? "يُعدَّل من صفحة الراتب" : "يُعدَّل من صفحة الادخار"}</DialogTitle>
            <DialogDescription>
              {blocked?.salarySlipId
                ? `«${blocked?.description ?? "الدخل"}» مرتبط بقسيمة الراتب ويُحدَّث منها تلقائياً — عدّل القسيمة لتغيير المبلغ أو التاريخ.`
                : `«${blocked?.description ?? "المعاملة"}» مرتبطة بشراء أو سحب أصول — عدّلها من سجل الحركات في الادخار.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlocked(null)}>إغلاق</Button>
            <Button asChild variant="brand">
              <Link href={blocked?.salarySlipId ? (blocked.employerId ? `/salary/${blocked.employerId}` : "/salary") : "/savings"}>
                {blocked?.salarySlipId ? "فتح الراتب" : "فتح الادخار"}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone, emphasis }: { label: string; value: string; tone: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={cn("num mt-0.5 truncate font-bold", emphasis ? "text-xl sm:text-2xl" : "text-lg", tone)}>{value}</dd>
    </div>
  );
}
