import type { SalarySlipBreakdown } from "@/lib/payslip-types";

export type EmployerBaseDefaults = {
  gross: number;
  net: number;
  tax: number;
  pension: number;
  keren: number;
  fees: number;
  bonus: number;
  slipBreakdown: SalarySlipBreakdown | null;
};

export type BaseBreakdownForm = {
  taxNationalInsurance: number;
  taxHealthInsurance: number;
  taxIncome: number;
};

type BaseAmounts = Pick<
  EmployerBaseDefaults,
  "gross" | "net" | "tax" | "pension" | "keren" | "fees" | "bonus"
>;

export function breakdownFromBaseForm(
  base: BaseAmounts,
  parts: BaseBreakdownForm
): SalarySlipBreakdown | null {
  const fromParts =
    parts.taxNationalInsurance + parts.taxHealthInsurance + parts.taxIncome;
  const taxTotal = fromParts > 0 ? fromParts : base.tax;
  if (
    taxTotal === 0 &&
    base.pension === 0 &&
    base.keren === 0 &&
    base.fees === 0
  ) {
    return null;
  }

  return {
    taxes: {
      nationalInsurance: parts.taxNationalInsurance,
      healthInsurance: parts.taxHealthInsurance,
      incomeTax:
        fromParts > 0 ? parts.taxIncome : Math.max(0, taxTotal),
      total: taxTotal,
    },
    pension: { employee: base.pension, employer: 0 },
    keren: { employee: base.keren, employer: 0 },
    ...(base.fees > 0 ? { otherDeductions: base.fees } : {}),
  };
}

export function partsFromBreakdown(
  breakdown: SalarySlipBreakdown | null | undefined
): BaseBreakdownForm {
  if (!breakdown?.taxes) {
    return { taxNationalInsurance: 0, taxHealthInsurance: 0, taxIncome: 0 };
  }
  return {
    taxNationalInsurance: breakdown.taxes.nationalInsurance,
    taxHealthInsurance: breakdown.taxes.healthInsurance,
    taxIncome: breakdown.taxes.incomeTax,
  };
}

/** Values applied when opening a new month for editing. */
export function monthDefaultsFromBase(base: EmployerBaseDefaults) {
  const breakdown =
    base.slipBreakdown ??
    breakdownFromBaseForm(
      {
        gross: base.gross,
        net: base.net,
        tax: base.tax,
        pension: base.pension,
        keren: base.keren,
        fees: base.fees,
        bonus: base.bonus,
      },
      partsFromBreakdown(null)
    );

  return {
    gross: base.gross,
    net: base.net,
    tax: base.tax,
    pension: base.pension,
    kerenHishtalmut: base.keren,
    fees: base.fees,
    bonus: base.bonus,
    slipBreakdown: breakdown,
  };
}
