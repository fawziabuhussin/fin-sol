import { TransactionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { monthRangeUTC } from "@/lib/dates";
import {
  JAMA_SHOGL_NAMES,
  isJamaShoglEmployer,
  officialJamaShoglSlipFromPdf,
} from "@/lib/jama-shogl-payslip";
import { syncSalarySlipIncome } from "@/lib/salary-income-sync";

const OFFICIAL_PAY_MONTHS_2026 = [9, 10] as const;

function employerNameFilters(name: string) {
  const hints = JAMA_SHOGL_NAMES.filter(
    (hint) => name.includes(hint) || hint.includes(name)
  );
  const terms = hints.length ? hints : [name];
  return {
    OR: terms.flatMap((term) => [
      { description: { contains: term } },
      { payee: { name: { contains: term } } },
    ]),
  };
}

async function dedupeJamaShoglIncomeForMonth(
  userId: string,
  employerName: string,
  year: number,
  month: number,
  keepSlipId: string
) {
  const { start, end } = monthRangeUTC(year, month);
  await prisma.transaction.deleteMany({
    where: {
      userId,
      type: TransactionType.INCOME,
      occurredAt: { gte: start, lte: end },
      ...employerNameFilters(employerName),
      NOT: { salarySlipId: keepSlipId },
    },
  });
}

/** Persist official BGU pay-month slips and leave one income row per month. */
export async function persistOfficialJamaShoglSlips(
  userId: string,
  year = 2026
) {
  if (year !== 2026) return;

  const employers = await prisma.employer.findMany({
    where: { userId },
  });
  const jama = employers.filter((e) => isJamaShoglEmployer(e.name));
  if (jama.length === 0) return;

  for (const employer of jama) {
    for (const month of OFFICIAL_PAY_MONTHS_2026) {
      const official = officialJamaShoglSlipFromPdf(year, month);
      if (!official) continue;

      const row = await prisma.salarySlip.upsert({
        where: {
          userId_employerId_periodYear_periodMonth: {
            userId,
            employerId: employer.id,
            periodYear: year,
            periodMonth: month,
          },
        },
        create: {
          userId,
          employerId: employer.id,
          periodYear: year,
          periodMonth: month,
          worked: true,
          paid: month === 9,
          paidAt: month === 9 ? new Date("2026-09-02") : null,
          gross: official.gross,
          net: official.net,
          tax: official.tax,
          pension: official.pension,
          kerenHishtalmut: official.kerenHishtalmut,
          fees: official.fees,
          bonus: official.bonus,
          notes: official.notes,
          slipBreakdown: official.slipBreakdown,
        },
        update: {
          worked: true,
          gross: official.gross,
          net: official.net,
          tax: official.tax,
          pension: official.pension,
          kerenHishtalmut: official.kerenHishtalmut,
          fees: official.fees,
          bonus: official.bonus,
          notes: official.notes,
          slipBreakdown: official.slipBreakdown,
        },
      });
      await syncSalarySlipIncome(row.id);
      await dedupeJamaShoglIncomeForMonth(
        userId,
        employer.name,
        year,
        month,
        row.id
      );
    }
  }
}
