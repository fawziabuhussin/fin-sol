import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { planEditSchema } from "@/lib/validations/payment-plan";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const user = await requireUser();
    const { planId } = await params;
    const plan = await prisma.projectPaymentPlan.findFirst({
      where: { id: planId, userId: user.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = planEditSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const updated = await prisma.projectPaymentPlan.update({
      where: { id: planId },
      data: {
        ...(d.payeeName !== undefined ? { payeeName: d.payeeName || null } : {}),
        ...(d.paymentMethodId !== undefined
          ? { paymentMethodId: d.paymentMethodId || null }
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
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const user = await requireUser();
    const { planId } = await params;
    const plan = await prisma.projectPaymentPlan.findFirst({
      where: { id: planId, userId: user.id },
      include: { installments: { select: { transactionId: true } } },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Remove the building-outcome transactions tied to paid installments
    const txIds = plan.installments
      .map((i) => i.transactionId)
      .filter((x): x is string => Boolean(x));
    if (txIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });
    }

    // Cascade deletes the installments
    await prisma.projectPaymentPlan.delete({ where: { id: planId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
