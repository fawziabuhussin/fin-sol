import type { SalarySlipBreakdown } from "@/lib/payslip-types";

const INTILAQA_NAMES = ["انطلاقة", "Intilaqa", "אנתלאקה"];

export function isIntilaqaEmployer(name: string) {
  const n = name.trim();
  return INTILAQA_NAMES.some(
    (hint) => n.includes(hint) || hint.includes(n)
  );
}

/** Static monthly תלוש — מנורה 116 + אקסלנס 114, בסיס ₪4,000 (every month). */
export const INTILAQA_KUPOT: SalarySlipBreakdown = {
  taxes: {
    nationalInsurance: 50,
    healthInsurance: 155,
    incomeTax: 0,
    total: 205,
  },
  pension: {
    employee: 240,
    employer: 593.2,
    severanceEmployer: 333.2,
    lines: [
      {
        fund: "116",
        type: "קצבה שכיר-תגמולים",
        employee: 240,
        employer: 260,
        base: 4000,
      },
      {
        fund: "116",
        type: "קצבה שכיר-פיצויים",
        employee: 0,
        employer: 333.2,
        base: 4000,
      },
      {
        fund: "114",
        type: "קרן השתלמות",
        employee: 100,
        employer: 300,
        base: 4000,
      },
    ],
  },
  keren: {
    employee: 100,
    employer: 300,
  },
};

/** Same every month — employee ₪340, employer ₪893.20 */
export const INTILAQA_STATIC_AMOUNTS = {
  gross: 4562,
  net: 4017,
  tax: 205,
  pension: 240,
  kerenHishtalmut: 100,
  fees: 0,
  bonus: 0,
} as const;

export type IntilaqaSlipPayload = {
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

/** Full static תלוש + קופות for انطلاقة when marking a month as paid (2026 only). */
export function resolveIntilaqaSlip(
  periodYear: number,
  periodMonth: number
): IntilaqaSlipPayload | null {
  if (periodYear !== 2026) return null;
  if (periodMonth < 1 || periodMonth > 12) return null;

  return {
    ...INTILAQA_STATIC_AMOUNTS,
    slipBreakdown: INTILAQA_KUPOT,
    notes: `תלוש انطلاقة — חודש ${periodMonth}/${periodYear} (תגמולים + פיצויים + השתלמות)`,
  };
}
