import { prisma } from "@/lib/db";
import { CategoryKind } from "@/generated/prisma/client";

export const SUBSCRIPTION_CATEGORY = "اشتراكات";

export async function ensureSubscriptionCategoryId(userId: string) {
  const existing = await prisma.category.findFirst({
    where: { userId, name: SUBSCRIPTION_CATEGORY, kind: CategoryKind.EXPENSE },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: {
      userId,
      name: SUBSCRIPTION_CATEGORY,
      kind: CategoryKind.EXPENSE,
      color: "#8b5cf6",
    },
  });
  return created.id;
}
