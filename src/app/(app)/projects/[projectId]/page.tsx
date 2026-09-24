import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getBuildingProjectSummary, getProjectDetail, getLookups } from "@/lib/tenant-data";
import {
  isTopLevelMaster,
  promoteMasterPaymentPlansToChildren,
} from "@/lib/project-tree";
import { seedWeddingVendorsIfEmpty } from "@/lib/wedding-vendors";
import { ensureDbSchema } from "@/lib/ensure-schema";
import { BuildingDashboardClient } from "@/components/pages/building-dashboard-client";
import { ProjectDetailClient } from "@/components/pages/project-detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { kind: true, parentProjectId: true },
  });

  if (!project) notFound();

  await ensureDbSchema();

  if (isTopLevelMaster(project)) {
    try {
      await promoteMasterPaymentPlansToChildren(user.id, projectId);
    } catch (error) {
      console.error("[projects] promote payment plans failed", error);
    }
    try {
      await seedWeddingVendorsIfEmpty(user.id, projectId);
    } catch (error) {
      console.error("[projects] seed wedding vendors failed", error);
    }
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
