import { prisma } from "@/lib/db";
import {
  createUserProject,
  ParentProjectNotFoundError,
} from "@/lib/project-tree";
import {
  buildInstallmentSchedule,
  clampInstallmentCount,
  normalizeDownPayment,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { markInstallmentPaid } from "@/lib/installment-transactions";
import { PaymentPlanMode, ProjectStatus } from "@/generated/prisma/client";
import type { ExpenseInstallmentInput } from "@/lib/validations/payment-plan";

export const SPLIT_EXPENSES_CONTAINER_TITLE = "مصاريف مقسطة";

export class DownPaymentTooLargeError extends Error {
  constructor() {
    super("DOWN_PAYMENT_TOO_LARGE");
    this.name = "DownPaymentTooLargeError";
  }
}

async function resolveSplitParent(userId: string, parentId: string | null) {
  if (parentId) {
    const parent = await prisma.project.findFirst({
      where: { id: parentId, userId, parentProjectId: null },
      select: { id: true },
    });
    if (!parent) throw new ParentProjectNotFoundError();
    return parent.id;
  }

  const existing = await prisma.project.findFirst({
    where: {
      userId,
      parentProjectId: null,
      title: SPLIT_EXPENSES_CONTAINER_TITLE,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const master = await createUserProject(userId, {
    title: SPLIT_EXPENSES_CONTAINER_TITLE,
    description: "مصاريف يومية مقسّمة على أشهر",
    status: ProjectStatus.ACTIVE,
  });
  return master.id;
}

export async function createSplitExpense(
  userId: string,
  data: ExpenseInstallmentInput
) {
  const count = clampInstallmentCount(data.installmentCount);
  const title =
    data.description?.trim() ||
    (count > 1 ? `مصروف مقسّط (${count})` : "مصروف");
  const downPayment = normalizeDownPayment(data.downPayment);
  if (downPayment != null && downPayment >= data.amount && count > 1) {
    throw new DownPaymentTooLargeError();
  }

  const startDate = new Date(data.occurredAt);
  const containerId = await resolveSplitParent(
    userId,
    data.parentProjectId || null
  );

  const child = await createUserProject(userId, {
    title,
    description: data.description || "",
    totalBudget: data.amount,
    targetDate: data.occurredAt,
    status: ProjectStatus.ACTIVE,
    parentProjectId: containerId ?? undefined,
  });

  const mode =
    count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS;
  const recurring = recurringFromSplit(data.amount, count, downPayment);
  const schedule = buildInstallmentSchedule({
    mode,
    totalAmount: data.amount,
    installmentCount: count,
    firstPaymentAmount: downPayment,
    startDate,
  });

  const plan = await prisma.projectPaymentPlan.create({
    data: {
      userId,
      projectId: child.id,
      title,
      mode,
      totalAmount: data.amount,
      installmentCount: count,
      firstPaymentAmount: downPayment,
      recurringAmount: recurring,
      payeeName: title,
      startDate,
      paymentMethodId: data.paymentMethodId || null,
      categoryId: data.categoryId || null,
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
    await markInstallmentPaid({
      userId,
      installmentId: plan.installments[0].id,
      occurredAt: startDate,
      categoryId: data.categoryId,
      paymentMethodId: data.paymentMethodId,
    });
  }

  return {
    id: child.id,
    parentProjectId: containerId,
    planId: plan.id,
    installmentCount: count,
  };
}
