"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { type ColumnDef, type RowSelectionState } from "@tanstack/react-table";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Wallet,
  Briefcase,
  X,
} from "lucide-react";
import { DataTable } from "@/components/tables/data-table";
import { RowActions } from "@/components/tables/row-actions";
import { TransactionSheet } from "@/components/forms/transaction-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { AR_MONTHS, monthLabel } from "@/lib/finance-labels";

type TransactionRow = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "SAVINGS_CONTRIBUTION";
  amount: number;
  occurredAt: string;
  occurredAtLabel: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  projectId: string | null;
  payeeId: string | null;
  paymentMethodId: string | null;
  categoryName: string;
  projectName: string;
  paymentMethodName: string;
  salarySlipId: string | null;
  employerId: string | null;
};

type Option = { id: string; name: string };

type Filters = {
  year: number;
  month: number | "all";
  expenseCategory: string;
  project: string;
  method: string;
  q: string;
};

export function TransactionsPageClient({
  data,
  lookups,
  filters,
  summary,
  total,
}: {
  data: TransactionRow[];
  lookups: {
    categories: Option[];
    expenseCategories: Option[];
    projects: Option[];
    payees: Option[];
    paymentMethods: Option[];
  };
  filters: Filters;
  summary: { income: number; expense: number; savings: number; transfer: number };
  total: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [defaultType, setDefaultType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [q, setQ] = useState(filters.q);
  const [isPending, startTransition] = useTransition();
  const [salaryBlock, setSalaryBlock] = useState<TransactionRow | null>(null);
  const [shakeRowId, setShakeRowId] = useState<string | null>(null);
  const [incomeSelection, setIncomeSelection] = useState<RowSelectionState>({});
  const [expenseSelection, setExpenseSelection] = useState<RowSelectionState>({});

  const buildUrl = (next: Partial<Filters>) => {
    const m = { ...filters, ...next };
    const sp = new URLSearchParams();
    sp.set("year", String(m.year));
    sp.set("month", m.month === "all" ? "all" : String(m.month));
    if (m.expenseCategory && m.expenseCategory !== "all") {
      sp.set("expenseCategory", m.expenseCategory);
    }
    if (m.project && m.project !== "all") sp.set("project", m.project);
    if (m.method && m.method !== "all") sp.set("method", m.method);
    if (m.q) sp.set("q", m.q);
    return `/transactions?${sp.toString()}`;
  };

  const apply = (next: Partial<Filters>) => {
    startTransition(() => router.push(buildUrl(next)));
  };

  const shiftMonth = (delta: number) => {
    if (filters.month === "all") return;
    let month = filters.month + delta;
    let year = filters.year;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    apply({ year, month });
  };

  const periodLabel =
    filters.month === "all"
      ? `سنة ${filters.year}`
      : `${monthLabel(filters.month)} ${filters.year}`;

  const currentYear = new Date().getUTCFullYear();
  const yearOptions = Array.from(
    { length: currentYear - 2019 },
    (_, i) => 2020 + i
  );

  const net = summary.income - summary.expense;

  const incomeRows = useMemo(
    () => data.filter((row) => row.type === "INCOME"),
    [data]
  );

  const expenseRows = useMemo(() => {
    const rows = data.filter(
      (row) => row.type === "EXPENSE" || row.type === "SAVINGS_CONTRIBUTION"
    );
    if (filters.expenseCategory === "all") return rows;
    return rows.filter((row) => row.categoryId === filters.expenseCategory);
  }, [data, filters.expenseCategory]);

  const blockSalaryEdit = (row: TransactionRow) => {
    setShakeRowId(row.id);
    setSalaryBlock(row);
    setTimeout(() => setShakeRowId(null), 500);
  };

  const selectColumn = (
    selection: RowSelectionState,
    setSelection: (value: RowSelectionState) => void,
    rows: TransactionRow[],
    canSelect: (row: TransactionRow) => boolean
  ): ColumnDef<TransactionRow> => ({
    id: "select",
    header: () => {
      const selectableRows = rows.filter(canSelect);
      const allSelected =
        selectableRows.length > 0 &&
        selectableRows.every((row) => selection[row.id]);
      const someSelected = selectableRows.some((row) => selection[row.id]);
      return (
        <input
          type="checkbox"
          aria-label="تحديد الكل"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={() => {
            if (allSelected) {
              setSelection({});
              return;
            }
            const next: RowSelectionState = {};
            for (const row of selectableRows) next[row.id] = true;
            setSelection(next);
          }}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      );
    },
    cell: ({ row }) => {
      if (!canSelect(row.original)) return null;
      return (
        <input
          type="checkbox"
          aria-label="تحديد الصف"
          checked={Boolean(selection[row.original.id])}
          onChange={() => {
            setSelection({
              ...selection,
              [row.original.id]: !selection[row.original.id],
            });
          }}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      );
    },
    enableSorting: false,
  });

  const selectedIncomeIds = Object.keys(incomeSelection).filter((id) => incomeSelection[id]);
  const selectedExpenseIds = Object.keys(expenseSelection).filter((id) => expenseSelection[id]);

  const incomeColumns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      selectColumn(
        incomeSelection,
        setIncomeSelection,
        incomeRows,
        (row) => !row.salarySlipId
      ),
      {
        accessorKey: "occurredAtLabel",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            التاريخ <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <motion.span
            animate={shakeRowId === row.original.id ? { x: [0, -6, 6, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="inline-block"
          >
            {row.original.occurredAtLabel}
          </motion.span>
        ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            المبلغ <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <motion.span
            animate={shakeRowId === row.original.id ? { x: [0, -6, 6, -6, 6, 0] } : {}}
            className="inline-block font-bold text-emerald-700"
          >
            +{formatCurrency(row.original.amount)}
          </motion.span>
        ),
      },
      {
        accessorKey: "description",
        header: "المصدر",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span>{row.original.description}</span>
            {row.original.salarySlipId && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                من الراتب
              </span>
            )}
          </div>
        ),
      },
      { accessorKey: "categoryName", header: "الفئة" },
      { accessorKey: "paymentMethodName", header: "الدفع" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActions
            onEdit={() =>
              row.original.salarySlipId
                ? blockSalaryEdit(row.original)
                : openEdit(row.original)
            }
            onDelete={() =>
              row.original.salarySlipId
                ? blockSalaryEdit(row.original)
                : deleteRow(row.original.id)
            }
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, shakeRowId, incomeSelection, incomeRows]
  );

  const expenseColumns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      selectColumn(expenseSelection, setExpenseSelection, expenseRows, () => true),
      {
        accessorKey: "occurredAtLabel",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            التاريخ <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            المبلغ <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "font-bold",
              row.original.type === "EXPENSE" ? "text-rose-700" : "text-indigo-700"
            )}
          >
            −{formatCurrency(row.original.amount)}
          </span>
        ),
      },
      { accessorKey: "categoryName", header: "الفئة" },
      { accessorKey: "projectName", header: "المشروع" },
      {
        accessorKey: "description",
        header: "الوصف",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span>{row.original.description}</span>
            {row.original.description?.includes("دولار") && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                $
              </span>
            )}
            {row.original.description?.includes("ذهب") && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Au
              </span>
            )}
          </div>
        ),
      },
      { accessorKey: "paymentMethodName", header: "الدفع" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActions
            onEdit={() => openEdit(row.original)}
            onDelete={() => deleteRow(row.original.id)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, expenseSelection, expenseRows]
  );

  const openEdit = (row: TransactionRow) => {
    setEditing(row);
    setSheetOpen(true);
  };

  const deleteRow = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  const deleteSelected = (ids: string[], clearSelection: () => void) => {
    if (ids.length === 0) return;
    if (!window.confirm(`حذف ${ids.length} معاملة؟`)) return;
    startTransition(async () => {
      await Promise.all(
        ids.map((id) => fetch(`/api/transactions/${id}`, { method: "DELETE" }))
      );
      clearSelection();
      router.refresh();
    });
  };

  const openAdd = (type: "INCOME" | "EXPENSE") => {
    setDefaultType(type);
    setEditing(null);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">المعاملات</h1>
          <p className="text-sm text-slate-500">
            {periodLabel} · {total} معاملة
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={() => openAdd("INCOME")} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة دخل
          </Button>
          <Button onClick={() => openAdd("EXPENSE")} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة مصروف
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<ArrowUpCircle className="h-5 w-5" />}
          label="الدخل"
          value={summary.income}
          tone="emerald"
        />
        <SummaryCard
          icon={<ArrowDownCircle className="h-5 w-5" />}
          label="المصروف"
          value={summary.expense}
          tone="rose"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="الصافي"
          value={net}
          tone={net >= 0 ? "emerald" : "rose"}
          signed
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="الادخار"
          value={summary.savings}
          tone="indigo"
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                disabled={filters.month === "all"}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                aria-label="الشهر السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <Select
                value={filters.month === "all" ? "" : String(filters.month)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!v) return;
                  apply({ month: v });
                }}
                className="h-8 min-w-[6.5rem] w-auto shrink-0 border-0 bg-transparent py-0 pe-6 ps-2 text-sm font-bold text-slate-800 focus-visible:ring-0"
                aria-label="اختر الشهر"
              >
                {filters.month === "all" && (
                  <option value="" disabled>
                    اختر شهر
                  </option>
                )}
                {AR_MONTHS.map((label, idx) => (
                  <option key={label} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                value={String(filters.year)}
                onChange={(e) => apply({ year: Number(e.target.value) })}
                className="h-8 w-[4.25rem] shrink-0 border-0 border-s border-slate-200 bg-transparent py-0 pe-5 ps-2 text-sm font-bold text-slate-800 focus-visible:ring-0"
                aria-label="اختر السنة"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                disabled={filters.month === "all"}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                aria-label="الشهر التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                apply({ month: filters.month === "all" ? new Date().getUTCMonth() + 1 : "all" })
              }
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
                filters.month === "all"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              كل السنة
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select value={filters.project} onChange={(e) => apply({ project: e.target.value })}>
              <option value="all">كل المشاريع</option>
              {lookups.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={filters.method} onChange={(e) => apply({ method: e.target.value })}>
              <option value="all">كل طرق الدفع</option>
              {lookups.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply({ q });
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث في الوصف والملاحظات..."
              className="pr-9"
            />
          </form>
        </CardContent>
      </Card>

      {/* Income table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
            <ArrowUpCircle className="h-5 w-5" />
            الدخل ({incomeRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {selectedIncomeIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="text-sm font-semibold text-rose-800">
                {selectedIncomeIds.length} محدد
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() =>
                  deleteSelected(selectedIncomeIds, () => setIncomeSelection({}))
                }
              >
                <Trash2 className="h-4 w-4" />
                حذف المحدد
              </Button>
            </div>
          )}
          {incomeRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا يوجد دخل لهذه الفترة.
            </div>
          ) : (
            <DataTable
              columns={incomeColumns}
              data={incomeRows}
              getRowId={(row) => row.id}
              rowSelection={incomeSelection}
              onRowSelectionChange={setIncomeSelection}
              enableRowSelection={(row) => !row.original.salarySlipId}
            />
          )}
        </CardContent>
      </Card>

      {/* Expense table */}
      <Card>
        <CardHeader className="space-y-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-rose-700">
            <ArrowDownCircle className="h-5 w-5" />
            المصروفات ({expenseRows.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => apply({ expenseCategory: "all" })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                filters.expenseCategory === "all"
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              كل الفئات
            </button>
            {lookups.expenseCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => apply({ expenseCategory: cat.id })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                  filters.expenseCategory === cat.id
                    ? "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {selectedExpenseIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
              <span className="text-sm font-semibold text-rose-800">
                {selectedExpenseIds.length} محدد
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() =>
                  deleteSelected(selectedExpenseIds, () => setExpenseSelection({}))
                }
              >
                <Trash2 className="h-4 w-4" />
                حذف المحدد
              </Button>
            </div>
          )}
          {expenseRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد مصروفات لهذه الفترة
              {filters.expenseCategory !== "all" ? " في هذه الفئة." : "."}
            </div>
          ) : (
            <DataTable
              columns={expenseColumns}
              data={expenseRows}
              getRowId={(row) => row.id}
              rowSelection={expenseSelection}
              onRowSelectionChange={setExpenseSelection}
            />
          )}
        </CardContent>
      </Card>

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        transactionId={editing?.id}
        initial={
          editing
            ? {
                type: editing.type,
                amount: editing.amount,
                occurredAt: editing.occurredAt,
                description: editing.description ?? "",
                notes: editing.notes ?? "",
                categoryId: editing.categoryId ?? "",
                projectId: editing.projectId ?? "",
                payeeId: editing.payeeId ?? "",
                paymentMethodId: editing.paymentMethodId ?? "",
                currency: "ILS",
              }
            : { type: defaultType }
        }
        lookups={lookups}
      />
      {isPending && <p className="text-xs text-slate-500">جاري التحديث...</p>}

      <AnimatePresence>
        {salaryBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setSalaryBlock(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Briefcase className="h-5 w-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setSalaryBlock(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                تعديل من صفحة الراتب
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                دخل <strong>{salaryBlock.description}</strong> مرتبط بكشف الراتب.
                لتغيير المبلغ أو التاريخ، افتح صفحة جهة العمل في متابعة الراتب.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                يُحدَّث المبلغ تلقائياً في المعاملات لنفس شهر الراتب.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {salaryBlock.employerId ? (
                  <Button asChild className="flex-1">
                    <Link href={`/salary/${salaryBlock.employerId}`}>
                      فتح الراتب
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="flex-1">
                    <Link href="/salary">متابعة الراتب</Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSalaryBlock(null)}
                >
                  إغلاق
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  signed,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "rose" | "indigo";
  signed?: boolean;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="truncate text-lg font-extrabold text-slate-900">
            {signed && value >= 0 ? "+" : ""}
            {formatCurrency(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
