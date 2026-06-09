import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { ASSET_KIND_CONFIG, isSingletonAssetKind } from "@/lib/savings-asset-kinds";
import { savingsAssetSchema } from "@/lib/validations/savings";
import {
  computeAssetValueIls,
  normalizeUsdRate,
} from "@/lib/savings-asset-value";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = savingsAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const config = ASSET_KIND_CONFIG[data.kind];

    if (isSingletonAssetKind(data.kind)) {
      const existing = await prisma.savingsAsset.findFirst({
        where: { userId: user.id, kind: data.kind },
      });
      if (existing) {
        return NextResponse.json(
          { error: `يوجد أصل ${config.label} مسجّل مسبقاً` },
          { status: 409 }
        );
      }
    }

    const title =
      data.title.trim() ||
      (data.kind === "CUSTOM" ? config.defaultTitle : config.defaultTitle);
    const duplicateTitle = await prisma.savingsAsset.findFirst({
      where: { userId: user.id, title },
    });
    if (duplicateTitle) {
      return NextResponse.json(
        { error: "يوجد أصل بنفس الاسم" },
        { status: 409 }
      );
    }

    const unitPrice =
      data.kind === "USD" ? normalizeUsdRate(data.unitPrice) : data.unitPrice;
    const valueIls = computeAssetValueIls(data.kind, data.quantity, unitPrice);

    const created = await prisma.savingsAsset.create({
      data: {
        userId: user.id,
        kind: data.kind,
        title,
        quantity: data.quantity,
        unitPrice,
        goldKarat: data.kind === "GOLD" ? (data.goldKarat ?? 21) : null,
        unitLabel: data.unitLabel?.trim() || config.defaultUnitLabel,
        priceCurrency: data.priceCurrency,
        valueIls,
        notes: data.notes || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
