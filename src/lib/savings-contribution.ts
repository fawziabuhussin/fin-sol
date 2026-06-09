import { prisma } from "@/lib/db";
import { CategoryKind, TransactionType } from "@/generated/prisma/client";

export async function ensureSavingsCategoryId(userId: string) {
  const existing = await prisma.category.findFirst({
    where: { userId, name: "ادخار", kind: CategoryKind.SAVINGS },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: {
      userId,
      name: "ادخار",
      kind: CategoryKind.SAVINGS,
      color: "#6366f1",
    },
  });
  return created.id;
}

export async function createSavingsContributionTransaction(params: {
  userId: string;
  planTitle: string;
  amount: number;
  occurredAt: Date;
  notes?: string | null;
}) {
  const categoryId = await ensureSavingsCategoryId(params.userId);
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      type: TransactionType.SAVINGS_CONTRIBUTION,
      amount: params.amount,
      occurredAt: params.occurredAt,
      categoryId,
      description: `ادخار — ${params.planTitle}`,
      notes: params.notes ?? null,
      currency: "ILS",
    },
  });
}

export async function createAssetPurchaseTransaction(params: {
  userId: string;
  kind: "GOLD" | "USD";
  amount: number;
  occurredAt: Date;
  notes?: string | null;
}) {
  const label = params.kind === "USD" ? "دولار" : "ذهب";
  const categoryId = await ensureSavingsCategoryId(params.userId);
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      type: TransactionType.SAVINGS_CONTRIBUTION,
      amount: params.amount,
      occurredAt: params.occurredAt,
      categoryId,
      description: `ادخار — ${label}`,
      notes: params.notes ?? null,
      currency: "ILS",
    },
  });
}

export function isAssetPurchaseDescription(description: string | null | undefined) {
  if (!description) return false;
  return /ادخار — (دولار|ذهب)/.test(description);
}

export async function createAssetWithdrawalTransaction(params: {
  userId: string;
  kind: "GOLD" | "USD";
  amount: number;
  occurredAt: Date;
  notes?: string | null;
}) {
  const label = params.kind === "USD" ? "دولار" : "ذهب";
  const categoryId = await ensureSavingsCategoryId(params.userId);
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      type: TransactionType.INCOME,
      amount: params.amount,
      occurredAt: params.occurredAt,
      categoryId,
      description: `سحب ادخار — ${label}`,
      notes: params.notes ?? null,
      currency: "ILS",
    },
  });
}

export function isAssetWithdrawalDescription(description: string | null | undefined) {
  if (!description) return false;
  return /سحب ادخار — (دولار|ذهب)/.test(description);
}
