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
  6: 2039.25,
  7: 2039.25,
  9: 4079.88,
};

/** Months with a real BGU PDF encoded in this file (not an Excel estimate). */
const OFFICIAL_PDF_MONTHS_2026 = new Set([4, 5, 6, 9]);

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

/** Jun 2026+ — תלוש עם ת. דיפרנציאלית (6-2026.pdf) */
const JUN_2026_BREAKDOWN: SalarySlipBreakdown = {
  taxes: {
    nationalInsurance: 185,
    healthInsurance: 136,
    incomeTax: 53,
    total: 374,
  },
  pension: {
    employee: 164.73,
    employer: 153.75,
    severanceEmployer: 182.96,
    lines: [
      {
        fund: "347",
        type: "קצבה שכיר-תג.",
        employee: 164.73,
        employer: 153.75,
        base: 2196.4,
      },
      {
        fund: "347",
        type: "פיצויים",
        employee: 0,
        employer: 182.96,
        base: 2196.4,
      },
      {
        fund: "458",
        type: "קרן השתלמות",
        employee: 54.27,
        employer: 162.81,
        base: 2170.84,
      },
    ],
  },
  keren: {
    employee: 54.27,
    employer: 162.81,
  },
  otherDeductions: 17.57,
};

/** Sep 2026 — תלוש בן גוריון (9-2026.pdf), 74.50% משרה */
const SEP_2026_BREAKDOWN: SalarySlipBreakdown = {
  taxes: {
    nationalInsurance: 452,
    healthInsurance: 336,
    incomeTax: 919,
    total: 1707,
  },
  pension: {
    employee: 490.01,
    employer: 457.31,
    severanceEmployer: 544.23,
    lines: [
      {
        fund: "347",
        type: "קצבה שכיר-תג. 08/26-04/26",
        employee: 54.8,
        employer: 51.13,
        base: 730.46,
      },
      {
        fund: "347",
        type: "קצבה שכיר-תג.",
        employee: 376.5,
        employer: 351.4,
        base: 5020.01,
      },
      {
        fund: "347",
        type: "קצבה שכיר-תג. 03/26-10/25",
        employee: 58.71,
        employer: 54.78,
        base: 782.7,
      },
      {
        fund: "347",
        type: "פיצויים 08/26-04/26",
        employee: 0,
        employer: 60.87,
        base: 730.46,
      },
      {
        fund: "347",
        type: "פיצויים",
        employee: 0,
        employer: 418.17,
        base: 5020.01,
      },
      {
        fund: "347",
        type: "פיצויים 03/26-10/25",
        employee: 0,
        employer: 65.19,
        base: 782.7,
      },
      {
        fund: "458",
        type: "קרן השתלמות",
        employee: 124.05,
        employer: 372.16,
        base: 4962.12,
      },
      {
        fund: "458",
        type: "קרן השתלמות — הפרשים",
        employee: 4.65,
        employer: 144.89,
      },
    ],
  },
  keren: {
    employee: 128.7,
    employer: 517.05,
  },
  otherDeductions: 114.27,
  payments: [
    { code: "001", description: "שכר משולב", amount: 3778.55 },
    {
      code: "001",
      description: "הפרשים שכר משולב",
      period: "08/26-10/25",
      amount: 287,
    },
    {
      code: "001",
      description: "שכר משולב",
      period: "08/26-06/26",
      amount: 73.56,
    },
    { code: "034", description: "תוספות שכר", amount: 918.22 },
    {
      code: "034",
      description: "הפרשים תוספות שכר",
      period: "08/26-10/25",
      amount: 66.46,
    },
    {
      code: "034",
      description: "תוספות שכר",
      period: "08/26-06/26",
      amount: 21.54,
    },
    {
      code: "1037",
      description: "הפרשים תוספת 8% הוראה",
      period: "05/26-10/25",
      amount: 49.9,
    },
    { code: "046", description: "הבראה חדשית", amount: 196.22 },
    {
      code: "046",
      description: "הפרשים הבראה חדשית",
      period: "08/26-07/26",
      amount: 29.14,
    },
    { code: "1079", description: "ת. שקלית 2025", amount: 127.02 },
    {
      code: "1079",
      description: "הפרשים ת. שקלית 2025",
      period: "08/26-10/25",
      amount: 743.97,
    },
    {
      code: "1079",
      description: "ת. שקלית 2025",
      period: "08/26-06/26",
      amount: 241.59,
    },
    { code: "056", description: "גילום קצובת נסיעה נטו", amount: 59 },
    {
      code: "056",
      description: "הפרש גילום קצובת נסיעה נטו",
      period: "07/26-06/26",
      amount: 3,
    },
    { code: "3010", description: "הפחתת שכר", amount: -57.89 },
    {
      code: "3010",
      description: "הפרשים הפחתת שכר",
      period: "08/26-10/25",
      amount: -13.22,
    },
    {
      code: "3010",
      description: "הפחתת שכר",
      period: "08/26-06/26",
      amount: -4.2,
    },
  ],
  extraDeductions: [
    { code: "563", description: "דמי חבר ס.הוראה", amount: 40.16 },
    {
      code: "563",
      description: "דמי חבר ס.הוראה",
      period: "08/26-10/25",
      amount: 12.11,
    },
    { code: "581", description: "מס הכנסה מגולם", amount: 52 },
    { code: "582", description: "ב.לאומי מגולם", amount: 5 },
    { code: "584", description: "ב.בריאות מגולם", amount: 5 },
  ],
};

