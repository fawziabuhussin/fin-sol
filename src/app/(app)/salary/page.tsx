import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { listEmployers, listSalary } from "@/lib/tenant-data";
import { decimalToNumber } from "@/lib/utils";
import { currentPeriod } from "@/lib/period";
import { SalaryPageClient } from "@/components/pages/salary-page-client";
import type { SalarySlipBreakdown } from "@/lib/payslip-types";

export const metadata: Metadata = { title: "الراتب" };

export default async function SalaryPage() {
  const user = await requireUser();
  const now = currentPeriod();
  const [employers, slips] = await Promise.all([listEmployers(user.id), listSalary(user.id)]);

  const effectiveNet = (s: (typeof slips)[number]) =>
    s.worked ? decimalToNumber(s.net) + decimalToNumber(s.bonus) - decimalToNumber(s.fees) : 0;

  const employerCards = employers.map((emp) => {
    const own = slips.filter((s) => s.employerId === emp.id);
    const thisYear = own.filter((s) => s.periodYear === now.year);
    const last = own.find((s) => s.worked);
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      color: emp.color,
      active: emp.active,
      ytdNet: thisYear.reduce((sum, s) => sum + effectiveNet(s), 0),
      months: Array.from({ length: 12 }, (_, i) => {
        const s = thisYear.find((x) => x.periodMonth === i + 1);
        return s ? effectiveNet(s) : 0;
      }),
      slipCount: own.length,
      last: last
        ? {
            year: last.periodYear,
            month: last.periodMonth,
            net: effectiveNet(last),
            paid: last.paid,
          }
        : null,
    };
  });

  const yearSlips = slips.filter((s) => s.periodYear === now.year && s.worked);
  const summary = {
    year: now.year,
    net: yearSlips.reduce((sum, s) => sum + effectiveNet(s), 0),
    gross: yearSlips.reduce((sum, s) => sum + decimalToNumber(s.gross), 0),
    tax: yearSlips.reduce((sum, s) => sum + decimalToNumber(s.tax), 0),
    pension: yearSlips.reduce((sum, s) => sum + decimalToNumber(s.pension) + decimalToNumber(s.kerenHishtalmut), 0),
    monthsWithPay: new Set(yearSlips.map((s) => s.periodMonth)).size,
    thisMonth: slips
      .filter((s) => s.periodYear === now.year && s.periodMonth === now.month && s.worked)
      .map((s) => ({ employerId: s.employerId, net: effectiveNet(s), paid: s.paid })),
  };

  return (
    <SalaryPageClient
      currentPeriod={now}
      employers={employerCards}
      summary={summary}
      recent={slips.slice(0, 12).map((s) => ({
        id: s.id,
        employerId: s.employerId,
        employerName: s.employer.name,
        year: s.periodYear,
        month: s.periodMonth,
        net: effectiveNet(s),
        gross: decimalToNumber(s.gross),
        worked: s.worked,
        paid: s.paid,
        fromPayslip: s.slipBreakdown != null,
        values: {
          gross: decimalToNumber(s.gross),
          net: decimalToNumber(s.net),
          tax: decimalToNumber(s.tax),
          pension: decimalToNumber(s.pension),
          kerenHishtalmut: decimalToNumber(s.kerenHishtalmut),
          fees: decimalToNumber(s.fees),
          bonus: decimalToNumber(s.bonus),
        },
        breakdown: (s.slipBreakdown as SalarySlipBreakdown | null) ?? null,
      }))}
      existing={Object.fromEntries(
        slips.map((s) => [`${s.employerId}:${s.periodYear}:${s.periodMonth}`, effectiveNet(s)])
      )}
    />
  );
}
