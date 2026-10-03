/**
 * Upsert BGU pay-month slips:
 *   September ← 8-2026.pdf (נטו 3,594)
 *   October   ← 9-2026.pdf (נטו 4,079.88)
 * Usage: npx tsx scripts/seed-bgu-salary-sep-2026.ts
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
  console.log("Persisted BGU September ₪3,594 (8-2026) and October ₪4,079.88 (9-2026)");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
