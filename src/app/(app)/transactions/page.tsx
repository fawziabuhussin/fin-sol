import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getLookups, listTransactions } from "@/lib/tenant-data";
import {
  assetMovementFromEntry,
  parseAssetMovementDescription,
} from "@/lib/asset-movement-labels";
import { decimalToNumber, parseIntSafe } from "@/lib/utils";
import { currentPeriod } from "@/lib/period";
import { TransactionsPageClient } from "@/components/pages/transactions-page-client";
import type { TxRow } from "@/components/transactions/types";

export const metadata: Metadata = { title: "المعاملات" };

/** Large enough for a full year; the UI says so if a period ever exceeds it. */
const MAX_ROWS = 3000;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    year?: string;
    month?: string;
    type?: string;
    expenseCategory?: string;
    category?: string;
    project?: string;
    method?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = currentPeriod();
  const yearParam = parseIntSafe(params.year, now.year);
  const year = yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.year;
  const monthNum = parseIntSafe(params.month, now.month);
  const month = params.month === "all" ? null : monthNum >= 1 && monthNum <= 12 ? monthNum : now.month;
  const q = params.q?.trim() ?? "";
  const projectId = params.project && params.project !== "all" ? params.project : undefined;
  const paymentMethodId = params.method && params.method !== "all" ? params.method : undefined;

  const [{ items, total, summary }, lookups] = await Promise.all([
    listTransactions({
      userId: user.id,
      page: 1,
      pageSize: MAX_ROWS,
      q,
      year,
      month,
      projectId,
      paymentMethodId,
    }),
    getLookups(user.id),
  ]);

  const rows: TxRow[] = items.map((item) => ({
    id: item.id,
    type: item.type,
    amount: decimalToNumber(item.amount),
    occurredAt: item.occurredAt.toISOString().slice(0, 10),
    description: item.description,
    notes: item.notes,
    categoryId: item.categoryId,
    projectId: item.projectId,
    payeeId: item.payeeId,
    paymentMethodId: item.paymentMethodId,
    categoryName: item.category?.name ?? null,
    categoryColor: item.category?.color ?? null,
    projectName: item.project?.title ?? null,
    paymentMethodName: item.paymentMethod?.name ?? null,
    salarySlipId: item.salarySlipId,
    employerId: item.salarySlip?.employerId ?? null,
    assetEntryId: item.savingsAssetEntry?.id ?? item.savingsAssetEntryFee?.id ?? null,
    assetMovement: item.savingsAssetEntry
      ? assetMovementFromEntry(item.savingsAssetEntry)
      : parseAssetMovementDescription(item.description),
    linkedTo: item.subscriptionPayment
      ? "subscription"
      : item.splitInstallment || item.installment
        ? "installment"
        : null,
  }));

  return (
    <TransactionsPageClient
      rows={rows}
      total={total}
      summary={summary}
      currentPeriod={now}
      filters={{
        year,
        month: month ?? "all",
        q,
        type: params.type ?? "all",
        category: params.category ?? params.expenseCategory ?? "all",
        project: params.project ?? "all",
        method: params.method ?? "all",
      }}
      lookups={{
        categories: lookups.categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          color: c.color,
        })),
        projects: lookups.projects.map((p) => ({ id: p.id, name: p.title })),
        paymentMethods: lookups.paymentMethods.map((m) => ({ id: m.id, name: m.name })),
      }}
    />
  );
}
