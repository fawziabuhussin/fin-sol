/**
 * Seed انطلاقة (Menora/Excellence) salary slips for all months 2026 from Mar תלוש.
 * Usage: npx tsx scripts/seed-intilaqa-salary-2026.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";
import {
  INTILAQA_KUPOT,
  INTILAQA_STATIC_AMOUNTS,
  resolveIntilaqaSlip,
} from "../src/lib/intilaqa-payslip";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2026;
const months = Array.from({ length: 12 }, (_, i) => i + 1);

const slip = {
  ...INTILAQA_STATIC_AMOUNTS,
  breakdown: INTILAQA_KUPOT,
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const employer = await prisma.employer.findFirst({
    where: { userId: user.id, name: { contains: "انطلاقة" } },
  });

  if (!employer) {
    const all = await prisma.employer.findMany({
      where: { userId: user.id },
      select: { name: true },
    });
    throw new Error(
      `Employer انطلاقة not found. Existing: ${all.map((e) => e.name).join(", ")}`
    );
  }

  console.log(`Employer: ${employer.name} (${employer.id})`);
  console.log(
    `  עובד: מסים ₪${slip.tax} + פנסיה ₪${slip.pension} + קה״ש ₪${slip.kerenHishtalmut} = ₪${slip.tax + slip.pension + slip.kerenHishtalmut}`
  );
  console.log(
    `  מעסיק: פנסיה ₪${slip.breakdown.pension.employer} + קה״ש ₪${slip.breakdown.keren.employer} = ₪${slip.breakdown.pension.employer + slip.breakdown.keren.employer}`
  );

  const paidThrough = 5;

  for (const periodMonth of months) {
    const template = resolveIntilaqaSlip(year, periodMonth);
    if (!template) continue;

    const row = await prisma.salarySlip.upsert({
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
        paid: periodMonth <= paidThrough,
        paidAt:
          periodMonth <= paidThrough
            ? new Date(`${year}-${String(periodMonth).padStart(2, "0")}-28`)
            : null,
        gross: template.gross,
        net: template.net,
        tax: template.tax,
        pension: template.pension,
        kerenHishtalmut: template.kerenHishtalmut,
        fees: template.fees,
        bonus: template.bonus,
        slipBreakdown: template.slipBreakdown,
        notes: template.notes,
      },
      update: {
        worked: true,
        ...(periodMonth <= paidThrough
          ? {
              paid: true,
              paidAt: new Date(
                `${year}-${String(periodMonth).padStart(2, "0")}-28`
              ),
            }
          : {}),
        gross: template.gross,
        net: template.net,
        tax: template.tax,
        pension: template.pension,
        kerenHishtalmut: template.kerenHishtalmut,
        fees: template.fees,
        bonus: template.bonus,
        slipBreakdown: template.slipBreakdown,
        notes: template.notes,
      },
    });
    await syncSalarySlipIncome(row.id);
    console.log(
      `  ${year}-${String(periodMonth).padStart(2, "0")}: נטו ₪${slip.net}${periodMonth <= paidThrough ? " · מומש" : ""}`
    );
  }

  await prisma.employer.update({
    where: { id: employer.id },
    data: {
      baseGross: slip.gross,
      baseNet: slip.net,
      baseTax: slip.tax,
      basePension: slip.pension,
      baseKeren: slip.kerenHishtalmut,
      baseFees: slip.fees,
      baseBonus: slip.bonus,
      baseSlipBreakdown: slip.breakdown,
    },
  });
  console.log("Updated employer defaults.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
