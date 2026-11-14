"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ServiceAvatar } from "@/components/subscriptions/service-avatar";
import { useTodayIso } from "@/components/subscriptions/status";
import { PayToggle } from "@/components/splits/pay-toggle";
import { PlanFormDialog } from "@/components/splits/plan-form-dialog";
import { InstallmentDialog } from "@/components/splits/installment-dialog";
import {
  STATUS_TEXT,
  formatDay,
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

type Lookup = { id: string; name: string };

export function SplitPlanDetailClient({
  plan: serverPlan,
  categories,
  paymentMethods,
}: {
  plan: SplitPlan;
  categories: Lookup[];
  paymentMethods: Lookup[];
}) {
  const router = useRouter();
  const today = useTodayIso();
  const [isPending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [planForm, setPlanForm] = useState<number | null>(null);
  const [instForm, setInstForm] = useState<{ key: number; inst: SplitInstallment | null } | null>(null);
  const [confirm, setConfirm] = useState<
    { kind: "plan" } | { kind: "installment"; inst: SplitInstallment } | null
  >(null);

  const plan = useMemo(() => withOverrides(serverPlan, overrides), [serverPlan, overrides]);
  const done = plan.pendingCount === 0;
  const nextId = plan.installments.find((i) => i.status === "PENDING")?.id;
  const overdue = plan.installments.filter((i) => installmentStatus(i, today).status === "overdue");

  const toggle = (inst: SplitInstallment, paid = inst.status !== "PAID", undoable = true) => {
    setOverrides((o) => ({ ...o, [inst.id]: paid }));
    setPendingIds((s) => new Set(s).add(inst.id));
    startTransition(async () => {
      const ok = await setInstallmentPaid(inst, paid);
      setPendingIds((s) => {
        const n = new Set(s);
        n.delete(inst.id);
        return n;
      });
      if (!ok) {
        setOverrides((o) => {
          const rest = { ...o };
          delete rest[inst.id];
          return rest;
        });
        toast.error("تعذّر تحديث الدفعة");
        return;
      }
      router.refresh();
      if (undoable) {
        toast.success(
          paid ? `سُجّل ${inst.label} · ${formatCurrencyPrecise(inst.amount)}` : `أُلغي تسجيل ${inst.label}`,
          { action: { label: "تراجع", onClick: () => toggle(inst, !paid, false) } }
        );
      }
    });
  };

  const runDelete = () => {
    if (!confirm) return;
    startTransition(async () => {
      const url =
        confirm.kind === "plan" ? `/api/split-plans/${plan.id}` : `/api/split-installments/${confirm.inst.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        toast.error("تعذّر الحذف");
        return;
      }
      if (confirm.kind === "plan") {
        toast.success(`حُذف «${plan.title}»`);
        router.push("/splits");
      } else {
        toast.success(`حُذفت ${confirm.inst.label}`);
        setConfirm(null);
        router.refresh();
      }
    });
  };

  const meta = [plan.paymentMethodName, plan.categoryName, `بدأ ${formatDay(plan.startDate)}`].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/splits" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowRight className="h-4 w-4" /> كل الأقساط
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4">
        <ServiceAvatar title={plan.title} className="h-12 w-12 rounded-2xl text-base sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl" dir="auto">
              {plan.title}
            </h1>
            {done ? <Badge variant="success">مكتمل</Badge> : overdue.length > 0 && <Badge variant="warning">{overdue.length} متأخرة</Badge>}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{meta.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setPlanForm(Date.now())}>
            <Pencil className="h-3.5 w-3.5" /> تعديل
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="خيارات التقسيط">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setPlanForm(Date.now())}>
                <Pencil /> تعديل التقسيط
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInstForm({ key: Date.now(), inst: null })}>
                <Plus /> إضافة دفعة
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 [&_svg]:text-rose-500" onSelect={() => setConfirm({ kind: "plan" })}>
                <Trash2 /> حذف التقسيط
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">{done ? "دُفع بالكامل" : "المتبقي"}</p>
            <p className="num mt-1 text-4xl font-bold tracking-tight">
              {formatCurrency(done ? plan.totalAmount : plan.remaining)}
            </p>
          </div>
          <p className="text-sm text-white/60">
            من <span className="num font-semibold text-white">{formatCurrency(plan.totalAmount)}</span>
          </p>
        </div>
        <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500 transition-[width] duration-700"
            style={{ width: `${plan.percentComplete}%` }}
          />
        </div>
        <dl className="relative mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
          <div className="px-2 text-center">
            <dt className="text-[11px] text-white/55">القسط الشهري</dt>
            <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{formatCurrencyPrecise(planMonthly(plan))}</dd>
          </div>
          <div className="px-2 text-center">
            <dt className="text-[11px] text-white/55">الدفعات</dt>
            <dd className="num mt-0.5 text-sm font-semibold sm:text-base">
              {plan.paidCount} من {plan.installments.length}
            </dd>
          </div>
          <div className="px-2 text-center">
            <dt className="text-[11px] text-white/55">ينتهي</dt>
            <dd className="mt-0.5 text-sm font-semibold sm:text-base">{formatMonth(planEndDate(plan))}</dd>
          </div>
        </dl>
      </div>

      {/* Schedule */}
      <Card className="p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">جدول الدفعات</h2>
            <p className="mt-0.5 text-xs text-slate-500">اضغط ✓ عند الدفع ليُسجَّل في مصروفات شهره</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setInstForm({ key: Date.now(), inst: null })}>
            <Plus className="h-4 w-4" /> دفعة
          </Button>
        </div>
        <ol className="mt-1 divide-y divide-slate-100/80">
          {plan.installments.map((inst) => {
            const paid = inst.status === "PAID";
            const { status } = installmentStatus(inst, today);
            const isNext = inst.id === nextId;
            return (
              <li
                key={inst.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-3 sm:px-3",
                  status === "overdue" && "bg-rose-50/50",
                  isNext && status !== "overdue" && "bg-indigo-50/50"
                )}
              >
                <PayToggle
                  paid={paid}
                  pending={pendingIds.has(inst.id)}
                  label={inst.label}
                  onToggle={() => toggle(inst)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("truncate text-sm font-semibold", paid ? "text-slate-500" : "text-slate-900")}>
                      {inst.label}
                    </p>
                    {isNext && status !== "overdue" && <Badge variant="brand">التالية</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs">
                    <span className={cn("font-medium", STATUS_TEXT[status])}>{installmentStatusLabel(inst, today)}</span>
                    {(paid || status !== "upcoming") && (
                      <span className="text-slate-400"> · استحقاق {formatDay(inst.dueDate, false)}</span>
                    )}
                    {inst.notes && <span className="text-slate-400"> · {inst.notes}</span>}
                  </p>
                </div>
                <span
                  className={cn(
                    "num shrink-0 text-sm font-bold",
                    paid ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900"
                  )}
                >
                  {formatCurrencyPrecise(inst.amount)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="shrink-0 text-slate-400" aria-label={`تعديل الدفعة ${inst.label}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => setInstForm({ key: Date.now(), inst })}>
                      <Pencil /> تعديل الدفعة
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-rose-600 [&_svg]:text-rose-500"
                      onSelect={() => setConfirm({ kind: "installment", inst })}
                    >
                      <Trash2 /> حذف الدفعة
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ol>
      </Card>

      {planForm != null && (
        <PlanFormDialog
          key={planForm}
          open
          onOpenChange={(o) => !o && setPlanForm(null)}
          plan={serverPlan}
          categories={categories}
          paymentMethods={paymentMethods}
        />
      )}
      {instForm && (
        <InstallmentDialog
          key={instForm.key}
          open
          onOpenChange={(o) => !o && setInstForm(null)}
          planId={plan.id}
          installment={instForm.inst}
          defaultAmount={planMonthly(plan)}
        />
      )}
      <ConfirmDialog
        open={confirm != null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        pending={isPending}
        confirmLabel="حذف"
        title={confirm?.kind === "plan" ? `حذف «${plan.title}»؟` : `حذف ${confirm?.kind === "installment" ? confirm.inst.label : ""}؟`}
        description={
          confirm?.kind === "plan"
            ? "سيُحذف التقسيط وكل دفعاته، وتُحذف المصروفات التي سُجّلت منه. لا يمكن التراجع."
            : "تُحذف هذه الدفعة فقط. إن كانت مدفوعة يُحذف مصروفها أيضاً."
        }
        onConfirm={runDelete}
      />
    </div>
  );
}
