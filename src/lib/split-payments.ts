import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import { InstallmentStatus, TransactionType } from "@/generated/prisma/client";
import { ensureDbSchema } from "@/lib/ensure-schema";

export function splitTransactionDescription(label: string, title: string) {
  return `${label} — ${title}`;
}

export function isoDate(d: Date | string) {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function sumPaid(
  installments: { status: string; amount: { toString(): string } }[]
) {
  return installments
    .filter((i) => i.status === InstallmentStatus.PAID)
    .reduce((sum, i) => sum + decimalToNumber(i.amount), 0);
}

const planInclude = {
  category: { select: { id: true, name: true } },
  paymentMethod: { select: { id: true, name: true } },
  installments: {
    orderBy: { sequence: "asc" as const },
    include: {
      transaction: { select: { id: true, occurredAt: true, notes: true } },
    },
  },
};

export async function listSplitPlans(userId: string) {
  await ensureDbSchema();
  const plans = await prisma.splitPaymentPlan.findMany({
    where: { userId },
    include: planInclude,
    orderBy: { createdAt: "desc" },
  });
  return plans.map(serializeSplitPlan);
}

export async function getSplitPlan(userId: string, planId: string) {
  await ensureDbSchema();
  const plan = await prisma.splitPaymentPlan.findFirst({
    where: { id: planId, userId },
    include: planInclude,
  });
  return plan ? serializeSplitPlan(plan) : null;
}

type LoadedInstallment = {
  id: string;
  sequence: number;
  label: string | null;
  dueDate: Date;
  amount: { toString(): string };
  status: string;
  notes: string | null;
  transactionId: string | null;
  transaction: { id: string; occurredAt: Date; notes: string | null } | null;
};

type LoadedPlan = {
  id: string;
  title: string;
  totalAmount: { toString(): string };
  installmentCount: number;
  firstPaymentAmount: { toString(): string } | null;
  recurringAmount: { toString(): string } | null;
  startDate: Date;
  categoryId: string | null;
  paymentMethodId: string | null;
  category: { id: string; name: string } | null;
  paymentMethod: { id: string; name: string } | null;
  installments: LoadedInstallment[];
};

export function serializeSplitPlan(plan: LoadedPlan) {
  const total = decimalToNumber(plan.totalAmount);
  const paid = sumPaid(plan.installments);
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const paidCount = plan.installments.filter(
    (i) => i.status === InstallmentStatus.PAID
  ).length;
  const next = plan.installments.find((i) => i.status === InstallmentStatus.PENDING);
  return {
    id: plan.id,
    title: plan.title,
    totalAmount: total,
    installmentCount: plan.installmentCount,
    firstPaymentAmount:
      plan.firstPaymentAmount != null
        ? decimalToNumber(plan.firstPaymentAmount)
        : null,
    recurringAmount:
      plan.recurringAmount != null ? decimalToNumber(plan.recurringAmount) : null,
    startDate: isoDate(plan.startDate),
    categoryId: plan.categoryId,
    categoryName: plan.category?.name ?? null,
    paymentMethodId: plan.paymentMethodId,
    paymentMethodName: plan.paymentMethod?.name ?? null,
    paid,
    remaining,
    percentComplete: total > 0 ? Math.round((paid / total) * 100) : 0,
    paidCount,
    pendingCount: plan.installments.length - paidCount,
    nextDue: next
      ? {
          id: next.id,
          label: next.label ?? `قسط ${next.sequence}`,
          dueDate: isoDate(next.dueDate),
          amount: decimalToNumber(next.amount),
        }
      : null,
    installments: plan.installments.map((inst) => ({
      id: inst.id,
      sequence: inst.sequence,
      label: inst.label ?? `قسط ${inst.sequence}`,
      dueDate: isoDate(inst.dueDate),
      amount: decimalToNumber(inst.amount),
      status: inst.status,
      notes: inst.notes,
      paidAt: inst.transaction?.occurredAt
        ? isoDate(inst.transaction.occurredAt)
        : null,
      transactionId: inst.transactionId,
    })),
  };
}

export type SplitPlanView = ReturnType<typeof serializeSplitPlan>;

export async function markSplitInstallmentPaid(params: {
  userId: string;
  installmentId: string;
  occurredAt?: Date;
  notes?: string | null;
}) {
  await ensureDbSchema();
  const installment = await prisma.splitPaymentInstallment.findFirst({
    where: { id: params.installmentId, plan: { userId: params.userId } },
    include: { plan: true },
  });
  if (!installment || installment.status === InstallmentStatus.PAID) {
    return null;
  }

  const occurredAt = params.occurredAt ?? installment.dueDate;
  const label = installment.label ?? `قسط ${installment.sequence}`;
  const description = splitTransactionDescription(label, installment.plan.title);

  const tx = await prisma.transaction.create({
    data: {
      userId: params.userId,
      categoryId: installment.plan.categoryId,
      paymentMethodId: installment.plan.paymentMethodId,
      type: TransactionType.EXPENSE,
      amount: installment.amount,
      occurredAt,
      description,
      notes: params.notes ?? null,
    },
  });

  const updated = await prisma.splitPaymentInstallment.update({
    where: { id: installment.id },
    data: {
      status: InstallmentStatus.PAID,
      transactionId: tx.id,
    },
  });

  return { installment: updated, transaction: tx };
}

export async function unpaySplitInstallment(installment: {
  id: string;
  transactionId: string | null;
}) {
  if (installment.transactionId) {
    await prisma.transaction
      .delete({ where: { id: installment.transactionId } })
      .catch(() => null);
  }
  return prisma.splitPaymentInstallment.update({
    where: { id: installment.id },
    data: {
      status: InstallmentStatus.PENDING,
      transactionId: null,
    },
  });
}

export async function syncSplitInstallmentTransaction(
  installment: {
    id: string;
    sequence: number;
    label: string | null;
    amount: { toString(): string };
    status: string;
    transactionId: string | null;
    dueDate: Date;
    plan: { title: string };
  },
  updates: {
    amount?: number;
    dueDate?: Date;
    label?: string | null;
    notes?: string | null;
    occurredAt?: Date;
  }
) {
  if (installment.status !== InstallmentStatus.PAID || !installment.transactionId) {
    return;
  }

  const label =
    updates.label ?? installment.label ?? `قسط ${installment.sequence}`;
  const amount =
    updates.amount !== undefined
      ? updates.amount
      : decimalToNumber(installment.amount);
  const occurredAt =
    updates.occurredAt ?? updates.dueDate ?? installment.dueDate;

  await prisma.transaction.update({
    where: { id: installment.transactionId },
    data: {
      amount,
      occurredAt,
      description: splitTransactionDescription(label, installment.plan.title),
      ...(updates.notes !== undefined ? { notes: updates.notes || null } : {}),
    },
  });
}
