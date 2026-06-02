import { prisma } from "@/lib/db";
import { ensureBuildCategoryId } from "@/lib/build-category";
import { decimalToNumber } from "@/lib/utils";
import { InstallmentStatus, TransactionType } from "@/generated/prisma/client";

export function installmentTransactionDescription(
  label: string,
  payeeName: string | null,
  projectTitle: string
) {
  return `${label} — ${payeeName ?? projectTitle}`;
}

export function sumPaidInstallments(
  installments: { status: string; amount: { toString(): string } }[]
) {
  return installments
    .filter((i) => i.status === InstallmentStatus.PAID)
    .reduce((sum, i) => sum + decimalToNumber(i.amount), 0);
}

type InstallmentWithPlan = {
  id: string;
  sequence: number;
  label: string | null;
  amount: { toString(): string };
  status: string;
  transactionId: string | null;
  dueDate: Date;
  plan: {
    projectId: string;
    payeeName: string | null;
    paymentMethodId: string | null;
    project: { title: string };
  };
};

/** Sync linked expense row when a paid installment is edited. */
export async function syncLinkedInstallmentTransaction(
  installment: InstallmentWithPlan,
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
    updates.label ?? installment.label ?? `الدفعة ${installment.sequence}`;
  const amount =
    updates.amount !== undefined
      ? updates.amount
      : decimalToNumber(installment.amount);
  const occurredAt =
    updates.occurredAt ??
    updates.dueDate ??
    installment.dueDate;

  const description = installmentTransactionDescription(
    label,
    installment.plan.payeeName,
    installment.plan.project.title
  );

  await prisma.transaction.update({
    where: { id: installment.transactionId },
    data: {
      amount,
      occurredAt,
      description,
      ...(updates.notes !== undefined ? { notes: updates.notes || null } : {}),
    },
  });
}

/** Link paid installments to building expenses; reuse existing rows to avoid duplicates. */
export async function repairPaidInstallmentTransactions(
  userId: string,
  plan: {
    id: string;
    projectId: string;
    payeeName: string | null;
    paymentMethodId: string | null;
    project: { title: string };
    installments: {
      id: string;
      sequence: number;
      label: string | null;
      amount: { toString(): string };
      status: string;
      transactionId: string | null;
      dueDate: Date;
    }[];
  }
) {
  const categoryId = await ensureBuildCategoryId(userId);

  for (const inst of plan.installments) {
    if (inst.status !== InstallmentStatus.PAID) continue;

    const label = inst.label ?? `الدفعة ${inst.sequence}`;
    const description = installmentTransactionDescription(
      label,
      plan.payeeName,
      plan.project.title
    );
    const amount = decimalToNumber(inst.amount);

    if (inst.transactionId) {
      const linked = await prisma.transaction.findUnique({
        where: { id: inst.transactionId },
      });
      if (linked) continue;
    }

    const linkedElsewhere = await prisma.projectInstallment.findMany({
      where: {
        plan: { userId, projectId: plan.projectId },
        transactionId: { not: null },
      },
      select: { transactionId: true },
    });
    const usedTxIds = new Set(
      linkedElsewhere.map((i) => i.transactionId).filter(Boolean) as string[]
    );

    const candidates = await prisma.transaction.findMany({
      where: {
        userId,
        projectId: plan.projectId,
        type: TransactionType.EXPENSE,
        description,
      },
      orderBy: { occurredAt: "desc" },
    });

    const available = candidates.filter((c) => !usedTxIds.has(c.id));
    const match =
      available.find((c) => decimalToNumber(c.amount) === amount) ??
      available[0];

    if (match) {
      await prisma.projectInstallment.update({
        where: { id: inst.id },
        data: { transactionId: match.id },
      });
      for (const dup of available) {
        if (dup.id !== match.id) {
          await prisma.transaction.delete({ where: { id: dup.id } }).catch(() => null);
        }
      }
      continue;
    }

    const tx = await prisma.transaction.create({
      data: {
        userId,
        projectId: plan.projectId,
        categoryId,
        paymentMethodId: plan.paymentMethodId,
        type: TransactionType.EXPENSE,
        amount,
        occurredAt: inst.dueDate,
        description,
      },
    });
    await prisma.projectInstallment.update({
      where: { id: inst.id },
      data: { transactionId: tx.id },
    });
  }
}
