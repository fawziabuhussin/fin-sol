export function subscriptionPeriodIndex(year: number, month: number): number {
  return year * 12 + month;
}

/** Whether a recurring subscription should appear in the given month. */
export function subscriptionActiveInMonth(
  sub: {
    lastActivePeriodYear: number | null;
    lastActivePeriodMonth: number | null;
  },
  year: number,
  month: number
): boolean {
  if (sub.lastActivePeriodYear == null || sub.lastActivePeriodMonth == null) {
    return true;
  }
  return (
    subscriptionPeriodIndex(year, month) <=
    subscriptionPeriodIndex(sub.lastActivePeriodYear, sub.lastActivePeriodMonth)
  );
}

/** Month immediately before the given calendar month. */
export function previousCalendarMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}
