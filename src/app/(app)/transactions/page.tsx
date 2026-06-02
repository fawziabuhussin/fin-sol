import { requireUser } from "@/lib/session";
import { getLookups, listTransactions } from "@/lib/tenant-data";
import { formatUtcDate } from "@/lib/dates";
import { decimalToNumber, parseIntSafe } from "@/lib/utils";
import { TransactionsPageClient } from "@/components/pages/transactions-page-client";
import { CategoryKind } from "@/generated/prisma/client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    year?: string;
    month?: string;
    expenseCategory?: string;
    project?: string;
    method?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const now = new Date();
  const year = parseIntSafe(params.year, now.getUTCFullYear());
  const monthParam = params.month ?? String(now.getUTCMonth() + 1);
  const month = monthParam === "all" ? null : parseIntSafe(monthParam, now.getUTCMonth() + 1);

  const page = parseIntSafe(params.page, 1);
  const q = params.q ?? "";
  const projectId = params.project && params.project !== "all" ? params.project : undefined;
  const paymentMethodId = params.method && params.method !== "all" ? params.method : undefined;

  const [{ items, total, summary }, lookups] = await Promise.all([
    listTransactions({
      userId: user.id,
      page,
      pageSize: 300,
      q,
      year,
      month,
      projectId,
      paymentMethodId,
    }),
    getLookups(user.id),
  ]);

  const expenseCategories = lookups.categories
    .filter((c) => c.kind === CategoryKind.EXPENSE || c.kind === CategoryKind.SAVINGS)
    .map((x) => ({ id: x.id, name: x.name }));

  return (
    <TransactionsPageClient
      filters={{
        year,
        month: month ?? "all",
        expenseCategory: params.expenseCategory ?? "all",
        project: params.project ?? "all",
        method: params.method ?? "all",
        q,
      }}
      summary={summary}
      total={total}
      lookups={{
        categories: lookups.categories.map((x) => ({ id: x.id, name: x.name })),
        expenseCategories,
        projects: lookups.projects.map((x) => ({ id: x.id, name: x.title })),
        payees: lookups.payees.map((x) => ({ id: x.id, name: x.name })),
        paymentMethods: lookups.paymentMethods.map((x) => ({ id: x.id, name: x.name })),
      }}
      data={items.map((item) => ({
        id: item.id,
        type: item.type,
        amount: decimalToNumber(item.amount),
        occurredAt: item.occurredAt.toISOString().slice(0, 10),
        occurredAtLabel: formatUtcDate(item.occurredAt),
        description: item.description,
        notes: item.notes,
        categoryId: item.categoryId,
        projectId: item.projectId,
        payeeId: item.payeeId,
        paymentMethodId: item.paymentMethodId,
        categoryName: item.category?.name ?? "—",
        projectName: item.project?.title ?? "—",
        paymentMethodName: item.paymentMethod?.name ?? "—",
        salarySlipId: item.salarySlipId,
        employerId: item.salarySlip?.employerId ?? null,
      }))}
    />
  );
}
