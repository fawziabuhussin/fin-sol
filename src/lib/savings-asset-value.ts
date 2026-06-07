import type { SavingsAssetKind } from "@/generated/prisma/client";

/** ILS per 1 USD — sanity bounds for user input mistakes */
const USD_RATE_MIN = 2;
const USD_RATE_MAX = 8;

/**
 * For USD assets, `unitPrice` is the ₪/$ exchange rate (typically 3–4).
 * For GOLD, `unitPrice` is ₪ per gram.
 */
export function normalizeUsdRate(unitPrice: number): number {
  if (unitPrice >= USD_RATE_MIN && unitPrice <= USD_RATE_MAX) return unitPrice;
  if (unitPrice > USD_RATE_MAX) {
    return 3.67;
  }
  return Math.max(USD_RATE_MIN, unitPrice);
}

export function computeAssetValueIls(
  kind: SavingsAssetKind | "GOLD" | "USD",
  quantity: number,
  unitPrice: number
): number {
  if (kind === "USD") {
    const rate = normalizeUsdRate(unitPrice);
    return Math.round(quantity * rate * 100) / 100;
  }
  return Math.round(quantity * unitPrice * 100) / 100;
}
