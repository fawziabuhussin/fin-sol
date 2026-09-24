import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { planEditSchema } from "@/lib/validations/payment-plan";
import {
  amountsBySequence,
  clampInstallmentCount,
  DOWN_PAYMENT_LABEL,
  dueDateForSequence,
  installmentLabel,
  normalizeDownPayment,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { syncProjectStatusAfterFinancialChange } from "@/lib/project-completion";
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
    const firstPaymentAmount =
      d.firstPaymentAmount !== undefined
        ? normalizeDownPayment(d.firstPaymentAmount)
        : normalizeDownPayment(
            plan.firstPaymentAmount != null
              ? Number(plan.firstPaymentAmount)
              : null
          );
    const installmentCount =
      mode === PaymentPlanMode.FULL
        ? 1
        : clampInstallmentCount(d.installmentCount ?? plan.installmentCount ?? 1);
    const startDate = d.startDate
      ? new Date(d.startDate)
      : plan.startDate ?? new Date();

    const paid = plan.installments.filter(
      (i) => i.status === InstallmentStatus.PAID
    );
    if (installmentCount < paid.length) {
      return NextResponse.json(
        { error: "لا يمكن تقليل عدد الأقساط عن الدفعات المدفوعة" },
        { status: 400 }
      );
    }

    const recurring =
      mode === PaymentPlanMode.INSTALLMENTS
        ? recurringFromSplit(totalAmount, installmentCount, firstPaymentAmount)
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
          ...(d.title !== undefined ? { title: d.title || null } : {}),
          ...(d.payeeName !== undefined ? { payeeName: d.payeeName || null } : {}),
          ...(d.paymentMethodId !== undefined
            ? { paymentMethodId: d.paymentMethodId || null }
            : {}),
          ...(d.startDate !== undefined ? { startDate } : {}),
          ...(d.mode !== undefined ? { mode } : {}),
          ...(d.totalAmount !== undefined ? { totalAmount } : {}),
          installmentCount,
          firstPaymentAmount,
          recurringAmount: recurring,
        },
      });

      if (startChanged || amountsChanged) {
        const pending = plan.installments.filter(
          (i) => i.status === InstallmentStatus.PENDING
        );
        const amountMap =
          mode === PaymentPlanMode.INSTALLMENTS
            ? amountsBySequence(totalAmount, firstPaymentAmount, installmentCount)
            : new Map([[1, totalAmount]]);
        const explicitDown = firstPaymentAmount != null;

        const toDelete = pending.filter((i) => i.sequence > installmentCount);
        if (toDelete.length > 0) {
          await tx.projectInstallment.deleteMany({
            where: { id: { in: toDelete.map((i) => i.id) } },
          });
        }

        const keepPending = pending.filter((i) => i.sequence <= installmentCount);
        for (const inst of keepPending) {
          const data: { dueDate?: Date; amount?: number; label?: string } = {};
          if (startChanged) {
            data.dueDate = dueDateForSequence(startDate, inst.sequence);
          }
          if (amountsChanged) {
            const amt = amountMap.get(inst.sequence);
            if (amt != null) data.amount = amt;
            if (inst.sequence === 1) {
              data.label = explicitDown
                ? DOWN_PAYMENT_LABEL
                : installmentLabel(1);
            }
          }
          if (Object.keys(data).length > 0) {
            await tx.projectInstallment.update({
              where: { id: inst.id },
              data,
            });
          }
        }

        const remainingSeqs = new Set([
          ...paid.map((i) => i.sequence),
          ...keepPending.map((i) => i.sequence),
        ]);
        for (let seq = 1; seq <= installmentCount; seq++) {
          if (remainingSeqs.has(seq)) continue;
          await tx.projectInstallment.create({
            data: {
              planId,
              sequence: seq,
              label:
                seq === 1 && explicitDown
                  ? DOWN_PAYMENT_LABEL
                  : installmentLabel(seq),
              dueDate: dueDateForSequence(startDate, seq),
              amount: amountMap.get(seq) ?? 0,
              status: InstallmentStatus.PENDING,
            },
          });
        }
      }

      await tx.project.update({
        where: { id: plan.projectId },
        data: { totalBudget: totalAmount },
      });

      return updatedPlan;
    });

    if (d.totalAmount !== undefined) {
      await syncProjectStatusAfterFinancialChange(plan.projectId, prisma, {
        totalBudget: totalAmount,
      });
    }

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