function buildSep2026Slip(): JamaShoglSlipPayload {
  return {
    gross: 6519.86,
    net: 4079.88,
    tax: 1707,
    pension: 490.01,
    kerenHishtalmut: 128.7,
    fees: 114.27,
    bonus: 0,
    slipBreakdown: SEP_2026_BREAKDOWN,
    notes:
      "תלוש בן גוריון — ספטמבר 2026 (74.50% משרה · הפניקס 347/458 · נטו לתשלום 4,079.88)",
  };
}

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
  if (month === 9) return buildSep2026Slip();
  if (month >= 6) {
    const net = NET_BY_MONTH[month] ?? 2039.25;
    return {
      gross: 2638.84,
      net,
      tax: 374,
      pension: 164.73,
      kerenHishtalmut: 54.27,
      fees: 17.57,
      bonus: 0,
      slipBreakdown: JUN_2026_BREAKDOWN,
      notes: `תלוש בן גוריון — חודש ${month}/2026 (ת. דיפרנציאלית)`,
    };
  }
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

export function officialJamaShoglSlipFromPdf(
  periodYear: number,
  periodMonth: number
): JamaShoglSlipPayload | null {
  if (periodYear !== 2026 || !OFFICIAL_PDF_MONTHS_2026.has(periodMonth)) {
    return null;
  }
  return resolveJamaShoglSlip(periodYear, periodMonth);
}

export function isStaleJamaShoglSlip(
  stored: {
    net?: number | null;
    pension?: number | null;
    tax?: number | null;
    slipBreakdown?: SalarySlipBreakdown | null;
  },
  official: JamaShoglSlipPayload
) {
  const net = stored.net ?? 0;
  const pension = stored.pension ?? 0;
  const tax = stored.tax ?? 0;
  return (
    Math.abs(net - official.net) > 0.05 ||
    (official.pension > 0 && pension === 0) ||
    (official.tax > 0 && tax === 0) ||
    !(stored.slipBreakdown?.pension?.lines?.length)
  );
}

export function applyOfficialJamaShoglIfStale<
  T extends {
    gross: number;
    net: number;
    tax: number;
    pension: number;
    kerenHishtalmut: number;
    fees: number;
    bonus: number;
    notes?: string | null;
    slipBreakdown?: SalarySlipBreakdown | null;
  },
>(employerName: string, periodYear: number, periodMonth: number, stored: T): T {
  if (!isJamaShoglEmployer(employerName)) return stored;
  const official = officialJamaShoglSlipFromPdf(periodYear, periodMonth);
  if (!official || !isStaleJamaShoglSlip(stored, official)) return stored;
  return {
    ...stored,
    gross: official.gross,
    net: official.net,
    tax: official.tax,
    pension: official.pension,
    kerenHishtalmut: official.kerenHishtalmut,
    fees: official.fees,
    bonus: official.bonus,
    notes: official.notes,
    slipBreakdown: official.slipBreakdown,
  };
}
