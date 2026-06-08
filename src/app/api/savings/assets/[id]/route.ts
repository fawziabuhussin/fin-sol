import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { savingsAssetPatchSchema } from "@/lib/validations/savings";
import { getMarketRates } from "@/lib/market-rates";
import { computeAssetValueIls } from "@/lib/savings-asset-value";
import { createAssetPurchaseTransaction } from "@/lib/savings-contribution";

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
    const oldQuantity = Number(existing.quantity);
    const quantity =
      data.quantity !== undefined ? data.quantity : oldQuantity;
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

    if (quantity > oldQuantity) {
      const deltaQty = quantity - oldQuantity;
      const entryValueIls = computeAssetValueIls(
        existing.kind,
        deltaQty,
        unitPrice,
        liveRates?.usdIls
      );
      const purchasedAt = new Date();
      const entry = await prisma.savingsAssetEntry.create({
        data: {
          assetId: id,
          quantity: deltaQty,
          unitPrice,
          valueIls: entryValueIls,
          purchasedAt,
          notes: data.notes || null,
        },
      });
      const tx = await createAssetPurchaseTransaction({
        userId: user.id,
        kind: existing.kind,
        amount: entryValueIls,
        occurredAt: purchasedAt,
        notes: data.notes ?? null,
      });
      await prisma.savingsAssetEntry.update({
        where: { id: entry.id },
        data: { transactionId: tx.id },
      });
    }

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
