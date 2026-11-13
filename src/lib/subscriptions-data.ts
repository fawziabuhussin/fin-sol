import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";
import {
  billsInPeriod,
  dueDateIso,
  endedBefore,
  monthlyEquivalent,
  nextBillingPeriod,
  periodFromIndex,
  periodIndex,
  yearlyCost,
  type BillingCycleValue,
} from "@/lib/subscription-schedule";

export type SubscriptionItem = {
  id: string;
  title: string;
  /** Amount for the viewed month (the paid amount if already paid). */
  amount: number;
  /** Current recurring price. */
  baseAmount: number;
  billingDay: number | null;
  billingCycle: BillingCycleValue;
  billingMonth: number | null;
  dueDate: string;
  startDate: string | null;
  endDate: string | null;
  categoryId: string | null;
  categoryName: string;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  notes: string | null;
  isDefault: boolean;
  paid: boolean;
  paidAt: string | null;
  monthlyEquivalent: number;
  yearlyCost: number;
};

export type SubscriptionLater = SubscriptionItem & {
  nextYear: number | null;
  nextMonth: number | null;
};

export type SubscriptionsOverview = {
  year: number;
  month: number;
  monthLabel: string;
  items: SubscriptionItem[];
  /** Ongoing subscriptions that don't bill this month (yearly, or starting later). */
  later: SubscriptionLater[];
  /** Cancelled before this month, or legacy-paused. */
  ended: SubscriptionItem[];
  hiddenThisMonth: SubscriptionItem[];
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  paidCount: number;
  totalCount: number;
  /** Normalised monthly cost of everything still running. */
  monthlyRunRate: number;
  yearlyRunRate: number;
  history: { year: number; month: number; label: string; due: number; paid: number }[];
};

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export async function getSubscriptionsOverview(
  userId: string,
  year: number,
  month: number
): Promise<SubscriptionsOverview> {
  const viewIdx = periodIndex(year, month);
  const historyFrom = periodFromIndex(viewIdx - 5);

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { title: "asc" },
    include: {
      payments: {
        where: {
          OR: [
            { periodYear: { gt: historyFrom.year } },
            { periodYear: historyFrom.year, periodMonth: { gte: historyFrom.month } },
          ],
        },
      },
      monthSkips: {
        where: {
          OR: [
            { periodYear: { gt: historyFrom.year } },
            { periodYear: historyFrom.year, periodMonth: { gte: historyFrom.month } },
          ],
        },
      },
      category: { select: { name: true } },
      paymentMethod: { select: { name: true } },
    },
  });

  const items: SubscriptionItem[] = [];
  const later: SubscriptionLater[] = [];
  const ended: SubscriptionItem[] = [];
  const hiddenThisMonth: SubscriptionItem[] = [];
  let monthlyRunRate = 0;

  const historyTotals = new Map<number, { due: number; paid: number }>();
  for (let i = viewIdx - 5; i <= viewIdx; i++) historyTotals.set(i, { due: 0, paid: 0 });

  for (const sub of subscriptions) {
    const schedule = {
      billingCycle: sub.billingCycle,
      billingMonth: sub.billingMonth,
      billingDay: sub.billingDay,
      startDate: sub.startDate,
      endDate: sub.endDate,
    };
    const baseAmount = decimalToNumber(sub.amount);
    const payment =
      sub.payments.find((p) => p.periodYear === year && p.periodMonth === month) ?? null;
    const skipped = sub.monthSkips.some(
      (s) => s.periodYear === year && s.periodMonth === month
    );

    const item: SubscriptionItem = {
      id: sub.id,
      title: sub.title,
      amount: payment?.paid ? decimalToNumber(payment.amount) : baseAmount,
      baseAmount,
      billingDay: sub.billingDay,
      billingCycle: sub.billingCycle,
      billingMonth: sub.billingMonth,
      dueDate: dueDateIso(sub.billingDay, year, month),
      startDate: isoDay(sub.startDate),
      endDate: isoDay(sub.endDate),
      categoryId: sub.categoryId,
      categoryName: sub.category?.name ?? "اشتراكات",
      paymentMethodId: sub.paymentMethodId,
      paymentMethodName: sub.paymentMethod?.name ?? null,
      notes: sub.notes,
      isDefault: sub.isDefault,
      paid: payment?.paid ?? false,
      paidAt: isoDay(payment?.paidAt),
      monthlyEquivalent: monthlyEquivalent(baseAmount, sub.billingCycle),
      yearlyCost: yearlyCost(baseAmount, sub.billingCycle),
    };

    // Six-month history (what was due vs. what was recorded as paid).
    for (let i = viewIdx - 5; i <= viewIdx; i++) {
      const p = periodFromIndex(i);
      const bucket = historyTotals.get(i)!;
      const pay = sub.payments.find((x) => x.periodYear === p.year && x.periodMonth === p.month);
      const hidden = sub.monthSkips.some((s) => s.periodYear === p.year && s.periodMonth === p.month);
      if (pay?.paid) {
        const amt = decimalToNumber(pay.amount);
        bucket.paid += amt;
        bucket.due += amt;
      } else if (sub.isActive && !hidden && billsInPeriod(schedule, p.year, p.month)) {
        bucket.due += baseAmount;
      }
    }

    // A recorded payment always keeps the row visible, whatever the schedule says.
    if (item.paid) {
      items.push(item);
    } else if (!sub.isActive || endedBefore(schedule, year, month)) {
      ended.push(item);
      continue;
    } else if (skipped) {
      hiddenThisMonth.push(item);
    } else if (billsInPeriod(schedule, year, month)) {
      items.push(item);
    } else {
      const next = nextBillingPeriod(schedule, year, month);
      later.push({ ...item, nextYear: next?.year ?? null, nextMonth: next?.month ?? null });
    }

    if (sub.isActive && !endedBefore(schedule, year, month)) {
      const startsLater = sub.startDate && sub.startDate.getTime() > Date.UTC(year, month, 0);
      if (!startsLater) monthlyRunRate += item.monthlyEquivalent;
    }
  }

  const totalDue = items.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = items.filter((i) => i.paid).reduce((sum, i) => sum + i.amount, 0);

  return {
    year,
    month,
    monthLabel: monthLabel(month),
    items,
    later,
    ended,
    hiddenThisMonth,
    totalDue,
    totalPaid,
    totalRemaining: totalDue - totalPaid,
    paidCount: items.filter((i) => i.paid).length,
    totalCount: items.length,
    monthlyRunRate,
    yearlyRunRate: monthlyRunRate * 12,
    history: [...historyTotals.entries()].map(([idx, v]) => {
      const p = periodFromIndex(idx);
      return { ...p, label: monthLabel(p.month), due: v.due, paid: v.paid };
    }),
  };
}
