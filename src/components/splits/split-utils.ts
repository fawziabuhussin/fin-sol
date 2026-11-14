import { monthLabel } from "@/lib/finance-labels";
import { localTodayIso } from "@/lib/dates";
import { daysPhrase } from "@/components/subscriptions/status";
import type { SplitPlanView } from "@/lib/split-payments";

export type SplitPlan = SplitPlanView;
export type SplitInstallment = SplitPlan["installments"][number];
export type InstallmentStatus = "paid" | "overdue" | "today" | "soon" | "upcoming";

const DAY = 24 * 60 * 60 * 1000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** "24 ديسمبر 2026" — avoids raw ISO dates, which render reversed in RTL. */
export function formatDay(iso: string, withYear = true) {
  const [y, m, d] = iso.split("-").map(Number);
  return withYear ? `${d} ${monthLabel(m!)} ${y}` : `${d} ${monthLabel(m!)}`;
}

/** "أبريل 2027" */
export function formatMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return `${monthLabel(m!)} ${y}`;
}

export function installmentStatus(
  inst: Pick<SplitInstallment, "status" | "dueDate">,
  today: string | null
): { status: InstallmentStatus; days: number | null } {
  if (inst.status === "PAID") return { status: "paid", days: null };
  if (!today) return { status: "upcoming", days: null };
  const days = Math.round((utc(inst.dueDate) - utc(today)) / DAY);
  if (days < 0) return { status: "overdue", days };
  if (days === 0) return { status: "today", days };
  if (days <= 5) return { status: "soon", days };
  return { status: "upcoming", days };
}

export function installmentStatusLabel(inst: SplitInstallment, today: string | null) {
  const { status, days } = installmentStatus(inst, today);
  switch (status) {
    case "paid":
      return inst.paidAt ? `دُفع ${formatDay(inst.paidAt, false)}` : "مدفوع";
    case "overdue":
      return `متأخر ${daysPhrase(Math.abs(days!))}`;
    case "today":
      return "مستحق اليوم";
    case "soon":
      return days === 1 ? "مستحق غداً" : `خلال ${daysPhrase(days!)}`;
    default:
      return formatDay(inst.dueDate);
  }
}

export const STATUS_TEXT: Record<InstallmentStatus, string> = {
  paid: "text-emerald-600",
  overdue: "text-rose-600",
  today: "text-amber-600",
  soon: "text-amber-600",
  upcoming: "text-slate-500",
};

/**
 * Date to book the expense on when an installment is marked paid: its due date
 * if that has arrived (so a late March payment stays in March), otherwise today
 * (paying early). Uses the viewer's local date, not UTC.
 */
export function payDateFor(inst: Pick<SplitInstallment, "dueDate">, today = localTodayIso()) {
  return inst.dueDate <= today ? inst.dueDate : today;
}

export function planEndDate(plan: SplitPlan) {
  return plan.installments.at(-1)?.dueDate ?? plan.startDate;
}

export function planMonthly(plan: SplitPlan) {
  return plan.recurringAmount ?? plan.installments[1]?.amount ?? plan.installments[0]?.amount ?? 0;
}

/** Re-derive totals after optimistic paid/unpaid overrides. */
export function withOverrides(plan: SplitPlan, overrides: Record<string, boolean>): SplitPlan {
  if (!plan.installments.some((i) => i.id in overrides)) return plan;
  const today = localTodayIso();
  const installments = plan.installments.map((i) =>
    i.id in overrides
      ? {
          ...i,
          status: overrides[i.id] ? "PAID" : "PENDING",
          paidAt: overrides[i.id] ? (i.paidAt ?? payDateFor(i, today)) : null,
        }
      : i
  );
  const paid = installments.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  const paidCount = installments.filter((i) => i.status === "PAID").length;
  const next = installments.find((i) => i.status === "PENDING");
  return {
    ...plan,
    installments,
    paid,
    paidCount,
    pendingCount: installments.length - paidCount,
    remaining: Math.max(0, Math.round((plan.totalAmount - paid) * 100) / 100),
    percentComplete: plan.totalAmount > 0 ? Math.round((paid / plan.totalAmount) * 100) : 0,
    nextDue: next
      ? { id: next.id, label: next.label, dueDate: next.dueDate, amount: next.amount }
      : null,
  };
}

/** Toggle an installment's paid state on the server. */
export async function setInstallmentPaid(inst: SplitInstallment, paid: boolean) {
  const res = await fetch(`/api/split-installments/${inst.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paid ? { paid: true, occurredAt: payDateFor(inst) } : { paid: false }),
  });
  return res.ok;
}
