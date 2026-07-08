/**
 * Apply smart category suggestions to uncategorized expenses.
 * Usage: npx tsx scripts/smart-recategorize-expenses.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { CategoryKind, PrismaClient, TransactionType } from "../src/generated/prisma/client";
import {
  isUncategorizedCategoryName,
  suggestCategoryNameFromDescription,
} from "../src/lib/expense-category-groups";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const categories = await prisma.category.findMany({
    where: { userId: user.id, kind: CategoryKind.EXPENSE },
  });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, type: TransactionType.EXPENSE },
    include: { category: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const tx of txs) {
    const currentName = tx.category?.name ?? "";
    if (!isUncategorizedCategoryName(currentName)) {
      skipped++;
      continue;
    }

    const suggested = suggestCategoryNameFromDescription(tx.description);
    if (suggested === "أخرى") continue;

    let category = catByName[suggested];
    if (!category && !dryRun) {
      category = await prisma.category.create({
        data: {
          userId: user.id,
          name: suggested,
          kind: CategoryKind.EXPENSE,
        },
      });
      catByName[suggested] = category;
    }

    if (!category) continue;

    console.log(
      dryRun ? "[dry-run]" : "+",
      tx.occurredAt.toISOString().slice(0, 10),
      Number(tx.amount).toFixed(2),
      (tx.description ?? "").slice(0, 40),
      "→",
      suggested
    );

    if (!dryRun) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { categoryId: category.id },
      });
    }
    updated++;
  }

  console.log(
    dryRun ? "[dry-run] " : "",
    `Smart recategorize: ${updated} updated, ${skipped} already categorized`
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
