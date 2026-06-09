import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { addAssetEntry } from "@/lib/savings-asset-entries";
import { savingsAssetEntrySchema } from "@/lib/validations/savings";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: assetId } = await params;

    const asset = await prisma.savingsAsset.findFirst({
      where: { id: assetId, userId: user.id },
    });
    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = savingsAssetEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const entry = await addAssetEntry({
      userId: user.id,
      assetId,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      purchasedAt: parsed.data.purchasedAt,
      unitPrice: parsed.data.unitPrice,
      bankFeeIls: parsed.data.bankFeeIls,
      notes: parsed.data.notes,
    });
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "الكمية أكبر من الرصيد المتاح" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "UNIT_PRICE_REQUIRED") {
      return NextResponse.json(
        { error: "أدخل سعر الوحدة بالشيكل" },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
