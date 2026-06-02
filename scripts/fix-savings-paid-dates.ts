/**
 * Set paidAt to the last day of each entry's schedule month (not the toggle date).
 * Run: npx tsx scripts/fix-savings-paid-dates.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

function paidAtForPeriod(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const entries = await prisma.savingsEntry.findMany({
    where: { paid: true },
  });

  let fixed = 0;
  for (const e of entries) {
    const expected = paidAtForPeriod(e.periodYear, e.periodMonth);
    const py = e.paidAt?.getUTCFullYear();
    const pm = e.paidAt ? e.paidAt.getUTCMonth() + 1 : null;
    if (py === e.periodYear && pm === e.periodMonth) continue;

    await prisma.savingsEntry.update({
      where: { id: e.id },
      data: { paidAt: expected },
    });
    fixed++;
    console.log(
      `  ${e.periodYear}-${String(e.periodMonth).padStart(2, "0")}: ${e.paidAt?.toISOString().slice(0, 10) ?? "null"} → ${expected.toISOString().slice(0, 10)}`
    );
  }

  console.log(`Fixed ${fixed} of ${entries.length} paid entries.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
