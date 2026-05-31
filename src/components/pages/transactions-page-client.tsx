"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { DataTable } from "@/components/tables/data-table";
import { RowActions } from "@/components/tables/row-actions";
import { TransactionSheet } from "@/components/forms/transaction-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";

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

  const incomeColumns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
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
          <span className="font-bold text-emerald-700">
            +{formatCurrency(row.original.amount)}
          </span>
        ),
      },
      { accessorKey: "description", header: "المصدر" },
      { accessorKey: "categoryName", header: "الفئة" },
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
    [router]
  );

  const expenseColumns = useMemo<ColumnDef<TransactionRow>[]>(
    () => [
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
      { accessorKey: "description", header: "الوصف" },
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
    [router]
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
              <span className="min-w-[110px] text-center text-sm font-bold text-slate-800">
                {periodLabel}
              </span>
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
          {incomeRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا يوجد دخل لهذه الفترة.
            </div>
          ) : (
            <DataTable columns={incomeColumns} data={incomeRows} />
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
          {expenseRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد مصروفات لهذه الفترة
              {filters.expenseCategory !== "all" ? " في هذه الفئة." : "."}
            </div>
          ) : (
            <DataTable columns={expenseColumns} data={expenseRows} />
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
