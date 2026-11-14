import type { AssetMovementMeta } from "@/lib/asset-movement-labels";

export type TxType = "INCOME" | "EXPENSE" | "TRANSFER" | "SAVINGS_CONTRIBUTION";

export type TxCategory = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE" | "SAVINGS";
  color: string | null;
};

export type TxRow = {
  id: string;
  type: TxType;
  amount: number;
  occurredAt: string;
  description: string | null;
  notes: string | null;
  categoryId: string | null;
  projectId: string | null;
  payeeId: string | null;
  paymentMethodId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  projectName: string | null;
  paymentMethodName: string | null;
  salarySlipId: string | null;
  employerId: string | null;
  assetEntryId: string | null;
  assetMovement: AssetMovementMeta | null;
  /** Created by a subscription payment or installment — edits there stay in sync. */
  linkedTo: "subscription" | "installment" | null;
};
