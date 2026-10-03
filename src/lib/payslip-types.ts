export type SalarySlipPaymentLine = {
  code?: string;
  description: string;
  period?: string;
  amount: number;
};

export type SalarySlipDeductionLine = {
  code?: string;
  description: string;
  period?: string;
  amount: number;
};

/** Detailed Israeli payslip (תלוש) breakdown — pension (גמל) and taxes (מסים). */
export type SalarySlipBreakdown = {
  taxes: {
    nationalInsurance: number;
    healthInsurance: number;
    incomeTax: number;
    other?: number;
    total: number;
  };
  pension: {
    employee: number;
    employer: number;
    severanceEmployer?: number;
    lines?: {
      fund?: string;
      type?: string;
      employee: number;
      employer: number;
      base?: number;
    }[];
  };
  keren: {
    employee: number;
    employer: number;
  };
  otherDeductions?: number;
  payments?: SalarySlipPaymentLine[];
  extraDeductions?: SalarySlipDeductionLine[];
};

export type PayslipParseResult = {
  gross?: number;
  net?: number;
  tax?: number;
  pension?: number;
  kerenHishtalmut?: number;
  fees?: number;
  periodYear?: number;
  periodMonth?: number;
  breakdown?: SalarySlipBreakdown;
  employerHint?: "bgu" | "menora" | "generic";
  confidence: "high" | "medium" | "low";
  rawText: string;
};
