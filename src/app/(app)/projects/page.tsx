import { requireUser } from "@/lib/session";
import { listProjects } from "@/lib/tenant-data";
import { decimalToNumber, parseIntSafe } from "@/lib/utils";
import { ProjectsPageClient } from "@/components/pages/projects-page-client";

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
      }))}
    />
  );
}
