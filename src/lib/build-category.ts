import { prisma } from "@/lib/db";
import { CategoryKind } from "@/generated/prisma/client";

export const BUILD_CATEGORY = "بناء";

/**
 * Returns the id of the user's "بناء" expense category, creating it if needed.
 * Project / installment payments are tagged with this category so they are
 * counted under building outcome (مصروفات البناء) and kept separate from daily
 * expenses (coffee, groceries, ...).
 */
export async function ensureBuildCategoryId(userId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId, name: BUILD_CATEGORY },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { userId, name: BUILD_CATEGORY, kind: CategoryKind.EXPENSE },
    select: { id: true },
  });
  return created.id;
}
