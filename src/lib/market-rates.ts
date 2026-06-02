/** Spot prices for savings assets (USD/ILS + gold by karat). */

const TROY_OZ_GRAMS = 31.1034768;

export const GOLD_KARAT_OPTIONS = [14, 18, 21, 22, 24] as const;
export type GoldKarat = (typeof GOLD_KARAT_OPTIONS)[number];

export type MarketRates = {
  fetchedAt: string;
  usdIls: number;
  usdIlsDate: string;
  gold: {
    karat: GoldKarat;
    pricePerGramIls: number;
    pricePerOzUsd: number;
    purity: number;
  };
};

async function fetchUsdIls() {
  const res = await fetch(
    "https://api.frankfurter.app/latest?from=USD&to=ILS",
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error("USD/ILS rate unavailable");
  const data = (await res.json()) as {
    date: string;
    rates: { ILS: number };
  };
  const rate = data.rates?.ILS;
  if (!rate || rate <= 0) throw new Error("Invalid USD/ILS rate");
  return { rate, date: data.date };
}

async function fetchGoldUsdPerOz() {
  const res = await fetch("https://api.gold-api.com/price/XAU", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("Gold price unavailable");
  const data = (await res.json()) as { price: number };
  if (!data.price || data.price <= 0) throw new Error("Invalid gold price");
  return data.price;
}

export function goldPricePerGramIls(
  pricePerOzUsd: number,
  usdIls: number,
  karat: GoldKarat
) {
  const purity = karat / 24;
  const perGram24kUsd = pricePerOzUsd / TROY_OZ_GRAMS;
  const perGramKaratIls = perGram24kUsd * purity * usdIls;
  return Math.round(perGramKaratIls * 100) / 100;
}

export async function getMarketRates(karat: GoldKarat = 21): Promise<MarketRates> {
  const [usd, goldOzUsd] = await Promise.all([fetchUsdIls(), fetchGoldUsdPerOz()]);
  const pricePerGramIls = goldPricePerGramIls(goldOzUsd, usd.rate, karat);

  return {
    fetchedAt: new Date().toISOString(),
    usdIls: Math.round(usd.rate * 10000) / 10000,
    usdIlsDate: usd.date,
    gold: {
      karat,
      pricePerGramIls,
      pricePerOzUsd: goldOzUsd,
      purity: karat / 24,
    },
  };
}
