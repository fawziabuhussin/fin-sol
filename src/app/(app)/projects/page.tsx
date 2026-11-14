import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { listProjects } from "@/lib/tenant-data";
import { decimalToNumber, parseIntSafe } from "@/lib/utils";
import { ProjectsPageClient } from "@/components/pages/projects-page-client";

export const metadata: Metadata = { title: "المشاريع" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const page = parseIntSafe(params.page, 1);
  const q = params.q ?? "";

  const { items } = await listProjects({ userId: user.id, page, pageSize: 50, q });

  // Spent so far = expenses on the project and on its nested items (like Building).
  const ids = items.map((p) => p.id);
  const children = await prisma.project.findMany({
    where: { userId: user.id, parentProjectId: { in: ids } },
    select: { id: true, parentProjectId: true },
  });
  const rootOf = new Map<string, string>(ids.map((id) => [id, id]));
  for (const c of children) rootOf.set(c.id, c.parentProjectId!);
  const spentRows = await prisma.transaction.groupBy({
    by: ["projectId"],
    where: { userId: user.id, type: "EXPENSE", projectId: { in: [...rootOf.keys()] } },
    _sum: { amount: true },
  });
  const spent = new Map<string, number>();
  for (const r of spentRows) {
    const root = rootOf.get(r.projectId!)!;
    spent.set(root, (spent.get(root) ?? 0) + decimalToNumber(r._sum.amount));
  }

  return (
    <ProjectsPageClient
      search={q}
      data={items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        totalBudget: item.totalBudget ? decimalToNumber(item.totalBudget) : null,
        targetDate: item.targetDate ? item.targetDate.toISOString().slice(0, 10) : null,
        status: item.status,
        spent: spent.get(item.id) ?? 0,
        itemCount: children.filter((c) => c.parentProjectId === item.id).length,
      }))}
    />
  );
}
