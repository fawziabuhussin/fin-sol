import { prisma } from "@/lib/db";
import {
  buildInstallmentSchedule,
  clampInstallmentCount,
  normalizeDownPayment,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { markSplitInstallmentPaid } from "@/lib/split-payments";
import { PaymentPlanMode } from "@/generated/prisma/client";
import type { ExpenseInstallmentInput } from "@/lib/validations/payment-plan";
import { ensureDbSchema } from "@/lib/ensure-schema";

/** Leftover container from when splits were stored as projects. */
export const SPLIT_EXPENSES_CONTAINER_TITLE = "مصاريف مقسطة";

export class DownPaymentTooLargeError extends Error {
  constructor() {
    super("DOWN_PAYMENT_TOO_LARGE");
    this.name = "DownPaymentTooLargeError";
  }
}

export async function createSplitExpense(
  userId: string,
  data: ExpenseInstallmentInput
) {
  await ensureDbSchema();
  const count = clampInstallmentCount(data.installmentCount);
  const title =
    data.description?.trim() ||
    (count > 1 ? `مصروف مقسّط (${count})` : "مصروف");
  const downPayment = normalizeDownPayment(data.downPayment);
  if (downPayment != null && downPayment >= data.amount && count > 1) {
    throw new DownPaymentTooLargeError();
  }

  const startDate = new Date(data.occurredAt);
  const recurring = recurringFromSplit(data.amount, count, downPayment);
  const schedule = buildInstallmentSchedule({
    mode: count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS,
    totalAmount: data.amount,
    installmentCount: count,
    firstPaymentAmount: downPayment,
    startDate,
  });

  const plan = await prisma.splitPaymentPlan.create({
    data: {
      userId,
      title,
      totalAmount: data.amount,
      installmentCount: count,
      firstPaymentAmount: downPayment,
      recurringAmount: recurring,
      categoryId: data.categoryId || null,
      paymentMethodId: data.paymentMethodId || null,
      startDate,
      installments: {
        create: schedule.map((s) => ({
          sequence: s.sequence,
          label: s.label,
          dueDate: s.dueDate,
          amount: s.amount,
          status: s.status,
        })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  if (data.payDownPaymentNow && plan.installments[0]) {
    await markSplitInstallmentPaid({
      userId,
      installmentId: plan.installments[0].id,
      occurredAt: startDate,
    });
  }

  return {
    id: plan.id,
    planId: plan.id,
    installmentCount: count,
  };
}
