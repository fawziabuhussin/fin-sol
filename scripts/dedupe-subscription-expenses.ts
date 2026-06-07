/**
 * Remove duplicate subscription seed expenses when a real card import exists.
 * Usage:
 *   npx tsx scripts/dedupe-subscription-expenses.ts [--dry-run] [userEmail]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  dedupeSubscriptionExpensesAllUsers,
  dedupeSubscriptionExpensesForUser,
} from "../src/lib/subscription-expense-dedupe";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const userEmail =
  args.find((a) => a !== "--dry-run") ||
  process.env.IMPORT_USER_EMAIL ||
  "foze820@gmail.com";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  if (userEmail === "--all") {
    const results = await dedupeSubscriptionExpensesAllUsers(prisma, { dryRun });
    console.log(dryRun ? "[dry-run] " : "", "All users:", JSON.stringify(results, null, 2));
  } else {
    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) throw new Error(`User not found: ${userEmail}`);
    const result = await dedupeSubscriptionExpensesForUser(user.id, prisma, { dryRun });
    console.log(dryRun ? "[dry-run] " : "", `User ${userEmail}:`, JSON.stringify(result, null, 2));
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
