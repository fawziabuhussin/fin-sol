import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import { TransactionType } from "@/generated/prisma/client";

const SUBSCRIPTION_NOTE_PREFIX = "اشتراك شهري —";
const DEFAULT_START_YEAR = 2026;
const DEFAULT_THROUGH_MONTH = 5;

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[.,()+\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountsMatch(a: number, b: number, tolerance = 2.5) {
  return Math.abs(a - b) <= tolerance;
}

function descriptionTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function descriptionsMatch(subscriptionTitle: string, importDescription: string | null) {
  const sub = normalizeText(subscriptionTitle);
  const imp = normalizeText(importDescription);
  if (!sub || !imp) return false;
  if (sub === imp || imp.includes(sub) || sub.includes(imp)) return true;

  const subTokens = descriptionTokens(subscriptionTitle);
  const impTokens = new Set(descriptionTokens(importDescription ?? ""));
  if (subTokens.some((token) => impTokens.has(token))) return true;

  const aliases: [string, string[]][] = [
    ["github", ["github"]],
    ["google youtube", ["google youtube", "youtube prem", "youtube"]],
    ["chatgpt", ["chatgpt", "openai"]],
    ["icloud", ["icloud", "apple.com bill", "apple com bill"]],
    ["google drive", ["google drive", "google one"]],
    ["vercel", ["vercel"]],
    ["overleaf", ["overleaf"]],
    ["פלאפון", ["פלאפון", "pelephone"]],
    ["claude", ["claude", "anthropic"]],
    ["shadi fitness", ["shadi fitness"]],
    ["סנابل", ["סנבל", "sanabel"]],
  ];

  for (const [key, values] of aliases) {
    const subHit = sub.includes(key) || values.some((v) => sub.includes(v));
    const impHit = imp.includes(key) || values.some((v) => imp.includes(v));
    if (subHit && impHit) return true;
  }

  return false;
}

function isSubscriptionGeneratedTx(notes: string | null) {
  return notes?.startsWith(SUBSCRIPTION_NOTE_PREFIX) ?? false;
}

function inPeriod(d: Date, year: number, month: number) {
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
}

type DedupeAction = {
  subscriptionId: string;
  subscriptionTitle: string;
  periodYear: number;
  periodMonth: number;
  removedTransactionId: string;
  keptTransactionId: string;
  removedAmount: number;
  keptDescription: string | null;
};

export async function dedupeSubscriptionExpensesForUser(
  userId: string,
  client: PrismaClient = defaultPrisma,
  options?: {
    dryRun?: boolean;
    startYear?: number;
    throughMonth?: number;
  }
) {
  const dryRun = options?.dryRun ?? false;
  const startYear = options?.startYear ?? DEFAULT_START_YEAR;
  const throughMonth = options?.throughMonth ?? DEFAULT_THROUGH_MONTH;

  const payments = await client.subscriptionPayment.findMany({
    where: {
      paid: true,
      transactionId: { not: null },
      periodYear: startYear,
      periodMonth: { lte: throughMonth },
      subscription: { userId },
    },
    include: {
      subscription: { select: { id: true, title: true } },
      transaction: true,
    },
  });

  const linkedTxIds = new Set(
    payments.map((p) => p.transactionId).filter((id): id is string => Boolean(id))
  );

  const candidateImports = await client.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: {
        gte: new Date(Date.UTC(startYear, 0, 1)),
        lt: new Date(Date.UTC(startYear, throughMonth, 1)),
      },
      projectId: null,
      salarySlipId: null,
      installment: null,
    },
    select: {
      id: true,
      amount: true,
      description: true,
      notes: true,
      occurredAt: true,
      paymentMethodId: true,
    },
  });

  const actions: DedupeAction[] = [];

  for (const payment of payments) {
    const subTx = payment.transaction;
    if (!subTx || !payment.transactionId) continue;
    if (!isSubscriptionGeneratedTx(subTx.notes)) continue;

    const subAmount = decimalToNumber(subTx.amount);
    const keeper = candidateImports.find((tx) => {
      if (tx.id === subTx.id) return false;
      if (linkedTxIds.has(tx.id)) return false;
      if (isSubscriptionGeneratedTx(tx.notes)) return false;
      if (!inPeriod(tx.occurredAt, payment.periodYear, payment.periodMonth)) return false;
      if (!amountsMatch(subAmount, decimalToNumber(tx.amount))) return false;
      return descriptionsMatch(payment.subscription.title, tx.description);
    });

    if (!keeper) continue;

    actions.push({
      subscriptionId: payment.subscription.id,
      subscriptionTitle: payment.subscription.title,
      periodYear: payment.periodYear,
      periodMonth: payment.periodMonth,
      removedTransactionId: subTx.id,
      keptTransactionId: keeper.id,
      removedAmount: subAmount,
      keptDescription: keeper.description,
    });
  }

  if (!dryRun) {
    for (const action of actions) {
      await client.$transaction(async (tx) => {
        await tx.subscriptionPayment.update({
          where: {
            subscriptionId_periodYear_periodMonth: {
              subscriptionId: action.subscriptionId,
              periodYear: action.periodYear,
              periodMonth: action.periodMonth,
            },
          },
          data: { transactionId: action.keptTransactionId },
        });
        await tx.transaction.delete({ where: { id: action.removedTransactionId } });
      });
      linkedTxIds.delete(action.removedTransactionId);
      linkedTxIds.add(action.keptTransactionId);
    }
  }

  return {
    scannedPayments: payments.length,
    removed: actions.length,
    actions,
  };
}

export async function dedupeSubscriptionExpensesAllUsers(
  client: PrismaClient = defaultPrisma,
  options?: {
    dryRun?: boolean;
    startYear?: number;
    throughMonth?: number;
  }
) {
  const users = await client.user.findMany({ select: { id: true, email: true } });
  const results: Record<string, Awaited<ReturnType<typeof dedupeSubscriptionExpensesForUser>>> = {};
  for (const user of users) {
    results[user.email ?? user.id] = await dedupeSubscriptionExpensesForUser(
      user.id,
      client,
      options
    );
  }
  return results;
}
