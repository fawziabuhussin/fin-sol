import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { savingsAssetPatchSchema } from "@/lib/validations/savings";
import { getMarketRates } from "@/lib/market-rates";
import { computeAssetValueIls } from "@/lib/savings-asset-value";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.savingsAsset.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = savingsAssetPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const quantity =
      data.quantity !== undefined
        ? data.quantity
        : Number(existing.quantity);
    const liveRates =
      existing.kind === "USD" ? await getMarketRates().catch(() => null) : null;
    const unitPrice =
      existing.kind === "USD" && liveRates
        ? liveRates.usdIls
        : data.unitPrice !== undefined
          ? data.unitPrice
          : Number(existing.unitPrice);
    const valueIls = computeAssetValueIls(
      existing.kind,
      quantity,
      unitPrice,
      liveRates?.usdIls
    );

    const updated = await prisma.savingsAsset.update({
      where: { id },
      data: {
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        unitPrice,
        ...(data.goldKarat !== undefined ? { goldKarat: data.goldKarat } : {}),
        ...(data.priceCurrency !== undefined
          ? { priceCurrency: data.priceCurrency }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        valueIls,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.savingsAsset.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.savingsAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
