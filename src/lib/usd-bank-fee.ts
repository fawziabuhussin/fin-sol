import { prisma } from "@/lib/db";
import { CategoryKind, TransactionType } from "@/generated/prisma/client";

export const BANK_FEE_CATEGORY = "رسوم بنكية";

export async function ensureBankFeeCategoryId(userId: string) {
  const existing = await prisma.category.findFirst({
    where: { userId, name: BANK_FEE_CATEGORY, kind: CategoryKind.EXPENSE },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: {
      userId,
      name: BANK_FEE_CATEGORY,
      kind: CategoryKind.EXPENSE,
      color: "#64748b",
    },
  });
  return created.id;
}

export async function upsertUsdBankFeeTransaction(params: {
  userId: string;
  amount: number;
  occurredAt: Date;
  dollarQuantity?: number;
  existingTransactionId?: string | null;
}) {
  if (params.amount <= 0) {
    if (params.existingTransactionId) {
      await prisma.transaction
        .delete({ where: { id: params.existingTransactionId } })
        .catch(() => null);
    }
    return null;
  }

  const categoryId = await ensureBankFeeCategoryId(params.userId);
  const description = params.dollarQuantity
    ? `رسوم بنك — شراء ${params.dollarQuantity} $`
    : "رسوم بنك — شراء دولار";

  if (params.existingTransactionId) {
    await prisma.transaction.update({
      where: { id: params.existingTransactionId },
      data: {
        amount: params.amount,
        occurredAt: params.occurredAt,
        description,
      },
    });
    return params.existingTransactionId;
  }

  const tx = await prisma.transaction.create({
    data: {
      userId: params.userId,
      type: TransactionType.EXPENSE,
      amount: params.amount,
      occurredAt: params.occurredAt,
      categoryId,
      description,
      currency: "ILS",
    },
  });
  return tx.id;
}
