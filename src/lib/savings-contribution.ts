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
