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

/** Extract calendar month (1-12) from a UTC date column. */
export function utcMonth(d: Date) {
  return d.getUTCMonth() + 1;
}

export function utcYear(d: Date) {
  return d.getUTCFullYear();
}
