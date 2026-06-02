import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { ensureBuildCategoryId } from "@/lib/build-category";
import {
  installmentTransactionDescription,
  repairPaidInstallmentTransactions,
} from "@/lib/installment-transactions";
import { decimalToNumber } from "@/lib/utils";
import { InstallmentStatus, TransactionType } from "@/generated/prisma/client";

function normalizeDescription(description: string | null): string {
  if (!description) return "";
  return description
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[–—−]/g, "—");
}

function groupKey(projectId: string, description: string | null, amount: number) {
  return `${projectId}|${normalizeDescription(description)}|${amount.toFixed(2)}`;
}

function occurredAtScore(d: Date): number {
  const y = d.getUTCFullYear();
  if (y < 2010) return -1_000_000;
  return d.getTime();
}

type TxRow = {
  id: string;
  projectId: string | null;
  categoryId: string | null;
  amount: { toString(): string };
  description: string | null;
  occurredAt: Date;
  createdAt: Date;
};

function pickKeeper(
  group: TxRow[],
  installmentTxIds: Set<string>,
  buildCategoryId: string | null
): TxRow {
  const ranked = [...group].sort((a, b) => {
    const score = (tx: TxRow) => {
      let s = 0;
      if (installmentTxIds.has(tx.id)) s += 10_000;
      if (buildCategoryId && tx.categoryId === buildCategoryId) s += 100;
      s += occurredAtScore(tx.occurredAt) / 1_000_000;
      s += tx.createdAt.getTime() / 1e15;
      return s;
    };
    return score(b) - score(a);
  });
  return ranked[0]!;
}

/**
 * Remove duplicate building expenses created by payment-plan / installment flows.
 * Only touches EXPENSE rows tied to a project (not salary-linked income, etc.).
 */
export async function dedupePlanBuildingExpensesForUser(
  userId: string,
  client: PrismaClient = defaultPrisma,
  options?: { dryRun?: boolean; projectId?: string }
) {
  const dryRun = options?.dryRun ?? false;
  const buildCategoryId = await ensureBuildCategoryId(userId);

  const plans = await client.projectPaymentPlan.findMany({
    where: {
      userId,
      ...(options?.projectId ? { projectId: options.projectId } : {}),
    },
    include: {
      project: { select: { id: true, title: true } },
      installments: true,
    },
  });

  const projectIds = new Set(plans.map((p) => p.projectId));
  const installmentTxIds = new Set<string>();
  const expectedKeys = new Set<string>();

  for (const plan of plans) {
    for (const inst of plan.installments) {
      if (inst.transactionId) installmentTxIds.add(inst.transactionId);
      const label = inst.label ?? `الدفعة ${inst.sequence}`;
      const description = installmentTransactionDescription(
        label,
        plan.payeeName,
        plan.project.title
      );
      expectedKeys.add(
        groupKey(plan.projectId, description, decimalToNumber(inst.amount))
      );
    }
  }

  if (projectIds.size === 0) {
    return { deleted: 0, relinked: 0, groups: 0, dryRun };
  }

  const candidates = await client.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      projectId: { in: [...projectIds] },
      salarySlipId: null,
    },
    orderBy: { occurredAt: "desc" },
  });

  const planRelated = candidates.filter((tx) => {
    if (!tx.projectId) return false;
    if (installmentTxIds.has(tx.id)) return true;
    if (tx.categoryId === buildCategoryId) return true;
    const key = groupKey(
      tx.projectId,
      tx.description,
      decimalToNumber(tx.amount)
    );
    return expectedKeys.has(key);
  });

  const byGroup = new Map<string, TxRow[]>();
  for (const tx of planRelated) {
    if (!tx.projectId) continue;
    const key = groupKey(
      tx.projectId,
      tx.description,
      decimalToNumber(tx.amount)
    );
    const list = byGroup.get(key) ?? [];
    list.push(tx);
    byGroup.set(key, list);
  }

  let deleted = 0;
  let relinked = 0;
  let groups = 0;

  for (const [, group] of byGroup) {
    if (group.length < 2) continue;
    groups += 1;

    const keeper = pickKeeper(group, installmentTxIds, buildCategoryId);
    const dupes = group.filter((tx) => tx.id !== keeper.id);

    const installmentsOnDupes = await client.projectInstallment.findMany({
      where: { transactionId: { in: dupes.map((d) => d.id) } },
    });

    for (const inst of installmentsOnDupes) {
      relinked += 1;
      if (!dryRun) {
        await client.projectInstallment.update({
          where: { id: inst.id },
          data: { transactionId: keeper.id },
        });
        installmentTxIds.add(keeper.id);
      }
    }

    const keeperLinked = await client.projectInstallment.findFirst({
      where: { transactionId: keeper.id },
    });
    if (!keeperLinked) {
      const keeperAmount = decimalToNumber(keeper.amount);
      const paidNeedingLink = await client.projectInstallment.findFirst({
        where: {
          status: InstallmentStatus.PAID,
          transactionId: null,
          plan: { userId, projectId: keeper.projectId! },
          amount: keeperAmount,
        },
      });
      if (paidNeedingLink && !dryRun) {
        await client.projectInstallment.update({
          where: { id: paidNeedingLink.id },
          data: { transactionId: keeper.id },
        });
        relinked += 1;
        installmentTxIds.add(keeper.id);
      }
    }

    for (const dup of dupes) {
      if (installmentTxIds.has(dup.id)) {
        const stillLinked = await client.projectInstallment.count({
          where: { transactionId: dup.id },
        });
        if (stillLinked > 0) continue;
      }
      deleted += 1;
      if (!dryRun) {
        await client.transaction.delete({ where: { id: dup.id } }).catch(() => null);
        installmentTxIds.delete(dup.id);
      }
    }
  }

  if (!dryRun) {
    for (const plan of plans) {
      await repairPaidInstallmentTransactions(userId, {
        id: plan.id,
        projectId: plan.projectId,
        payeeName: plan.payeeName,
        paymentMethodId: plan.paymentMethodId,
        project: { title: plan.project.title },
        installments: plan.installments,
      });
    }
  }

  return { deleted, relinked, groups, dryRun };
}

export async function dedupePlanBuildingExpensesAllUsers(
  client: PrismaClient = defaultPrisma,
  options?: { dryRun?: boolean }
) {
  const users = await client.user.findMany({ select: { id: true, email: true } });
  const results: { email: string | null; deleted: number; groups: number }[] = [];
  for (const user of users) {
    const r = await dedupePlanBuildingExpensesForUser(user.id, client, options);
    if (r.deleted > 0 || r.groups > 0) {
      results.push({
        email: user.email,
        deleted: r.deleted,
        groups: r.groups,
      });
    }
  }
  return results;
}
