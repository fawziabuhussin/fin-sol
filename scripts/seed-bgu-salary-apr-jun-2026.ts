/**
 * Seed BGU (جامعة شغل / الشغل في الجماعة) salary slips Apr–Jun 2026 from May תלוש.
 * Usage: npx tsx scripts/seed-bgu-salary-apr-jun-2026.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";
import type { SalarySlipBreakdown } from "../src/lib/payslip-types";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2026;
const months = [4, 5, 6];

/** May 2026 תלוש — בן גוריון (Junior Academic, 27.27%) */
const slip = {
  gross: 2346.3,
  net: 1819.12,
  tax: 332,
  pension: 133.02,
  kerenHishtalmut: 46.96,
  fees: 15.2,
  breakdown: {
    taxes: {
      nationalInsurance: 164,
      healthInsurance: 121,
      incomeTax: 47,
      total: 332,
    },
    pension: {
      employee: 133.02,
      employer: 300.81,
      severanceEmployer: 158.29,
      lines: [
        {
          fund: "347",
          type: "קצבה שכיר-תג.",
          employee: 133.02,
          employer: 142.52,
          base: 1900.3,
        },
        {
          fund: "347",
          type: "פיצויים",
          employee: 0,
          employer: 158.29,
          base: 1900.3,
        },
      ],
    },
    keren: {
      employee: 46.96,
      employer: 140.87,
    },
    otherDeductions: 15.2,
  } satisfies SalarySlipBreakdown,
};

const EMPLOYER_NAMES = [
  "الشغل في الجماعة",
  "جامعة شغل",
  "בן גוריון",
  "Ben-Gurion",
];

async function main() {
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
    const all = await prisma.employer.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    console.log("Employers:", all.map((e) => e.name).join(", ") || "(none)");
    throw new Error(
      `Employer not found. Expected one of: ${EMPLOYER_NAMES.join(", ")}`
    );
  }

  console.log(`Employer: ${employer.name} (${employer.id})`);

  for (const periodMonth of months) {
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
        paid: periodMonth <= 5,
        paidAt: periodMonth <= 5 ? new Date(`${year}-${String(periodMonth).padStart(2, "0")}-28`) : null,
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees,
        bonus: 0,
        slipBreakdown: slip.breakdown,
        notes: "תלוש בן גוריון — ייבוא אפר–יונ 2026",
      },
      update: {
        worked: true,
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees,
        slipBreakdown: slip.breakdown,
        notes: "תלוש בן גוריון — ייבוא אפר–יונ 2026",
      },
    });
    await syncSalarySlipIncome(row.id);
    console.log(
      `  ${year}-${String(periodMonth).padStart(2, "0")}: net ₪${slip.net} (gross ₪${slip.gross})`
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
      baseBonus: 0,
      baseSlipBreakdown: slip.breakdown,
    },
  });
  console.log("Updated employer defaults from תלוש.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
