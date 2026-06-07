import type { SavingsAssetKind } from "@/generated/prisma/client";

/** ILS per 1 USD — sanity bounds for user input mistakes */
const USD_RATE_MIN = 2;
const USD_RATE_MAX = 8;

/**
 * For USD assets, `unitPrice` is the ₪/$ exchange rate (typically 3–4).
 * For GOLD, `unitPrice` is ₪ per gram.
 */
/** Reject corrupt stored rates (e.g. total ₪ saved as rate). */
export function normalizeUsdRate(unitPrice: number): number {
  if (unitPrice >= USD_RATE_MIN && unitPrice <= USD_RATE_MAX) return unitPrice;
  return 0;
}

export function computeAssetValueIls(
  kind: SavingsAssetKind | "GOLD" | "USD",
  quantity: number,
  unitPrice: number,
  /** When set, USD is always valued at this live ₪/$ rate (ignores stored unitPrice mistakes). */
  liveUsdIls?: number | null
): number {
  if (kind === "USD") {
    const rate =
      liveUsdIls != null && liveUsdIls > 0
        ? liveUsdIls
        : normalizeUsdRate(unitPrice);
    if (rate <= 0) return 0;
    return Math.round(quantity * rate * 100) / 100;
  }
  return Math.round(quantity * unitPrice * 100) / 100;
}
