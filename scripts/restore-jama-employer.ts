/**
 * Restore جامعة شغل employer and salary slips after accidental deletion.
 * Usage: npx tsx scripts/restore-jama-employer.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";
import type { SalarySlipBreakdown } from "../src/lib/payslip-types";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const year = 2026;
const employerName = "جامعة شغل";
const employerColor = "#6366f1";

/** From Excel تلخيص سنوي — used for months without a detailed תלוש */
const EXCEL_NET_BY_MONTH: Record<number, number> = {
  1: 4119.09,
  2: 3194.47,
  3: 2584.47,
  4: 2584.47,
  5: 1819.12,
  6: 1819.12,
  7: 1819.12,
  8: 1819.12,
  9: 1819.12,
  10: 1819.12,
  11: 1819.12,
  12: 1819.12,
};

/** Apr–Jun 2026 תלוש — בן גוריון (overrides Excel for these months) */
const bguSlip = {
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

const BGU_MONTHS = new Set([4, 5, 6]);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  let employer = await prisma.employer.findFirst({
    where: { userId: user.id, name: employerName },
  });

  if (!employer) {
    employer = await prisma.employer.create({
      data: {
        userId: user.id,
        name: employerName,
        color: employerColor,
        active: true,
        baseGross: bguSlip.gross,
        baseNet: bguSlip.net,
        baseTax: bguSlip.tax,
        basePension: bguSlip.pension,
        baseKeren: bguSlip.kerenHishtalmut,
        baseFees: bguSlip.fees,
        baseBonus: 0,
        baseSlipBreakdown: bguSlip.breakdown,
      },
    });
    console.log(`Created employer: ${employer.name} (${employer.id})`);
  } else {
    console.log(`Employer exists: ${employer.name} (${employer.id})`);
  }

  for (let periodMonth = 1; periodMonth <= 12; periodMonth++) {
    const useBgu = BGU_MONTHS.has(periodMonth);
    const net = useBgu ? bguSlip.net : EXCEL_NET_BY_MONTH[periodMonth];
    if (net <= 0) continue;

    const paid = periodMonth <= 5;

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
        paid,
        paidAt: paid
          ? new Date(`${year}-${String(periodMonth).padStart(2, "0")}-28`)
          : null,
        gross: useBgu ? bguSlip.gross : net,
        net: useBgu ? bguSlip.net : net,
        tax: useBgu ? bguSlip.tax : 0,
        pension: useBgu ? bguSlip.pension : 0,
        kerenHishtalmut: useBgu ? bguSlip.kerenHishtalmut : 0,
        fees: useBgu ? bguSlip.fees : 0,
        bonus: 0,
        slipBreakdown: useBgu ? bguSlip.breakdown : undefined,
        notes: useBgu ? "תלוש בן גוריון — ייבוא אפר–יונ 2026" : null,
      },
      update: {
        worked: true,
        gross: useBgu ? bguSlip.gross : net,
        net: useBgu ? bguSlip.net : net,
        tax: useBgu ? bguSlip.tax : 0,
        pension: useBgu ? bguSlip.pension : 0,
        kerenHishtalmut: useBgu ? bguSlip.kerenHishtalmut : 0,
        fees: useBgu ? bguSlip.fees : 0,
        slipBreakdown: useBgu ? bguSlip.breakdown : undefined,
      },
    });
    await syncSalarySlipIncome(row.id);
    console.log(
      `  ${year}-${String(periodMonth).padStart(2, "0")}: net ₪${net}${useBgu ? " (BGU תלוש)" : ""}`
    );
  }

  await prisma.employer.update({
    where: { id: employer.id },
    data: {
      baseGross: bguSlip.gross,
      baseNet: bguSlip.net,
      baseTax: bguSlip.tax,
      basePension: bguSlip.pension,
      baseKeren: bguSlip.kerenHishtalmut,
      baseFees: bguSlip.fees,
      baseBonus: 0,
      baseSlipBreakdown: bguSlip.breakdown,
    },
  });

  console.log("\nDone — جامعة شغل restored with 12 salary slips.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
