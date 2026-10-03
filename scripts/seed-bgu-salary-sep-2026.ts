/**
 * Upsert BGU September 2026 salary from 9-2026.pdf (תלוש בן גוריון).
 * Usage: npx tsx scripts/seed-bgu-salary-sep-2026.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveJamaShoglSlip } from "../src/lib/jama-shogl-payslip";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2026;
const periodMonth = 9;

const EMPLOYER_NAMES = [
  "الشغل في الجماعة",
  "جامعة شغل",
  "בן גוריון",
  "Ben-Gurion",
];

async function main() {
  const slip = resolveJamaShoglSlip(year, periodMonth);
  if (!slip) throw new Error("September 2026 BGU slip is not encoded");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  let employer = await prisma.employer.findFirst({
    where: {
      userId: user.id,
      OR: EMPLOYER_NAMES.map((name) => ({ name: { contains: name } })),
    },
  });

  if (!employer) {
    employer = await prisma.employer.create({
      data: {
        userId: user.id,
        name: "جامعة شغل",
        color: "#6366f1",
        active: true,
        baseGross: slip.gross,
        baseNet: slip.net,
        baseTax: slip.tax,
        basePension: slip.pension,
        baseKeren: slip.kerenHishtalmut,
        baseFees: slip.fees,
        baseBonus: 0,
        baseSlipBreakdown: slip.slipBreakdown,
      },
    });
    console.log(`Created missing employer: ${employer.name} (${employer.id})`);
  }

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
      paid: false,
      paidAt: null,
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
  await syncSalarySlipIncome(row.id);
  console.log(
    `  ${year}-09: net ₪${slip.net} (gross ₪${slip.gross}, pension ₪${slip.pension}, keren ₪${slip.kerenHishtalmut}, fees ₪${slip.fees})`
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
