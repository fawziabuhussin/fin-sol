import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import {
  isIntilaqaEmployer,
  resolveIntilaqaSlip,
} from "@/lib/intilaqa-payslip";
import {
  isJamaShoglEmployer,
  resolveJamaShoglSlip,
} from "@/lib/jama-shogl-payslip";

export type EmployerPaidSlipPayload = {
  gross: number;
  net: number;
  tax: number;
  pension: number;
  kerenHishtalmut: number;
  fees: number;
  bonus: number;
  slipBreakdown: SalarySlipBreakdown;
  notes: string;
};

/** Apply employer-specific תלוש when salary is marked paid. */
export function resolveEmployerPaidSlip(
  employerName: string,
  periodYear: number,
  periodMonth: number
): EmployerPaidSlipPayload | null {
  if (isJamaShoglEmployer(employerName)) {
    return resolveJamaShoglSlip(periodYear, periodMonth);
  }
  if (isIntilaqaEmployer(employerName)) {
    return resolveIntilaqaSlip(periodYear, periodMonth);
  }
  return null;
}
