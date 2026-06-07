/** Spot prices for savings assets (USD/ILS + gold by karat). */

const TROY_OZ_GRAMS = 31.1034768;

export const GOLD_KARAT_OPTIONS = [14, 18, 21, 22, 24] as const;
export type GoldKarat = (typeof GOLD_KARAT_OPTIONS)[number];

export type MarketRates = {
  fetchedAt: string;
  usdIls: number;
  usdIlsDate: string;
  usdIlsSource: "boi" | "frankfurter";
  gold: {
    karat: GoldKarat;
    pricePerGramIls: number;
    pricePerOzUsd: number;
    purity: number;
  };
};

/** Bank of Israel representative rate (שער יציג) — typically ~2.9 ₪/$. */
async function fetchUsdIlsFromBoi() {
  const res = await fetch("https://boi.org.il/PublicApi/GetExchangeRates", {
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error("BOI USD/ILS rate unavailable");
  const data = (await res.json()) as {
    exchangeRates: {
      key: string;
      currentExchangeRate: number;
      unit: number;
      lastUpdate: string;
    }[];
  };
  const usd = data.exchangeRates?.find((r) => r.key === "USD");
  if (!usd?.currentExchangeRate || usd.unit <= 0) {
    throw new Error("Invalid BOI USD rate");
  }
  const rate = usd.currentExchangeRate / usd.unit;
  return {
    rate,
    date: usd.lastUpdate.slice(0, 10),
    source: "boi" as const,
  };
}

async function fetchUsdIlsFrankfurter() {
  const res = await fetch(
    "https://api.frankfurter.app/latest?from=USD&to=ILS",
    { cache: "no-store", redirect: "follow" }
  );
  if (!res.ok) throw new Error("Frankfurter USD/ILS rate unavailable");
  const data = (await res.json()) as {
    date: string;
    rates: { ILS: number };
  };
  const rate = data.rates?.ILS;
  if (!rate || rate <= 0) throw new Error("Invalid Frankfurter USD/ILS rate");
  return { rate, date: data.date, source: "frankfurter" as const };
}

async function fetchUsdIls() {
  try {
    return await fetchUsdIlsFromBoi();
  } catch {
    return await fetchUsdIlsFrankfurter();
  }
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
    usdIlsSource: usd.source,
    gold: {
      karat,
      pricePerGramIls,
      pricePerOzUsd: goldOzUsd,
      purity: karat / 24,
    },
  };
}
