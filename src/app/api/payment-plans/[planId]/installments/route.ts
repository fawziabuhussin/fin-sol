import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { installmentCreateSchema } from "@/lib/validations/payment-plan";
import { InstallmentStatus } from "@/generated/prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const user = await requireUser();
    const { planId } = await params;
    const plan = await prisma.projectPaymentPlan.findFirst({
      where: { id: planId, userId: user.id },
      include: { installments: { orderBy: { sequence: "desc" }, take: 1 } },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = installmentCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const nextSeq = (plan.installments[0]?.sequence ?? 0) + 1;

    const created = await prisma.projectInstallment.create({
      data: {
        planId,
        sequence: nextSeq,
        label: d.label || `الدفعة ${nextSeq}`,
        dueDate: new Date(d.dueDate),
        amount: d.amount,
        status: InstallmentStatus.PENDING,
        notes: d.notes || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
