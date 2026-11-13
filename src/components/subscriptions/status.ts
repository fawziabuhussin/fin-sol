"use client";

import { useSyncExternalStore } from "react";
import { localTodayIso } from "@/lib/dates";
import { monthLabel } from "@/lib/finance-labels";
import type { SubscriptionItem } from "@/lib/subscriptions-data";

const noopSubscribe = () => () => {};

/**
 * The viewer's local date. `null` during SSR/hydration so server and client
 * markup match; relative labels ("in 3 days") appear right after hydration.
 */
export function useTodayIso(): string | null {
  return useSyncExternalStore(noopSubscribe, () => localTodayIso(), () => null);
}

export type DueStatus = "paid" | "overdue" | "today" | "soon" | "upcoming";

const DAY = 24 * 60 * 60 * 1000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function dueStatus(item: SubscriptionItem, today: string | null): {
  status: DueStatus;
  days: number | null;
} {
  if (item.paid) return { status: "paid", days: null };
  if (!today) return { status: "upcoming", days: null };
  const days = Math.round((toUtc(item.dueDate) - toUtc(today)) / DAY);
  if (days < 0) return { status: "overdue", days };
  if (days === 0) return { status: "today", days };
  if (days <= 3) return { status: "soon", days };
  return { status: "upcoming", days };
}

/** Arabic counted noun: يوم / يومين / 3–10 أيام / 11+ يوماً. */
export function daysPhrase(n: number) {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${monthLabel(m!)}`;
}

export function dueLabel(item: SubscriptionItem, today: string | null): string {
  const { status, days } = dueStatus(item, today);
  switch (status) {
    case "paid":
      return item.paidAt ? `دُفع · ${shortDate(item.paidAt)}` : "مدفوع";
    case "overdue":
      return days! < -27 ? "لم يُسجَّل دفعه" : `متأخر ${daysPhrase(Math.abs(days!))}`;
    case "today":
      return "مستحق اليوم";
    case "soon":
      return days === 1 ? "مستحق غداً" : `خلال ${daysPhrase(days!)}`;
    default:
      return item.billingDay ? `يُجدَّد ${shortDate(item.dueDate)}` : "بدون يوم ثابت";
  }
}

export const STATUS_TONE: Record<DueStatus, string> = {
  paid: "text-emerald-600",
  overdue: "text-rose-600",
  today: "text-amber-600",
  soon: "text-amber-600",
  upcoming: "text-slate-500",
};
