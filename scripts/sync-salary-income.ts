/**
 * Re-sync all salary slips → income transactions (next-month rule).
 * Usage: npx tsx scripts/sync-salary-income.ts [userEmail]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncAllSalaryIncomeForUser } from "../src/lib/salary-income-sync";

const userEmail = process.argv[2] || process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);
  await syncAllSalaryIncomeForUser(user.id, prisma);
  console.log(`Synced salary income for ${userEmail}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
