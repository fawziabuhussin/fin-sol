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
      quantity: parsed.data.quantity,
      purchasedAt: parsed.data.purchasedAt,
      notes: parsed.data.notes,
    });
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
