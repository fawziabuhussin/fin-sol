/**
 * Remove duplicate building expenses from project payment plans.
 * Usage:
 *   npx tsx scripts/dedupe-plan-expenses.ts [--dry-run] [userEmail]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  dedupePlanBuildingExpensesAllUsers,
  dedupePlanBuildingExpensesForUser,
} from "../src/lib/plan-expense-dedupe";

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
    const results = await dedupePlanBuildingExpensesAllUsers(prisma, { dryRun });
    console.log(dryRun ? "[dry-run] " : "", "All users:", results);
  } else {
    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) throw new Error(`User not found: ${userEmail}`);
    const result = await dedupePlanBuildingExpensesForUser(user.id, prisma, {
      dryRun,
    });
    console.log(
      dryRun ? "[dry-run] " : "",
      `User ${userEmail}:`,
      result
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
