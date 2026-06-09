import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { savingsAssetPatchSchema } from "@/lib/validations/savings";
import { syncAssetFromEntries } from "@/lib/savings-asset-entries";

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

    await prisma.savingsAsset.update({
      where: { id },
      data: {
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.goldKarat !== undefined ? { goldKarat: data.goldKarat } : {}),
        ...(data.priceCurrency !== undefined
          ? { priceCurrency: data.priceCurrency }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });

    const updated = await syncAssetFromEntries(id);
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
