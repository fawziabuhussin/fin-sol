import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { employerSchema } from "@/lib/validations/salary";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.employer.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = employerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const updated = await prisma.employer.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.role !== undefined ? { role: d.role || null } : {}),
        ...(d.color !== undefined ? { color: d.color || null } : {}),
        ...(d.startDate !== undefined
          ? { startDate: d.startDate ? new Date(d.startDate) : null }
          : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
        ...(d.baseGross !== undefined ? { baseGross: d.baseGross } : {}),
        ...(d.baseNet !== undefined ? { baseNet: d.baseNet } : {}),
        ...(d.baseTax !== undefined ? { baseTax: d.baseTax } : {}),
        ...(d.basePension !== undefined ? { basePension: d.basePension } : {}),
        ...(d.baseKeren !== undefined ? { baseKeren: d.baseKeren } : {}),
        ...(d.baseFees !== undefined ? { baseFees: d.baseFees } : {}),
        ...(d.baseBonus !== undefined ? { baseBonus: d.baseBonus } : {}),
        ...(d.baseSlipBreakdown !== undefined
          ? { baseSlipBreakdown: d.baseSlipBreakdown ?? null }
          : {}),
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
    const existing = await prisma.employer.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.employer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
