/** Default recurring subscriptions from the user's spreadsheet. */
export const DEFAULT_SUBSCRIPTIONS = [
  { title: "سنابل العلم", amount: 50, billingDay: 18 },
  { title: "Claude AI", amount: 60, billingDay: 4 },
  { title: "פלאפון", amount: 110, billingDay: 3 },
  { title: "Google Youtube", amount: 45.9, billingDay: 3 },
  { title: "ChatGpt", amount: 69.9, billingDay: 3 },
  { title: "SHADI FITNESS", amount: 200, billingDay: 3 },
  { title: "GOOGLE DRIVE", amount: 11.9, billingDay: 3 },
  { title: "GITHUB, INC.", amount: 33, billingDay: 3 },
  { title: "ICLOUD+", amount: 40, billingDay: 3 },
  { title: "Overleaf", amount: 26.73, billingDay: 3 },
  { title: "Vercel (شهري)", amount: 34.12, billingDay: 3 },
  { title: "Vercel (سنوي)", amount: 122.43, billingDay: 3 },
  { title: "apple sub", amount: 297.26, billingDay: null },
] as const;

export const DEFAULT_SUBSCRIPTION_START_YEAR = 2026;
/** Months 1–5 of start year are marked paid on initial seed. Month 6+ stays unpaid. */
export const DEFAULT_SUBSCRIPTION_PAID_THROUGH_MONTH = 5;
