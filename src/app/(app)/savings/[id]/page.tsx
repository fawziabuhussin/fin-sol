import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSavingsPlanDetail } from "@/lib/tenant-data";
import { SavingsDetailClient } from "@/components/pages/savings-detail-client";

export default async function SavingsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const detail = await getSavingsPlanDetail(user.id, id);
  if (!detail) notFound();

  return <SavingsDetailClient detail={detail} />;
}
