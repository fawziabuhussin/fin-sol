"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CalendarCheck2, ChevronLeft, CreditCard, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { ServiceAvatar } from "@/components/subscriptions/service-avatar";
import { useTodayIso } from "@/components/subscriptions/status";
import { PayToggle } from "@/components/splits/pay-toggle";
import { PlanFormDialog } from "@/components/splits/plan-form-dialog";
import {
  STATUS_TEXT,
  formatMonth,
  installmentStatus,
  installmentStatusLabel,
  planEndDate,
  planMonthly,
  setInstallmentPaid,
  withOverrides,
  type SplitInstallment,
  type SplitPlan,
} from "@/components/splits/split-utils";
import { cn, formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";

type Lookup = { id: string; name: string };
type Filter = "active" | "done" | "all";

/* ───────────── Summary ───────────── */

function Summary({ plans, today }: { plans: SplitPlan[]; today: string | null }) {
  const active = plans.filter((p) => p.pendingCount > 0);
  const total = plans.reduce((s, p) => s + p.totalAmount, 0);
  const paid = plans.reduce((s, p) => s + p.paid, 0);
  const remaining = plans.reduce((s, p) => s + p.remaining, 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const monthKey = today?.slice(0, 7);
  const dueThisMonth = plans
    .flatMap((p) => p.installments)
    .filter((i) => i.status === "PENDING" && monthKey && i.dueDate.slice(0, 7) <= monthKey)
    .reduce((s, i) => s + i.amount, 0);
  const lastEnd = active.map(planEndDate).sort().at(-1);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 right-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        <p className="text-sm text-white/60">المتبقي عليك في كل الأقساط</p>
        <p className="num mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{formatCurrency(remaining)}</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500 transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-white/60">
          دفعت <span className="num font-semibold text-white">{formatCurrency(paid)}</span> من{" "}
          <span className="num">{formatCurrency(total)}</span> · <span className="num">{pct}%</span>
        </p>
      </div>

      <dl className="relative mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
        <div className="px-2 text-center">
          <dt className="text-[11px] text-white/55">{today ? `مستحق ${monthLabel(Number(today.slice(5, 7)))}` : "هذا الشهر"}</dt>
          <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{formatCurrency(dueThisMonth)}</dd>
        </div>
        <div className="px-2 text-center">
          <dt className="text-[11px] text-white/55">أقساط نشطة</dt>
          <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{active.length}</dd>
        </div>
        <div className="px-2 text-center">
          <dt className="text-[11px] text-white/55">آخر دفعة</dt>
          <dd className="mt-0.5 text-sm font-semibold sm:text-base">{lastEnd ? formatMonth(lastEnd) : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ───────────── This month ───────────── */

type DueRow = { plan: SplitPlan; inst: SplitInstallment };

function ThisMonth({
  rows,
  today,
  pendingIds,
  onToggle,
}: {
  rows: DueRow[];
  today: string | null;
  pendingIds: Set<string>;
  onToggle: (row: DueRow) => void;
}) {
  const open = rows.filter((r) => r.inst.status === "PENDING");
  const overdue = open.filter((r) => installmentStatus(r.inst, today).status === "overdue");

  return (
    <Card className="flex flex-col p-2 sm:p-3">
      <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarCheck2 className="h-4 w-4 text-indigo-500" /> دفعات هذا الشهر
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {open.length === 0
              ? "كل دفعات الشهر مسجّلة ✓"
              : `${open.length} متبقية · ${formatCurrencyPrecise(open.reduce((s, r) => s + r.inst.amount, 0))}`}
          </p>
        </div>
        {overdue.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
            <AlertCircle className="h-3.5 w-3.5" /> {overdue.length} متأخرة
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="px-3 pb-6 pt-4 text-center text-sm text-slate-500">لا دفعات مستحقة هذا الشهر.</p>
      ) : (
        <ul className="divide-y divide-slate-100/80">
          {rows.map((r) => {
            const { status } = installmentStatus(r.inst, today);
            return (
              <li
                key={r.inst.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2.5 sm:px-3",
                  status === "overdue" && "bg-rose-50/50"
                )}
              >
                <PayToggle
                  paid={r.inst.status === "PAID"}
                  pending={pendingIds.has(r.inst.id)}
                  label={`${r.inst.label} — ${r.plan.title}`}
                  onToggle={() => onToggle(r)}
                  size="sm"
                />
                <Link href={`/splits/${r.plan.id}`} className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", r.inst.status === "PAID" ? "text-slate-500" : "text-slate-900")} dir="auto">
                    {r.plan.title}
                  </p>
                  <p className="truncate text-xs">
                    <span className={cn("font-medium", STATUS_TEXT[status])}>{installmentStatusLabel(r.inst, today)}</span>
                    <span className="text-slate-400"> · {r.inst.label}</span>
                  </p>
                </Link>
                <span
                  className={cn(
                    "num shrink-0 text-sm font-bold",
                    r.inst.status === "PAID" ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900"
                  )}
                >
                  {formatCurrencyPrecise(r.inst.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ───────────── Plan row ───────────── */

function PlanRow({ plan, today }: { plan: SplitPlan; today: string | null }) {
  const done = plan.pendingCount === 0;
  const next = plan.installments.find((i) => i.status === "PENDING");
  const nextStatus = next ? installmentStatus(next, today).status : null;

  return (
    <li>
      <Link
        href={`/splits/${plan.id}`}
        className="group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-slate-50 sm:px-3"
      >
        <ServiceAvatar title={plan.title} muted={done} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn("truncate font-semibold", done ? "text-slate-500" : "text-slate-900")} dir="auto">
              {plan.title}
            </p>
            <p className="num shrink-0 text-sm font-bold text-slate-900">
              {done ? formatCurrency(plan.totalAmount) : formatCurrency(plan.remaining)}
            </p>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="truncate">
              <span className="num">{plan.paidCount}</span> من <span className="num">{plan.installments.length}</span> ·{" "}
              {done ? "مكتمل" : `ينتهي ${formatMonth(planEndDate(plan))}`}
            </span>
            <span className="shrink-0">{done ? "الإجمالي" : "متبقٍ"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-indigo-500")}
              style={{ width: `${plan.percentComplete}%` }}
            />
          </div>
          {next && (
            <p className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span className={cn("font-medium", STATUS_TEXT[nextStatus!])}>
                التالية: {installmentStatusLabel(next, today)}
              </span>
              <span className="num text-slate-600">
                {formatCurrencyPrecise(next.amount)}
                {Math.abs(planMonthly(plan) - next.amount) > 0.01 && (
                  <span className="text-slate-400"> · {formatCurrency(planMonthly(plan))}/شهر</span>
                )}
              </span>
            </p>
          )}
        </div>
        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
      </Link>
    </li>
  );
}

/* ───────────── Page ───────────── */

export function SplitsPageClient({
  items,
  categories,
  paymentMethods,
}: {
  items: SplitPlan[];
  categories: Lookup[];
  paymentMethods: Lookup[];
}) {
  const router = useRouter();
  const today = useTodayIso();
  const [, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("active");
  const [formKey, setFormKey] = useState<number | null>(null);

  const plans = useMemo(() => items.map((p) => withOverrides(p, overrides)), [items, overrides]);
  const active = plans.filter((p) => p.pendingCount > 0);
  const done = plans.filter((p) => p.pendingCount === 0);

  // Active plans: soonest next payment first. Finished: most recent first.
  const listed = (filter === "active" ? active : filter === "done" ? done : plans)
    .slice()
    .sort((a, b) => {
      const an = a.nextDue?.dueDate ?? "9999";
      const bn = b.nextDue?.dueDate ?? "9999";
      return an.localeCompare(bn) || planEndDate(b).localeCompare(planEndDate(a));
    });

  const monthKey = today?.slice(0, 7);
  const dueRows: DueRow[] = monthKey
    ? plans
        .flatMap((plan) =>
          plan.installments
            .filter(
              (inst) =>
                inst.dueDate.slice(0, 7) === monthKey ||
                (inst.status === "PENDING" && inst.dueDate.slice(0, 7) < monthKey)
            )
            .map((inst) => ({ plan, inst }))
        )
        .sort(
          (a, b) =>
            Number(a.inst.status === "PAID") - Number(b.inst.status === "PAID") ||
            a.inst.dueDate.localeCompare(b.inst.dueDate)
        )
    : [];

  const toggle = (row: DueRow, paid = row.inst.status !== "PAID", undoable = true) => {
    const id = row.inst.id;
    setOverrides((o) => ({ ...o, [id]: paid }));
    setPendingIds((s) => new Set(s).add(id));
    startTransition(async () => {
      const ok = await setInstallmentPaid(row.inst, paid);
      setPendingIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      if (!ok) {
        setOverrides((o) => {
          const rest = { ...o };
          delete rest[id];
          return rest;
        });
        toast.error("تعذّر تحديث الدفعة");
        return;
      }
      router.refresh();
      if (undoable) {
        toast.success(
          paid
            ? `سُجّل دفع ${row.plan.title} · ${formatCurrencyPrecise(row.inst.amount)}`
            : `أُلغي تسجيل ${row.inst.label}`,
          {
            description: paid ? "أُضيف إلى مصروفاتك" : undefined,
            action: { label: "تراجع", onClick: () => toggle(row, !paid, false) },
          }
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأقساط"
        description="مشترياتك بالتقسيط (תשלומים) — ما دفعته، ما تبقّى، وموعد كل دفعة."
        actions={
          <Button variant="brand" onClick={() => setFormKey(Date.now())}>
            <Plus className="h-4 w-4" /> تقسيط جديد
          </Button>
        }
      />

      {plans.length === 0 ? (
        <Card className="overflow-hidden">
          <div className="relative px-6 py-14 text-center">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/80 to-transparent" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <CreditCard className="h-7 w-7" />
            </div>
            <h2 className="relative mt-5 text-xl font-bold text-slate-900">تابع مشترياتك بالتقسيط</h2>
            <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              أدخل المبلغ وعدد الدفعات — نحسب كل قسط، نذكّرك بموعده، ونسجّله في مصروفات شهره بضغطة.
            </p>
            <Button variant="brand" size="lg" className="relative mt-6" onClick={() => setFormKey(Date.now())}>
              <Plus className="h-5 w-5" /> أضف أول تقسيط
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Summary plans={plans} today={today} />
            </div>
            <div className="lg:col-span-2">
              <ThisMonth rows={dueRows} today={today} pendingIds={pendingIds} onToggle={(r) => toggle(r)} />
            </div>
          </div>

          <Card className="p-2 sm:p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 pb-1 sm:p-3 sm:pb-2">
              <h2 className="text-sm font-semibold text-slate-900">كل الأقساط</h2>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    ["active", `نشطة (${active.length})`],
                    ["done", `مكتملة (${done.length})`],
                    ["all", `الكل (${plans.length})`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                      filter === value ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {listed.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">
                {filter === "done" ? "لا أقساط مكتملة بعد." : "لا أقساط نشطة — أحسنت!"}
              </p>
            ) : (
              <ul className="grid divide-y divide-slate-100/80 xl:grid-cols-2 xl:gap-x-6 xl:divide-y-0">
                {listed.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} today={today} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {formKey != null && (
        <PlanFormDialog
          key={formKey}
          open
          onOpenChange={(o) => !o && setFormKey(null)}
          plan={null}
          categories={categories}
          paymentMethods={paymentMethods}
        />
      )}
    </div>
  );
}
