/**
 * Create transactions for asset entries missing a link.
 * Run: npx tsx scripts/backfill-asset-transactions.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  createAssetPurchaseTransaction,
  createAssetWithdrawalTransaction,
} from "../src/lib/savings-contribution";
import { decimalToNumber } from "../src/lib/utils";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const entries = await prisma.savingsAssetEntry.findMany({
    where: { transactionId: null },
    include: { asset: { select: { userId: true, kind: true } } },
    orderBy: { purchasedAt: "asc" },
  });

  let created = 0;
  for (const entry of entries) {
    const signedValue = decimalToNumber(entry.valueIls);
    const amount = Math.abs(signedValue);
    if (amount <= 0) continue;

    const isWithdrawal = decimalToNumber(entry.quantity) < 0;
    const tx = isWithdrawal
      ? await createAssetWithdrawalTransaction({
          userId: entry.asset.userId,
          kind: entry.asset.kind,
          amount,
          occurredAt: entry.purchasedAt,
          notes: entry.notes,
        })
      : await createAssetPurchaseTransaction({
          userId: entry.asset.userId,
          kind: entry.asset.kind,
          amount,
          occurredAt: entry.purchasedAt,
          notes: entry.notes,
        });

    await prisma.savingsAssetEntry.update({
      where: { id: entry.id },
      data: { transactionId: tx.id },
    });

    created++;
    console.log(
      `  ${entry.purchasedAt.toISOString().slice(0, 10)} ${isWithdrawal ? "سحب" : "شراء"} ${entry.asset.kind} ₪${amount} → ${tx.id}`
    );
  }

  console.log(`Created ${created} transaction(s) for ${entries.length} unlinked entries.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
