import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import {
  deleteAssetEntry,
  updateAssetEntry,
} from "@/lib/savings-asset-entries";
import { savingsAssetEntryPatchSchema } from "@/lib/validations/savings";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await requireUser();
    const { id: assetId, entryId } = await params;

    const body = await req.json();
    const parsed = savingsAssetEntryPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const entry = await updateAssetEntry({
      userId: user.id,
      assetId,
      entryId,
      quantity: parsed.data.quantity,
      purchasedAt: parsed.data.purchasedAt,
      unitPrice: parsed.data.unitPrice,
      bankFeeIls: parsed.data.bankFeeIls,
      notes: parsed.data.notes,
    });
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "الكمية أكبر من الرصيد المتاح" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "UNIT_PRICE_REQUIRED") {
      return NextResponse.json(
        { error: "أدخل سعر الصرف عند البنك (₪/$)" },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const user = await requireUser();
    const { id: assetId, entryId } = await params;

    const ok = await deleteAssetEntry({ userId: user.id, assetId, entryId });
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
