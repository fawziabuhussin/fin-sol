import type { PrismaClient } from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { sumPaidInstallments } from "@/lib/installment-transactions";
import {
  contractorBudgetTotal,
  isContractorFullyPaid,
} from "@/lib/project-completion-utils";
import { decimalToNumber } from "@/lib/utils";
import {
  InstallmentStatus,
  ProjectStatus,
  TransactionType,
} from "@/generated/prisma/client";

export { contractorBudgetTotal, isContractorFullyPaid } from "@/lib/project-completion-utils";

/** Reopen completed projects when budget grows above paid; optional auto-complete. */
export async function syncProjectStatusAfterFinancialChange(
  projectId: string,
  client: PrismaClient = defaultPrisma,
  hints?: { paid?: number; totalBudget?: number }
) {
  const project = await client.project.findUnique({
    where: { id: projectId },
    include: {
      transactions: { where: { type: TransactionType.EXPENSE } },
      paymentPlans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { installments: true },
      },
    },
  });
  if (!project) return { action: null };

  const plan = project.paymentPlans[0];
  const paid =
    hints?.paid ??
    (plan && plan.installments.length > 0
      ? sumPaidInstallments(plan.installments)
      : project.transactions.reduce(
          (sum, t) => sum + decimalToNumber(t.amount),
          0
        ));

  const totalBudget =
    hints?.totalBudget ??
    contractorBudgetTotal(
      decimalToNumber(project.totalBudget),
      plan ? decimalToNumber(plan.totalAmount) : 0
    );

  const pendingCount =
    plan?.installments.filter((i) => i.status === InstallmentStatus.PENDING)
      .length ?? 0;

  if (
    project.status === ProjectStatus.COMPLETED &&
    (!isContractorFullyPaid(paid, totalBudget) || pendingCount > 0)
  ) {
    await client.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ACTIVE },
    });
    return { action: "reopened" as const };
  }

  return { action: null };
}
