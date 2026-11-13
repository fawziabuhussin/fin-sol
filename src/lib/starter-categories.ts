import type { PrismaClient } from "@/generated/prisma/client";
import { CategoryKind } from "@/generated/prisma/client";
import { EXPENSE_CATEGORY_NAMES } from "@/lib/expense-categories";
import { getExpenseGroup, groupIdFromCategoryName } from "@/lib/expense-category-groups";

/**
 * A sensible, generic starting set for brand-new accounts so Quick Add and the
 * category dashboard are useful from the first minute. Names match the ones
 * the app's `ensure*CategoryId` helpers look up ("دخل", "ادخار", "اشتراكات").
 */
export async function createStarterCategories(userId: string, db: PrismaClient) {
  let sortOrder = 1;
  const expense = EXPENSE_CATEGORY_NAMES.map((name) => ({
    userId,
    name,
    kind: CategoryKind.EXPENSE,
    color: getExpenseGroup(groupIdFromCategoryName(name)).color,
    sortOrder: sortOrder++,
  }));
  const other = [
    { userId, name: "دخل", kind: CategoryKind.INCOME, color: "#059669", sortOrder: sortOrder++ },
    { userId, name: "دخل إضافي", kind: CategoryKind.INCOME, color: "#10b981", sortOrder: sortOrder++ },
    { userId, name: "ادخار", kind: CategoryKind.SAVINGS, color: "#6366f1", sortOrder: sortOrder++ },
  ];
  await db.category.createMany({ data: [...expense, ...other], skipDuplicates: true });
}
