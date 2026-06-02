import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import {
  GOLD_KARAT_OPTIONS,
  getMarketRates,
  type GoldKarat,
} from "@/lib/market-rates";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const karatRaw = Number.parseInt(searchParams.get("karat") ?? "21", 10);
    const karat = (
      GOLD_KARAT_OPTIONS.includes(karatRaw as GoldKarat) ? karatRaw : 21
    ) as GoldKarat;

    const rates = await getMarketRates(karat);
    return NextResponse.json(rates);
  } catch (error) {
    return handleApiError(error);
  }
}
