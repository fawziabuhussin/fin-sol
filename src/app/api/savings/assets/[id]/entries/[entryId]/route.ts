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
      ...parsed.data,
    });
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
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
