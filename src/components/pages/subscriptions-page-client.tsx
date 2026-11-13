"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  MoreHorizontal,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app-shell/page-header";
import { ServiceAvatar } from "@/components/subscriptions/service-avatar";
import {
  SubscriptionFormDialog,
  type Lookup,
} from "@/components/subscriptions/subscription-form-dialog";
import {
  STATUS_TONE,
  dueLabel,
  dueStatus,
  useTodayIso,
} from "@/components/subscriptions/status";
import { cn, formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";
import { POPULAR_SERVICES } from "@/lib/subscription-brands";
import type {
  SubscriptionItem,
  SubscriptionsOverview,
} from "@/lib/subscriptions-data";

type Filter = "all" | "unpaid" | "paid";
type Sort = "due" | "amount" | "name";

const periodHref = (year: number, month: number) =>
  `/subscriptions?year=${year}&month=${month}`;

function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/* ───────────────────────────── Hero ───────────────────────────── */

function SummaryHero({
  data,
  items,
  today,
}: {
  data: SubscriptionsOverview;
  items: SubscriptionItem[];
  today: string | null;
}) {
  const prev = shiftMonth(data.year, data.month, -1);
  const next = shiftMonth(data.year, data.month, 1);
  const todayYear = today ? Number(today.slice(0, 4)) : null;
  const todayMonth = today ? Number(today.slice(5, 7)) : null;
  const isCurrent = todayYear === data.year && todayMonth === data.month;

  const totalDue = items.reduce((s, i) => s + i.amount, 0);
  const totalPaid = items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
  const paidCount = items.filter((i) => i.paid).length;
  const pct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={periodHref(prev.year, prev.month)}
            aria-label="الشهر السابق"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
          <h2 className="min-w-[130px] text-center text-base font-semibold">
            {data.monthLabel} {data.year}
          </h2>
          <Link
            href={periodHref(next.year, next.month)}
            aria-label="الشهر التالي"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </div>
        {!isCurrent && todayYear && todayMonth && (
          <Link
            href={periodHref(todayYear, todayMonth)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
          >
            الشهر الحالي
          </Link>
        )}
      </div>

      <div className="relative mt-6 sm:mt-8">
        <p className="text-sm text-white/60">المتبقي للدفع هذا الشهر</p>
        <p className="num mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
          {formatCurrency(Math.max(0, totalDue - totalPaid))}
        </p>
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
            <span>
              دفعت <span className="num font-semibold text-white">{formatCurrency(totalPaid)}</span>{" "}
              من <span className="num">{formatCurrency(totalDue)}</span>
            </span>
            <span>
              <span className="num font-semibold text-white">{paidCount}</span> من{" "}
              <span className="num">{items.length}</span> اشتراكات مدفوعة
            </span>
          </div>
        </div>
      </div>

      <dl className="relative mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
        {[
          { label: "التكلفة الشهرية", value: formatCurrency(data.monthlyRunRate) },
          { label: "التكلفة السنوية", value: formatCurrency(data.yearlyRunRate) },
          { label: "يومياً", value: formatCurrencyPrecise(Math.round((data.yearlyRunRate / 365) * 10) / 10) },
        ].map((s) => (
          <div key={s.label} className="px-3 text-center">
            <dt className="text-[11px] text-white/55">{s.label}</dt>
            <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ───────────────────────────── Trend ───────────────────────────── */

function TrendCard({ data }: { data: SubscriptionsOverview }) {
  const max = Math.max(1, ...data.history.map((h) => h.due));
  const avg =
    data.history.reduce((s, h) => s + h.paid, 0) /
    Math.max(1, data.history.filter((h) => h.paid > 0).length);

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">آخر 6 أشهر</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            متوسط المدفوع <span className="num font-semibold text-slate-700">{formatCurrency(avg)}</span> شهرياً
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />مدفوع</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" />مستحق</span>
        </div>
      </div>
      <div className="mt-5 flex flex-1 items-end gap-2 sm:gap-3" style={{ minHeight: 150 }}>
        {data.history.map((h) => {
          const active = h.year === data.year && h.month === data.month;
          return (
            <Link
              key={`${h.year}-${h.month}`}
              href={periodHref(h.year, h.month)}
              className="group flex flex-1 flex-col items-center gap-2"
              title={`${h.label} ${h.year}: مدفوع ${formatCurrency(h.paid)} من ${formatCurrency(h.due)}`}
            >
              <span className="num text-[10px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                {formatCurrency(h.paid)}
              </span>
              <div className="relative flex h-28 w-full max-w-10 items-end overflow-hidden rounded-lg bg-slate-100">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-lg bg-slate-200"
                  style={{ height: `${(h.due / max) * 100}%` }}
                />
                <div
                  className={cn(
                    "relative w-full rounded-lg transition-[height] duration-700",
                    active ? "bg-indigo-600" : "bg-indigo-400/80 group-hover:bg-indigo-500"
                  )}
                  style={{ height: `${(h.paid / max) * 100}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[11px]",
                  active ? "font-semibold text-indigo-700" : "text-slate-500"
                )}
              >
                {h.label}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Row ───────────────────────────── */

function PayToggle({
  paid,
  pending,
  onToggle,
  title,
}: {
  paid: boolean;
  pending: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={paid ? `إلغاء تسجيل دفع ${title}` : `تسجيل دفع ${title}`}
      onClick={onToggle}
      disabled={pending}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
        paid
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
          : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-300",
        pending && "opacity-60"
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}

function SubscriptionRow({
  item,
  today,
  pending,
  onToggle,
  onEdit,
  onHide,
  onCancel,
  onDelete,
}: {
  item: SubscriptionItem;
  today: string | null;
  pending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onHide: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { status } = dueStatus(item, today);
  const yearly = item.billingCycle === "YEARLY";

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors sm:px-3",
        status === "overdue" ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50"
      )}
    >
      <PayToggle paid={item.paid} pending={pending} onToggle={onToggle} title={item.title} />
      <ServiceAvatar title={item.title} muted={item.paid} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate font-semibold",
              item.paid ? "text-slate-500" : "text-slate-900"
            )}
            dir="auto"
          >
            {item.title}
          </p>
          {yearly && <Badge variant="brand">سنوي</Badge>}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs">
          <span className={cn("font-medium", STATUS_TONE[status])}>{dueLabel(item, today)}</span>
          {item.paymentMethodName && (
            <>
              <span className="text-slate-300">•</span>
              <span className="truncate text-slate-500">{item.paymentMethodName}</span>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-left">
        <p
          className={cn(
            "num font-bold",
            item.paid ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900"
          )}
        >
          {formatCurrencyPrecise(item.amount)}
        </p>
        <p className="num text-[11px] text-slate-400">
          {yearly ? `≈ ${formatCurrency(item.monthlyEquivalent)}/شهر` : `${formatCurrency(item.yearlyCost)}/سنة`}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-slate-400 hover:text-slate-700"
            aria-label={`خيارات ${item.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> تعديل
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHide} disabled={item.paid}>
            <EyeOff /> تخطّي هذا الشهر فقط
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCancel}>
            <PauseCircle /> إيقاف بعد هذا الشهر
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-rose-600 [&_svg]:text-rose-500">
            <Trash2 /> حذف نهائي
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* ───────────────────────────── Empty state ───────────────────────────── */

function EmptyState({
  onAdd,
  onImport,
}: {
  onAdd: (preset: string | null) => void;
  onImport?: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative px-6 py-12 text-center sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/80 to-transparent"
        />
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
          <Repeat className="h-7 w-7" />
        </div>
        <h2 className="relative mt-5 text-xl font-bold text-slate-900">كل اشتراكاتك في مكان واحد</h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
          أضف الخدمات التي تدفع لها بانتظام — نذكّرك بموعد كل دفعة، ونحسب تكلفتها الحقيقية
          شهرياً وسنوياً، وتُسجَّل تلقائياً في مصروفاتك بضغطة واحدة.
        </p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="brand" size="lg" onClick={() => onAdd(null)}>
            <Plus className="h-5 w-5" /> أضف أول اشتراك
          </Button>
          {onImport && (
            <Button variant="outline" size="lg" onClick={onImport}>
              <Download className="h-5 w-5" /> استيراد قائمتي
            </Button>
          )}
        </div>
        <div className="relative mx-auto mt-8 flex max-w-lg flex-wrap justify-center gap-2">
          {POPULAR_SERVICES.slice(0, 8).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onAdd(name)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-xs font-medium text-slate-700 shadow-card transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              <ServiceAvatar title={name} className="h-6 w-6 rounded-full text-[10px]" />
              {name}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

export function SubscriptionsPageClient({
  data,
  paymentMethods,
  categories,
  canImport,
}: {
  data: SubscriptionsOverview;
  paymentMethods: Lookup[];
  categories: Lookup[];
  canImport: boolean;
}) {
  const router = useRouter();
  const today = useTodayIso();
  const [isPending, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("due");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ item: SubscriptionItem | null; preset: string | null; key: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionItem | null>(null);

  const [items, applyOptimistic] = useOptimistic(
    data.items,
    (state, update: { ids: string[]; paid: boolean }) =>
      state.map((i) =>
        update.ids.includes(i.id)
          ? { ...i, paid: update.paid, paidAt: update.paid ? (today ?? i.dueDate) : null }
          : i
      )
  );

  const isEmpty =
    data.items.length + data.later.length + data.ended.length + data.hiddenThisMonth.length === 0;

  /* ── mutations ── */

  const mutate = async (input: RequestInfo, init: RequestInit, failMsg: string) => {
    const res = await fetch(input, init);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(typeof body.error === "string" ? body.error : failMsg);
      return false;
    }
    return true;
  };

  const setPaid = (targets: SubscriptionItem[], paid: boolean, withUndo = true) => {
    const ids = targets.map((t) => t.id);
    setPendingIds((s) => new Set([...s, ...ids]));
    startTransition(async () => {
      applyOptimistic({ ids, paid });
      const ok =
        ids.length === 1
          ? await mutate(
              `/api/subscriptions/${ids[0]}/payments`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodYear: data.year, periodMonth: data.month, paid }),
              },
              "تعذّر التحديث"
            )
          : await mutate(
              "/api/subscriptions/bulk-payments",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodYear: data.year, periodMonth: data.month, ids, paid }),
              },
              "تعذّر التحديث"
            );
      setPendingIds((s) => {
        const next = new Set(s);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      if (!ok) return;
      router.refresh();
      if (withUndo) {
        const total = targets.reduce((s, t) => s + t.amount, 0);
        const message =
          targets.length === 1
            ? paid
              ? `سُجّل دفع ${targets[0]!.title} · ${formatCurrencyPrecise(total)}`
              : `أُلغي تسجيل دفع ${targets[0]!.title}`
            : `سُجّل دفع ${targets.length} اشتراكات · ${formatCurrency(total)}`;
        toast.success(message, {
          description: paid ? "أُضيف إلى مصروفات الشهر" : undefined,
          action: { label: "تراجع", onClick: () => setPaid(targets, !paid, false) },
        });
      }
    });
  };

  const hideFromMonth = (item: SubscriptionItem, restore = false) =>
    startTransition(async () => {
      const ok = await mutate(
        `/api/subscriptions/${item.id}?scope=month&year=${data.year}&month=${data.month}${restore ? "&restore=1" : ""}`,
        { method: "DELETE" },
        "تعذّر التحديث"
      );
      if (!ok) return;
      router.refresh();
      toast.success(
        restore ? `أُعيد «${item.title}» إلى ${data.monthLabel}` : `تم تخطّي «${item.title}» في ${data.monthLabel}`,
        restore ? undefined : { action: { label: "تراجع", onClick: () => hideFromMonth(item, true) } }
      );
    });

  const patch = (item: SubscriptionItem, body: object, success: string) =>
    startTransition(async () => {
      const ok = await mutate(
        `/api/subscriptions/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "تعذّر الحفظ"
      );
      if (!ok) return;
      router.refresh();
      toast.success(success);
    });

  const cancelAfterThisMonth = (item: SubscriptionItem) =>
    patch(
      item,
      { endDate: `${data.year}-${String(data.month).padStart(2, "0")}-01` },
      `«${item.title}» سيتوقف بعد ${data.monthLabel} — السجل السابق محفوظ`
    );

  const resume = (item: SubscriptionItem) =>
    patch(item, { endDate: null, isActive: true }, `تم استئناف «${item.title}»`);

  const deleteForever = (item: SubscriptionItem) =>
    startTransition(async () => {
      const ok = await mutate(`/api/subscriptions/${item.id}`, { method: "DELETE" }, "تعذّر الحذف");
      if (!ok) return;
      setDeleteTarget(null);
      router.refresh();
      toast.success(`حُذف «${item.title}» نهائياً`);
    });

  const importDefaults = () =>
    startTransition(async () => {
      const ok = await mutate(
        "/api/subscriptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "seed-defaults" }),
        },
        "تعذّر الاستيراد"
      );
      if (!ok) return;
      router.refresh();
      toast.success("تم استيراد القائمة");
    });

  const openForm = (item: SubscriptionItem | null, preset: string | null = null) =>
    setForm({ item, preset, key: Date.now() });

  /* ── derived list ── */

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((i) => {
      if (filter === "paid" && !i.paid) return false;
      if (filter === "unpaid" && i.paid) return false;
      return !q || i.title.toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === "amount") return b.amount - a.amount;
      if (sort === "name") return a.title.localeCompare(b.title, "ar");
      return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, "ar");
    });
    return list;
  }, [items, filter, sort, query]);

  const groups = useMemo(() => {
    if (sort !== "due") return [{ key: "all", label: null as string | null, rows: visible }];
    const attention = visible.filter((i) => {
      const s = dueStatus(i, today).status;
      return s === "overdue" || s === "today";
    });
    const upcoming = visible.filter((i) => !i.paid && !attention.includes(i));
    const paid = visible.filter((i) => i.paid);
    return [
      { key: "attention", label: "بحاجة لانتباهك", rows: attention },
      { key: "upcoming", label: "القادمة", rows: upcoming },
      { key: "paid", label: "المدفوعة", rows: paid },
    ].filter((g) => g.rows.length > 0);
  }, [visible, sort, today]);

  const dueNow = items.filter((i) => {
    const s = dueStatus(i, today).status;
    return s === "overdue" || s === "today";
  });
  const unpaid = items.filter((i) => !i.paid);

  const topByCost = [...data.items, ...data.later]
    .sort((a, b) => b.yearlyCost - a.yearlyCost)
    .slice(0, 5);

  /* ── render ── */

  return (
    <div className="space-y-6">
      <PageHeader
        title="الاشتراكات"
        description="كل مدفوعاتك المتكررة في مكان واحد — علّم الاشتراك كمدفوع ليُضاف تلقائياً إلى مصروفات الشهر."
        actions={
          <>
            {canImport && !isEmpty && (
              <Button variant="outline" onClick={importDefaults} disabled={isPending}>
                <Download className="h-4 w-4" /> تحديث قائمتي
              </Button>
            )}
            <Button variant="brand" onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" /> اشتراك جديد
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyState onAdd={(preset) => openForm(null, preset)} onImport={canImport ? importDefaults : undefined} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SummaryHero data={data} items={items} today={today} />
            </div>
            <div className="lg:col-span-2">
              <TrendCard data={data} />
            </div>
          </div>

          {dueNow.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {dueNow.length === 1
                      ? `«${dueNow[0]!.title}» مستحق ولم يُسجَّل بعد`
                      : `${dueNow.length} اشتراكات مستحقة ولم تُسجَّل بعد`}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    المجموع <span className="num font-semibold">{formatCurrencyPrecise(dueNow.reduce((s, i) => s + i.amount, 0))}</span>
                    {" — "}إن دفعتها، سجّلها لتبقى أرقامك دقيقة.
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                className="shrink-0"
                disabled={isPending}
                onClick={() => setPaid(dueNow, true)}
              >
                <Check className="h-4 w-4" /> تسجيلها كمدفوعة
              </Button>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* Main list */}
            <Card className="p-2 sm:p-3">
              <div className="flex flex-col gap-3 p-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:p-3">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
                  {(
                    [
                      ["all", `الكل (${items.length})`],
                      ["unpaid", `المتبقي (${unpaid.length})`],
                      ["paid", `المدفوع (${items.length - unpaid.length})`],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={cn(
                        "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                        filter === value
                          ? "bg-white text-slate-900 shadow-card"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-48 sm:flex-none">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="بحث…"
                      aria-label="بحث في الاشتراكات"
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as Sort)}
                      aria-label="الترتيب"
                      className="h-9 w-36 pr-8 text-xs font-medium"
                    >
                      <option value="due">موعد الدفع</option>
                      <option value="amount">الأعلى مبلغاً</option>
                      <option value="name">الاسم</option>
                    </Select>
                  </div>
                </div>
              </div>

              {visible.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {items.length === 0
                      ? `لا اشتراكات مستحقة في ${data.monthLabel}`
                      : "لا نتائج مطابقة"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {items.length === 0
                      ? "الاشتراكات السنوية تظهر في شهر تجديدها فقط."
                      : "جرّب تغيير الفلتر أو كلمة البحث."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <section key={g.key} aria-label={g.label ?? undefined}>
                      {g.label && (
                        <div className="flex items-center justify-between px-3 pb-1 pt-2">
                          <h3
                            className={cn(
                              "text-xs font-semibold",
                              g.key === "attention" ? "text-rose-600" : "text-slate-400"
                            )}
                          >
                            {g.label} · <span className="num">{g.rows.length}</span>
                          </h3>
                          {g.key === "upcoming" && g.rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPaid(g.rows, true)}
                              disabled={isPending}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                            >
                              تسجيل الكل كمدفوع
                            </button>
                          )}
                        </div>
                      )}
                      <ul className="divide-y divide-slate-100/80">
                        {g.rows.map((item) => (
                          <SubscriptionRow
                            key={item.id}
                            item={item}
                            today={today}
                            pending={pendingIds.has(item.id)}
                            onToggle={() => setPaid([item], !item.paid)}
                            onEdit={() => openForm(item)}
                            onHide={() => hideFromMonth(item)}
                            onCancel={() => cancelAfterThisMonth(item)}
                            onDelete={() => setDeleteTarget(item)}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Card>

            {/* Side panels */}
            <div className="space-y-4">
              {topByCost.length > 0 && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900">أين تذهب أموالك</h3>
                  <p className="mt-0.5 text-xs text-slate-500">الأعلى تكلفة على مدار السنة</p>
                  <ul className="mt-4 space-y-3.5">
                    {topByCost.map((item) => {
                      const share = data.yearlyRunRate > 0 ? (item.yearlyCost / data.yearlyRunRate) * 100 : 0;
                      return (
                        <li key={item.id}>
                          <div className="flex items-center gap-2.5">
                            <ServiceAvatar title={item.title} className="h-7 w-7 rounded-lg text-[11px]" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" dir="auto">
                              {item.title}
                            </span>
                            <span className="num text-sm font-semibold text-slate-900">
                              {formatCurrency(item.yearlyCost)}
                            </span>
                          </div>
                          <div className="mr-[38px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, share)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {topByCost[0] && data.yearlyRunRate > 0 && (
                    <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                      «<span dir="auto">{topByCost[0].title}</span>» وحده يمثّل{" "}
                      <span className="num font-semibold text-slate-900">
                        {Math.round((topByCost[0].yearlyCost / data.yearlyRunRate) * 100)}%
                      </span>{" "}
                      من إنفاقك السنوي على الاشتراكات.
                    </p>
                  )}
                </Card>
              )}

              {data.later.length > 0 && (
                <Card className="p-5">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-slate-400" /> غير مستحقة هذا الشهر
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {data.later.map((item) => (
                      <li key={item.id} className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-slate-50">
                        <ServiceAvatar title={item.title} className="h-8 w-8 rounded-lg text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800" dir="auto">{item.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.nextMonth
                              ? `التالي: ${monthLabel(item.nextMonth)} ${item.nextYear}`
                              : "لا موعد قريب"}
                          </p>
                        </div>
                        <span className="num text-sm font-semibold text-slate-700">{formatCurrencyPrecise(item.amount)}</span>
                        <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${item.title}`} onClick={() => openForm(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {data.hiddenThisMonth.length > 0 && (
                <Card className="p-5">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <EyeOff className="h-4 w-4 text-slate-400" /> متخطّاة في {data.monthLabel}
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {data.hiddenThisMonth.map((item) => (
                      <li key={item.id} className="flex items-center gap-2.5 rounded-xl p-1.5">
                        <ServiceAvatar title={item.title} muted className="h-8 w-8 rounded-lg text-xs" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-600" dir="auto">{item.title}</span>
                        <Button variant="ghost" size="sm" onClick={() => hideFromMonth(item, true)} disabled={isPending}>
                          <Undo2 className="h-3.5 w-3.5" /> إعادة
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {data.ended.length > 0 && (
                <Card className="p-5">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <PauseCircle className="h-4 w-4 text-slate-400" /> متوقفة
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">سجلّها السابق محفوظ في التقارير</p>
                  <ul className="mt-3 space-y-1">
                    {data.ended.map((item) => (
                      <li key={item.id} className="flex items-center gap-2.5 rounded-xl p-1.5">
                        <ServiceAvatar title={item.title} muted className="h-8 w-8 rounded-lg text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-600" dir="auto">{item.title}</p>
                          {item.endDate && (
                            <p className="text-[11px] text-slate-400">
                              آخر شهر: {monthLabel(Number(item.endDate.slice(5, 7)))} {item.endDate.slice(0, 4)}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => resume(item)} disabled={isPending}>
                          <PlayCircle className="h-3.5 w-3.5" /> استئناف
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-400 hover:text-rose-600"
                          aria-label={`حذف ${item.title}`}
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {form && (
        <SubscriptionFormDialog
          key={form.key}
          open
          onOpenChange={(open) => !open && setForm(null)}
          item={form.item}
          preset={form.preset}
          year={data.year}
          month={data.month}
          paymentMethods={paymentMethods}
          categories={categories}
        />
      )}

      <Dialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف «{deleteTarget?.title}» نهائياً؟</DialogTitle>
            <DialogDescription>
              سيُحذف الاشتراك <strong className="text-slate-700">وكل المصروفات التي سُجّلت منه</strong> من
              كل الأشهر، ولا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pt-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">تريد إيقافه فقط؟</p>
              <p className="mt-1 text-xs leading-relaxed">
                «إيقاف بعد هذا الشهر» يحافظ على السجل السابق في تقاريرك ويخفيه من الأشهر القادمة.
              </p>
              {deleteTarget && !data.ended.some((e) => e.id === deleteTarget.id) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    cancelAfterThisMonth(deleteTarget);
                    setDeleteTarget(null);
                  }}
                >
                  <PauseCircle className="h-3.5 w-3.5" /> إيقاف بدلاً من الحذف
                </Button>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => deleteTarget && deleteForever(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
