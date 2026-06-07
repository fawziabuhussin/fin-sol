import type { SalarySlipBreakdown } from "@/lib/payslip-types";

/** BGU / جامعة شغل employer name variants */
const JAMA_SHOGL_NAMES = [
  "جامعة شغل",
  "الشغل في الجماعة",
  "בן גוריון",
  "Ben-Gurion",
];

export function isJamaShoglEmployer(name: string) {
  const n = name.trim();
  return JAMA_SHOGL_NAMES.some(
    (hint) => n.includes(hint) || hint.includes(n)
  );
}

/** Net salary from Excel summary (months without full תלוש on file). */
const NET_BY_MONTH: Record<number, number> = {
  1: 4119.09,
  2: 3194.47,
  3: 2584.47,
  4: 1819.12,
  5: 1819.12,
  6: 1819.12,
};

/** Jan–Mar 2026 — תלוש גבוה (אלטשולר + הפניקס השתלמות) */
const HIGH_KUPOT_BREAKDOWN: SalarySlipBreakdown = {
  taxes: {
    nationalInsurance: 0,
    healthInsurance: 0,
    incomeTax: 0,
    total: 0,
  },
  pension: {
    employee: 242.51,
    employer: 548.42,
    severanceEmployer: 288.59,
    lines: [
      {
        fund: "458",
        type: "קרן השתלמות",
        employee: 85.61,
        employer: 256.82,
        base: 3424.31,
      },
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
  keren: {
    employee: 85.61,
    employer: 256.82,
  },
};

/** Apr–Jun 2026 — תלוש נמוך (הפניקס פנסיה + השתלמות) */
const LOW_KUPOT_BREAKDOWN: SalarySlipBreakdown = {
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
      {
        fund: "458",
        type: "קרן השתלמות",
        employee: 46.96,
        employer: 140.87,
        base: 1878.3,
      },
    ],
  },
  keren: {
    employee: 46.96,
    employer: 140.87,
  },
  otherDeductions: 15.2,
};

export type JamaShoglSlipPayload = {
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

function buildHighSlip(month: number): JamaShoglSlipPayload {
  const net = NET_BY_MONTH[month] ?? 2584.47;
  const pension = 242.51;
  const keren = 85.61;
  const fees = 0;
  const gross = Math.round((net + pension + keren + 750) * 100) / 100;
  const tax = Math.round((gross - net - pension - keren - fees) * 100) / 100;
  const breakdown: SalarySlipBreakdown = {
    ...HIGH_KUPOT_BREAKDOWN,
    taxes: {
      nationalInsurance: Math.round(tax * 0.35 * 100) / 100,
      healthInsurance: Math.round(tax * 0.45 * 100) / 100,
      incomeTax: Math.round(tax * 0.2 * 100) / 100,
      total: tax,
    },
  };
  return {
    gross,
    net,
    tax,
    pension,
    kerenHishtalmut: keren,
    fees,
    bonus: 0,
    slipBreakdown: breakdown,
    notes: `תלוש בן גוריון — חודש ${month}/2026 (קופות גבוה)`,
  };
}

function buildLowSlip(month: number): JamaShoglSlipPayload {
  return {
    gross: 2346.3,
    net: NET_BY_MONTH[month] ?? 1819.12,
    tax: 332,
    pension: 133.02,
    kerenHishtalmut: 46.96,
    fees: 15.2,
    bonus: 0,
    slipBreakdown: LOW_KUPOT_BREAKDOWN,
    notes: `תלוש בן גוריון — חודש ${month}/2026 (עובד 179.98 + מעסיק 441.68 ₪)`,
  };
}

/** Full תלוש + קופות for جامعة شغל when marking a month as paid. */
export function resolveJamaShoglSlip(
  periodYear: number,
  periodMonth: number
): JamaShoglSlipPayload | null {
  if (periodYear !== 2026) return null;
  if (periodMonth >= 1 && periodMonth <= 3) return buildHighSlip(periodMonth);
  if (periodMonth >= 4 && periodMonth <= 12) return buildLowSlip(periodMonth);
  return null;
}
