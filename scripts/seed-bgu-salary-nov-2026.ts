/**
 * Upsert BGU November 2026 pay-month slip (October work, PaySlip2026-10.pdf).
 * Usage: npx tsx scripts/seed-bgu-salary-nov-2026.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { persistOfficialJamaShoglSlips } from "../src/lib/jama-shogl-repair";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  await persistOfficialJamaShoglSlips(user.id, 2026);
  console.log(
    "Persisted BGU pay-month 11/2026 (October work) — net ₪2,673.35 from PaySlip2026-10.pdf"
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
