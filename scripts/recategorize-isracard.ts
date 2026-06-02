/**
 * Re-apply expense categories to Isracard-imported transactions (Jan–Mar 2026).
 * Usage: npx tsx scripts/recategorize-isracard.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client";
import { categorizeExpense } from "../src/lib/expense-categories";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const categories = await prisma.category.findMany({
    where: { userId: user.id, kind: "EXPENSE" },
  });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      notes: { contains: "ייבוא" },
    },
    include: { category: true },
    orderBy: { occurredAt: "asc" },
  });

  const changes = new Map<string, number>();
  let updated = 0;
  let skipped = 0;

  for (const tx of txs) {
    const newCat = categorizeExpense(tx.description);
    const newCatId = catByName[newCat];
    if (!newCatId) {
      console.warn("Missing category:", newCat, "for", tx.description);
      skipped++;
      continue;
    }
    if (tx.category?.name === newCat) {
      skipped++;
      continue;
    }

    changes.set(`${tx.category?.name ?? "?"} → ${newCat}`, (changes.get(`${tx.category?.name ?? "?"} → ${newCat}`) ?? 0) + 1);

    if (!dryRun) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { categoryId: newCatId },
      });
    }
    updated++;
  }

  console.log(dryRun ? "[dry-run] " : "", {
    total: txs.length,
    updated,
    skipped,
  });
  console.log("\nChanges by mapping:");
  for (const [k, v] of [...changes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}× ${k}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
