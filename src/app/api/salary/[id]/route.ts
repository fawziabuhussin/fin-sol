import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const slip = await prisma.salarySlip.findFirst({
      where: { id, userId: user.id },
    });
    if (!slip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.salarySlip.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
