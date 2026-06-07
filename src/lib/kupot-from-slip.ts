import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { kupotAmountsFromSlip } from "@/lib/kupot-totals";

export type KupotMonthDetail = {
  year: number;
  month: number;
  label: string;
  pension: number;
  keren: number;
  pensionEmployer: number;
  kerenEmployer: number;
  employeeTotal: number;
  employerTotal: number;
  total: number;
  paid: boolean;
  paidAt: string | null;
  breakdown: SalarySlipBreakdown | null;
};

export function kupotFromSlip(slip: {
  periodYear: number;
  periodMonth: number;
  pension: { toString(): string } | number;
  kerenHishtalmut: { toString(): string } | number;
  paid: boolean;
  paidAt: Date | null;
  slipBreakdown: unknown;
  label?: string;
}): KupotMonthDetail {
  const amounts = kupotAmountsFromSlip(slip);
  return {
    year: slip.periodYear,
    month: slip.periodMonth,
    label: slip.label ?? `${slip.periodMonth}/${slip.periodYear}`,
    pension: amounts.pensionEmployee,
    keren: amounts.kerenEmployee,
    pensionEmployer: amounts.pensionEmployer,
    kerenEmployer: amounts.kerenEmployer,
    employeeTotal: amounts.employeeTotal,
    employerTotal: amounts.employerTotal,
    total: amounts.total,
    paid: slip.paid,
    paidAt: slip.paidAt?.toISOString().slice(0, 10) ?? null,
    breakdown: (slip.slipBreakdown as SalarySlipBreakdown | null) ?? null,
  };
}
