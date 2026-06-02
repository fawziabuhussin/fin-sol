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
};

export type PayslipParseResult = {
  gross?: number;
  net?: number;
  tax?: number;
  pension?: number;
  kerenHishtalmut?: number;
  periodYear?: number;
  periodMonth?: number;
  breakdown?: SalarySlipBreakdown;
  employerHint?: "bgu" | "menora" | "generic";
  confidence: "high" | "medium" | "low";
  rawText: string;
};
