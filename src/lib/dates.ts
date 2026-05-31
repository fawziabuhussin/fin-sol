/** UTC-safe month boundaries for Prisma @db.Date fields. */
export function monthRangeUTC(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function yearRangeUTC(year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

/** Format a @db.Date value for display (UTC calendar date). */
export function formatUtcDate(d: Date | string) {
  const date =
    typeof d === "string"
      ? new Date(d.includes("T") ? d : `${d}T00:00:00.000Z`)
      : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}.${m}.${y}`;
}

/** Extract calendar month (1-12) from a UTC date column. */
export function utcMonth(d: Date) {
  return d.getUTCMonth() + 1;
}

export function utcYear(d: Date) {
  return d.getUTCFullYear();
}
