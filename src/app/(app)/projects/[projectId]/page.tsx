import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBuildingProjectSummary, getProjectDetail, getLookups } from "@/lib/tenant-data";
import { ProjectKind } from "@/generated/prisma/client";
import { BuildingDashboardClient } from "@/components/pages/building-dashboard-client";
import { ProjectDetailClient } from "@/components/pages/project-detail-client";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { kind: true },
  });

  if (!project) notFound();

  if (project.kind === ProjectKind.MASTER_BUILD) {
    const [summary, lookups] = await Promise.all([
      getBuildingProjectSummary(user.id, projectId),
      getLookups(user.id),
    ]);
    if (!summary) notFound();

    return (
      <BuildingDashboardClient
        summary={summary}
        paymentMethods={lookups.paymentMethods.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    );
  }

  const [detail, lookups] = await Promise.all([
    getProjectDetail(user.id, projectId),
    getLookups(user.id),
  ]);
  if (!detail) notFound();

  return (
    <ProjectDetailClient
      detail={detail}
      paymentMethods={lookups.paymentMethods.map((p) => ({
        id: p.id,
        name: p.name,
      }))}
    />
  );
}
