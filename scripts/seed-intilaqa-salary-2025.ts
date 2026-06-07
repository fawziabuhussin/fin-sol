/**
 * Seed انطلاقة קופות for Jan–Sep 2025 from תלוש breakdowns.
 * Months 1–3: higher rate (אלטי + הפניקס תלוש).
 * Months 4–9: lower rate (179.98 ₪ employee total per month).
 *
 * Usage: npx tsx scripts/seed-intilaqa-salary-2025.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { SalarySlipBreakdown } from "../src/lib/payslip-types";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2025;

/** Jan–Mar 2025 — תלוש גבוה */
const highPeriod = {
  pension: 242.51,
  kerenHishtalmut: 85.61,
  gross: 5200,
  net: 4500,
  tax: 390,
  breakdown: {
    taxes: { nationalInsurance: 75, healthInsurance: 232, incomeTax: 83, total: 390 },
    pension: {
      employee: 242.51,
      employer: 548.42,
      severanceEmployer: 288.59,
      lines: [
        {
          fund: "473",
          type: "קצבה שכיר-תגמולים",
          employee: 242.51,
          employer: 259.83,
          base: 3464.42,
        },
        {
          fund: "473",
          type: "פיצויים",
          employee: 0,
          employer: 288.59,
          base: 3464.42,
        },
      ],
    },
    keren: { employee: 85.61, employer: 256.82 },
  } satisfies SalarySlipBreakdown,
};

/** Apr–Sep 2025 — תלוש נמוך (סה״כ ניכוי עובד 179.98) */
const lowPeriod = {
  pension: 133.02,
  kerenHishtalmut: 46.96,
  gross: 2850,
  net: 2490,
  tax: 170,
  breakdown: {
    taxes: { nationalInsurance: 42, healthInsurance: 128, incomeTax: 0, total: 170 },
    pension: {
      employee: 133.02,
      employer: 300.81,
      severanceEmployer: 158.29,
      lines: [
        {
          fund: "458",
          type: "קצבה שכיר-תגמולים",
          employee: 133.02,
          employer: 142.52,
          base: 1900.3,
        },
        {
          fund: "458",
          type: "פיצויים",
          employee: 0,
          employer: 158.29,
          base: 1900.3,
        },
      ],
    },
    keren: { employee: 46.96, employer: 140.87 },
  } satisfies SalarySlipBreakdown,
};

function slipForMonth(month: number) {
  return month <= 3 ? highPeriod : lowPeriod;
}

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
  console.log("Seeding 2025 months 1–9 (קופות only — no income sync)\n");

  for (let periodMonth = 1; periodMonth <= 9; periodMonth++) {
    const slip = slipForMonth(periodMonth);
    const tier = periodMonth <= 3 ? "high" : "low";
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
        paid: true,
        paidAt: new Date(`${year}-${String(periodMonth).padStart(2, "0")}-28`),
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: 0,
        bonus: 0,
        slipBreakdown: slip.breakdown,
        notes: `2025 קופות — ${tier} תלוש (ייבוא)`,
      },
      update: {
        worked: true,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        slipBreakdown: slip.breakdown,
        notes: `2025 קופות — ${tier} תלוש (ייבוא)`,
      },
    });
    console.log(
      `  ${year}-${String(periodMonth).padStart(2, "0")}: פנסיה ₪${slip.pension} + קרן ₪${slip.kerenHishtalmut} = ₪${(slip.pension + slip.kerenHishtalmut).toFixed(2)}`
    );
  }

  const slips = await prisma.salarySlip.findMany({
    where: { employerId: employer.id, periodYear: year, worked: true },
  });
  const pensionSum = slips.reduce((s, x) => s + Number(x.pension), 0);
  const kerenSum = slips.reduce((s, x) => s + Number(x.kerenHishtalmut), 0);
  console.log(`\n2025 totals: פנסיה ₪${pensionSum.toFixed(2)} · קרן ₪${kerenSum.toFixed(2)} · סה״כ ₪${(pensionSum + kerenSum).toFixed(2)}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
