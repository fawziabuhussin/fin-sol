/**
 * Import Isracard statement — billing 11/2026.
 * Prefer in-app: Transactions → استيراد ישראכרט.
 *
 * Usage: npx tsx scripts/import-isracard-nov-2026.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importIsracardStatementPack } from "../src/lib/isracard-import";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const PACK_ID = "2026-11";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const result = await importIsracardStatementPack(prisma, user.id, PACK_ID, {
    dryRun,
  });

  console.log(
    dryRun ? "[dry-run] " : "",
    `Nov 2026 Isracard import for ${userEmail}:`,
    {
      ...result,
      statementTotal: result.statementTotal.toFixed(2),
    }
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
