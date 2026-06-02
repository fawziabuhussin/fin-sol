const PAID_TOLERANCE = 0.01;

export function contractorBudgetTotal(
  projectBudget: number,
  planTotalAmount: number | null | undefined
) {
  return Math.max(projectBudget, planTotalAmount ?? 0);
}

export function isContractorFullyPaid(paid: number, totalBudget: number) {
  return totalBudget > 0 && paid >= totalBudget - PAID_TOLERANCE;
}
