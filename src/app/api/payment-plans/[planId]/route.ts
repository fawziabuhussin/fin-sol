import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { planEditSchema } from "@/lib/validations/payment-plan";
import {
  amountsBySequence,
  dueDateForSequence,
} from "@/lib/payment-plan";
import { InstallmentStatus, PaymentPlanMode } from "@/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const user = await requireUser();
    const { planId } = await params;
    const plan = await prisma.projectPaymentPlan.findFirst({
      where: { id: planId, userId: user.id },
      include: {
        installments: { orderBy: { sequence: "asc" } },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = planEditSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const mode = (d.mode ?? plan.mode) as PaymentPlanMode;
    const totalAmount = d.totalAmount ?? Number(plan.totalAmount);
    const installmentCount = d.installmentCount ?? plan.installmentCount ?? 2;
    const firstPaymentAmount =
      d.firstPaymentAmount ?? Number(plan.firstPaymentAmount ?? 0);
    const startDate = d.startDate
      ? new Date(d.startDate)
      : plan.startDate ?? new Date();

    const recurring =
      mode === PaymentPlanMode.INSTALLMENTS && installmentCount > 1
        ? Math.round(
            ((totalAmount - firstPaymentAmount) / (installmentCount - 1)) * 100
          ) / 100
        : null;

    const startChanged =
      d.startDate !== undefined &&
      plan.startDate?.toISOString().slice(0, 10) !== d.startDate;
    const amountsChanged =
      d.totalAmount !== undefined ||
      d.firstPaymentAmount !== undefined ||
      d.installmentCount !== undefined ||
      d.mode !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.projectPaymentPlan.update({
        where: { id: planId },
        data: {
          ...(d.payeeName !== undefined ? { payeeName: d.payeeName || null } : {}),
          ...(d.paymentMethodId !== undefined
            ? { paymentMethodId: d.paymentMethodId || null }
            : {}),
          ...(d.startDate !== undefined ? { startDate } : {}),
          ...(d.mode !== undefined ? { mode } : {}),
          ...(d.totalAmount !== undefined ? { totalAmount } : {}),
          ...(d.installmentCount !== undefined ? { installmentCount } : {}),
          ...(d.firstPaymentAmount !== undefined ? { firstPaymentAmount } : {}),
          recurringAmount: recurring,
        },
      });

      const pending = plan.installments.filter(
        (i) => i.status === InstallmentStatus.PENDING
      );

      if (pending.length > 0 && (startChanged || amountsChanged)) {
        const amountMap =
          mode === PaymentPlanMode.INSTALLMENTS
            ? amountsBySequence(totalAmount, firstPaymentAmount, installmentCount)
            : new Map([[1, totalAmount]]);

        for (const inst of pending) {
          const data: { dueDate?: Date; amount?: number } = {};
          if (startChanged) {
            data.dueDate = dueDateForSequence(startDate, inst.sequence);
          }
          if (amountsChanged) {
            const amt = amountMap.get(inst.sequence);
            if (amt != null) data.amount = amt;
          }
          if (Object.keys(data).length > 0) {
            await tx.projectInstallment.update({
              where: { id: inst.id },
              data,
            });
          }
        }
      }

      return updatedPlan;
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

    const txIds = plan.installments
      .map((i) => i.transactionId)
      .filter((x): x is string => Boolean(x));
    if (txIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });
    }

    await prisma.projectPaymentPlan.delete({ where: { id: planId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
