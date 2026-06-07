/**
 * Seed انطلاقة static קופות for all months 2025 (מנורה + אקסלנס).
 * Usage: npx tsx scripts/seed-intilaqa-salary-2025.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveIntilaqaSlip } from "../src/lib/intilaqa-payslip";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2025;
const months = Array.from({ length: 12 }, (_, i) => i + 1);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const employer = await prisma.employer.findFirst({
    where: { userId: user.id, name: { contains: "انطلاقة" } },
  });
  if (!employer) throw new Error("Employer انطلاقة not found");

  console.log(`Employer: ${employer.name}`);
  console.log("Seeding static 2025 קופות (₪340 עובד + ₪893.20 מעסיק / month)\n");

  const paidThrough = 9;

  for (const periodMonth of months) {
    const slip = resolveIntilaqaSlip(year, periodMonth);
    if (!slip) continue;

    const existing = await prisma.salarySlip.findUnique({
      where: {
        userId_employerId_periodYear_periodMonth: {
          userId: user.id,
          employerId: employer.id,
          periodYear: year,
          periodMonth,
        },
      },
      select: { paid: true, paidAt: true },
    });

    const paid = existing?.paid ?? periodMonth <= paidThrough;

    await prisma.salarySlip.upsert({
      where: {
        userId_employerId_periodYear_periodMonth: {
          userId: user.id,
          employerId: employer.id,
          periodYear: year,
          periodMonth,
        },
      },
      create: {
        userId: user.id,
        employerId: employer.id,
        periodYear: year,
        periodMonth,
        worked: true,
        paid,
        paidAt:
          paid && !existing?.paidAt
            ? new Date(`${year}-${String(periodMonth).padStart(2, "0")}-28`)
            : existing?.paidAt ?? null,
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees,
        bonus: slip.bonus,
        slipBreakdown: slip.slipBreakdown,
        notes: slip.notes,
      },
      update: {
        worked: true,
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees,
        bonus: slip.bonus,
        slipBreakdown: slip.slipBreakdown,
        notes: slip.notes,
      },
    });
    console.log(
      `  ${year}-${String(periodMonth).padStart(2, "0")}: עובד ₪340 + מעסיק ₪893.20${paid ? " · paid" : ""}`
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
