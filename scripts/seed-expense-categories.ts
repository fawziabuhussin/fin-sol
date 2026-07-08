/**
 * Ensure expanded expense categories exist for the user.
 * Usage: npx tsx scripts/seed-expense-categories.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { CategoryKind, PrismaClient } from "../src/generated/prisma/client";
import { EXPENSE_CATEGORY_NAMES } from "../src/lib/expense-categories";
import { groupIdFromCategoryName, getExpenseGroup } from "../src/lib/expense-category-groups";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const existing = await prisma.category.findMany({
    where: { userId: user.id, kind: CategoryKind.EXPENSE },
  });
  const names = new Set(existing.map((c) => c.name));

  let created = 0;
  let sortOrder =
    Math.max(0, ...existing.map((c) => c.sortOrder)) + 1;

  for (const name of EXPENSE_CATEGORY_NAMES) {
    const color = getExpenseGroup(groupIdFromCategoryName(name)).color;
    const existingCat = existing.find((c) => c.name === name);
    if (existingCat) {
      if (!existingCat.color) {
        await prisma.category.update({
          where: { id: existingCat.id },
          data: { color },
        });
        console.log("~ color", name);
      }
      continue;
    }
    await prisma.category.create({
      data: {
        userId: user.id,
        name,
        kind: CategoryKind.EXPENSE,
        sortOrder: sortOrder++,
        color,
      },
    });
    created++;
    console.log("+", name);
  }

  console.log(`Done. Created ${created} categories (${existing.length + created} expense categories total).`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
