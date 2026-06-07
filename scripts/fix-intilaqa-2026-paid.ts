/**
 * انطلاقة 2026: months 1–5 paid, 6–12 unpaid. Clear 2025 from קופות.
 * Usage: npx tsx scripts/fix-intilaqa-2026-paid.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveIntilaqaSlip } from "../src/lib/intilaqa-payslip";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const paidThrough = 5;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const employer = await prisma.employer.findFirst({
    where: { userId: user.id, name: { contains: "انطلاقة" } },
  });
  if (!employer) throw new Error("Employer انطلاقة not found");

  const cleared2025 = await prisma.salarySlip.updateMany({
    where: { employerId: employer.id, periodYear: 2025 },
    data: { paid: false, paidAt: null },
  });
  console.log(`Cleared paid flag on ${cleared2025.count} × 2025 slips`);

  for (let periodMonth = 1; periodMonth <= 12; periodMonth++) {
    const template = resolveIntilaqaSlip(2026, periodMonth);
    if (!template) continue;

    const paid = periodMonth <= paidThrough;
    const row = await prisma.salarySlip.upsert({
      where: {
        userId_employerId_periodYear_periodMonth: {
          userId: user.id,
          employerId: employer.id,
          periodYear: 2026,
          periodMonth,
        },
      },
      create: {
        userId: user.id,
        employerId: employer.id,
        periodYear: 2026,
        periodMonth,
        worked: true,
        paid,
        paidAt: paid
          ? new Date(`2026-${String(periodMonth).padStart(2, "0")}-28`)
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
        paid,
        paidAt: paid
          ? new Date(`2026-${String(periodMonth).padStart(2, "0")}-28`)
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
    });
    if (paid) await syncSalarySlipIncome(row.id);
    console.log(
      `  2026-${String(periodMonth).padStart(2, "0")}: ${paid ? "✓ paid" : "unpaid — press ✓ to add"}`
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
