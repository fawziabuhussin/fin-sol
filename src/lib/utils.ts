import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "ILS") {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isNaN(value) ? 0 : value);
}

/** Like formatCurrency but keeps agorot (e.g. ₪69.90 subscriptions). */
export function formatCurrencyPrecise(amount: number, currency = "ILS") {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

/**
 * "+3,087 ₪" / "-3,087 ₪" with correct bidi marks. Never prefix signs by hand
 * in RTL text — they end up on the wrong side of the number.
 */
export function formatSignedCurrency(amount: number, opts: { precise?: boolean } = {}) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    signDisplay: "exceptZero",
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.precise ? 2 : 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function parseMoney(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return parseMoney((value as { toString(): string }).toString());
  }
  const normalized = String(value).replace(/[,\s₪]/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decimalToNumber(
  value: { toString(): string } | number | null | undefined
): number {
  return parseMoney(value);
}

export function parseIntSafe(value: string | null | undefined, fallback = 1) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
