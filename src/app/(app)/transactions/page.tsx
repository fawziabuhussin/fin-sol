import { requireUser } from "@/lib/session";
import { getLookups, listTransactions } from "@/lib/tenant-data";
import { decimalToNumber, parseIntSafe } from "@/lib/utils";
import { TransactionsPageClient } from "@/components/pages/transactions-page-client";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    year?: string;
    month?: string;
    type?: string;
    category?: string;
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
  const type = params.type && params.type !== "all" ? params.type : undefined;
  const categoryId = params.category && params.category !== "all" ? params.category : undefined;
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
      type,
      categoryId,
      projectId,
      paymentMethodId,
    }),
    getLookups(user.id),
  ]);

  return (
    <TransactionsPageClient
      filters={{
        year,
        month: month ?? "all",
        type: params.type ?? "all",
        category: params.category ?? "all",
        project: params.project ?? "all",
        method: params.method ?? "all",
        q,
      }}
      summary={summary}
      total={total}
      lookups={{
        categories: lookups.categories.map((x) => ({ id: x.id, name: x.name })),
        projects: lookups.projects.map((x) => ({ id: x.id, name: x.title })),
        payees: lookups.payees.map((x) => ({ id: x.id, name: x.name })),
        paymentMethods: lookups.paymentMethods.map((x) => ({ id: x.id, name: x.name })),
      }}
      data={items.map((item) => ({
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
        categoryName: item.category?.name ?? "—",
        projectName: item.project?.title ?? "—",
        paymentMethodName: item.paymentMethod?.name ?? "—",
      }))}
    />
  );
}
