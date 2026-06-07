import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { decimalToNumber } from "@/lib/utils";

export type KupotAmounts = {
  pensionEmployee: number;
  kerenEmployee: number;
  pensionEmployer: number;
  kerenEmployer: number;
  employeeTotal: number;
  employerTotal: number;
  total: number;
};

/** Employee + employer קופות from a paid salary slip. */
export function kupotAmountsFromSlip(slip: {
  pension: number | { toString(): string };
  kerenHishtalmut: number | { toString(): string };
  slipBreakdown?: unknown;
}): KupotAmounts {
  const pensionEmployee = decimalToNumber(
    slip.pension as { toString(): string }
  );
  const kerenEmployee = decimalToNumber(
    slip.kerenHishtalmut as { toString(): string }
  );
  const breakdown = slip.slipBreakdown as SalarySlipBreakdown | null | undefined;

  const pensionEmployer = breakdown?.pension?.employer ?? 0;
  const kerenEmployer = breakdown?.keren?.employer ?? 0;

  const employeeTotal = pensionEmployee + kerenEmployee;
  const employerTotal = pensionEmployer + kerenEmployer;

  return {
    pensionEmployee,
    kerenEmployee,
    pensionEmployer,
    kerenEmployer,
    employeeTotal,
    employerTotal,
    total: employeeTotal + employerTotal,
  };
}

export function sumKupotAmounts(amounts: KupotAmounts[]): KupotAmounts {
  return amounts.reduce(
    (acc, a) => ({
      pensionEmployee: acc.pensionEmployee + a.pensionEmployee,
      kerenEmployee: acc.kerenEmployee + a.kerenEmployee,
      pensionEmployer: acc.pensionEmployer + a.pensionEmployer,
      kerenEmployer: acc.kerenEmployer + a.kerenEmployer,
      employeeTotal: acc.employeeTotal + a.employeeTotal,
      employerTotal: acc.employerTotal + a.employerTotal,
      total: acc.total + a.total,
    }),
    {
      pensionEmployee: 0,
      kerenEmployee: 0,
      pensionEmployer: 0,
      kerenEmployer: 0,
      employeeTotal: 0,
      employerTotal: 0,
      total: 0,
    }
  );
}
