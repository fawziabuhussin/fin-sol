/**
 * The current calendar month in the app's timezone (servers run in UTC, so
 * `new Date().getMonth()` is wrong for the first hours of a month in Israel).
 * Override with APP_TIMEZONE for deployments serving other regions.
 */
export function currentPeriod(timeZone = process.env.APP_TIMEZONE || "Asia/Jerusalem") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
  };
}
