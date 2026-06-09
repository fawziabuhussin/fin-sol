import { prisma } from "@/lib/db";
import { CategoryKind, TransactionType } from "@/generated/prisma/client";
import {
  assetMovementDescription,
  type AssetMovementKind,
} from "@/lib/asset-movement-labels";

export {
  assetMovementDescription,
  assetMovementFromEntry,
  assetMovementShortLabel,
  isAssetPurchaseDescription,
  isAssetWithdrawalDescription,
  parseAssetMovementDescription,
  type AssetMovementKind,
  type AssetMovementMeta,
  type AssetMovementType,
} from "@/lib/asset-movement-labels";

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
  kind: AssetMovementKind;
  title?: string | null;
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
      description: assetMovementDescription("PURCHASE", {
        kind: params.kind,
        title: params.title,
      }),
      notes: params.notes ?? null,
      currency: "ILS",
    },
  });
}

export async function createAssetWithdrawalTransaction(params: {
  userId: string;
  kind: AssetMovementKind;
  title?: string | null;
  amount: number;
  occurredAt: Date;
  notes?: string | null;
}) {
  const categoryId = await ensureSavingsCategoryId(params.userId);
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      type: TransactionType.INCOME,
      amount: params.amount,
      occurredAt: params.occurredAt,
      categoryId,
      description: assetMovementDescription("WITHDRAWAL", {
        kind: params.kind,
        title: params.title,
      }),
      notes: params.notes ?? null,
      currency: "ILS",
    },
  });
}
