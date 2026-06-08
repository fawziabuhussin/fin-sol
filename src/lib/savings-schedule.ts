import { monthLabel } from "@/lib/finance-labels";

/** Last calendar day of period (UTC) — used as savings payment date for that month. */
export function paidAtForPeriod(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

/** First calendar day of period (UTC) — used as subscription payment date for that month. */
export function subscriptionPaidAtForPeriod(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function periodFromDate(d: Date) {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
  };
}

export function periodLabel(year: number, month: number) {
  return `${monthLabel(month)} ${year}`;
}

/** Expand a lump sum into N monthly periods starting at plan schedule index. */
export function periodsFromPaymentCount(
  startYear: number,
  startMonth: number,
  count: number
): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

/**
 * Given total paid and monthly amount, return how many full months were covered
 * and any remainder (applied to the next month).
 */
export function parsePaymentIntoMonths(totalPaid: number, monthlyAmount: number) {
  if (monthlyAmount <= 0) return { fullMonths: 0, remainder: totalPaid };
  const fullMonths = Math.floor(totalPaid / monthlyAmount);
  const remainder = Math.round((totalPaid - fullMonths * monthlyAmount) * 100) / 100;
  return { fullMonths, remainder };
}
