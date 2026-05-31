import { requireUser } from "@/lib/session";
import { listEmployers, listSalary } from "@/lib/tenant-data";
import { decimalToNumber } from "@/lib/utils";
import { SalaryPageClient } from "@/components/pages/salary-page-client";

export default async function SalaryPage() {
  const user = await requireUser();
  const [employers, slips] = await Promise.all([
    listEmployers(user.id),
    listSalary(user.id),
  ]);

  const employerStats = employers.map((emp) => {
    const empSlips = slips.filter((s) => s.employerId === emp.id);
    const ytdNet = empSlips
      .filter((s) => s.periodYear === 2026 && s.paid && s.worked)
      .reduce(
        (sum, s) =>
          sum +
          decimalToNumber(s.net) +
          decimalToNumber(s.bonus) -
          decimalToNumber(s.fees),
        0
      );
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      color: emp.color,
      active: emp.active,
      ytdNet,
      slipCount: empSlips.length,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">متابعة الراتب</h1>
      <SalaryPageClient
        employers={employerStats}
        recentSlips={slips.slice(0, 20).map((s) => ({
          id: s.id,
          employerId: s.employerId,
          employerName: s.employer.name,
          periodYear: s.periodYear,
          periodMonth: s.periodMonth,
          gross: decimalToNumber(s.gross),
          net: decimalToNumber(s.net),
        }))}
      />
    </div>
  );
}
