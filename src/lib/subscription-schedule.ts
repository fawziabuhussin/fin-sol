/**
 * Pure scheduling rules for recurring subscriptions (client- and server-safe).
 * A "period" is a calendar month; dates are handled in UTC like the rest of
 * the app's @db.Date columns.
 */

export type BillingCycleValue = "MONTHLY" | "YEARLY";

export type ScheduleFields = {
  billingCycle: BillingCycleValue;
  billingMonth: number | null;
  billingDay: number | null;
  startDate: Date | null;
  endDate: Date | null;
};

export function periodIndex(year: number, month: number) {
  return year * 12 + (month - 1);
}

export function periodFromIndex(index: number) {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function dateToPeriodIndex(d: Date) {
  return periodIndex(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First day of a period as a UTC date (what @db.Date columns store). */
export function periodStartDate(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Does this subscription bill in the given month? */
export function billsInPeriod(sub: ScheduleFields, year: number, month: number) {
  const idx = periodIndex(year, month);
  if (sub.startDate && idx < dateToPeriodIndex(sub.startDate)) return false;
  if (sub.endDate && idx > dateToPeriodIndex(sub.endDate)) return false;
  if (sub.billingCycle === "YEARLY") {
    const renewal = sub.billingMonth ?? (sub.startDate ? sub.startDate.getUTCMonth() + 1 : month);
    return renewal === month;
  }
  return true;
}

/** Has the subscription been cancelled before the given month? */
export function endedBefore(sub: ScheduleFields, year: number, month: number) {
  return !!sub.endDate && dateToPeriodIndex(sub.endDate) < periodIndex(year, month);
}

/** ISO date (YYYY-MM-DD) the charge falls on within a month. */
export function dueDateIso(billingDay: number | null, year: number, month: number) {
  const day = Math.min(Math.max(billingDay ?? 1, 1), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Next month (from `year/month` inclusive, within 24 months) the subscription bills. */
export function nextBillingPeriod(sub: ScheduleFields, year: number, month: number) {
  const from = periodIndex(year, month);
  for (let idx = from; idx < from + 24; idx++) {
    const p = periodFromIndex(idx);
    if (billsInPeriod(sub, p.year, p.month)) return p;
  }
  return null;
}

export function monthlyEquivalent(amount: number, cycle: BillingCycleValue) {
  return cycle === "YEARLY" ? amount / 12 : amount;
}

export function yearlyCost(amount: number, cycle: BillingCycleValue) {
  return cycle === "YEARLY" ? amount : amount * 12;
}
