import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getEmployerDetail } from "@/lib/tenant-data";
import { parseIntSafe } from "@/lib/utils";
import { EmployerDetailClient } from "@/components/pages/employer-detail-client";

export default async function EmployerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ employerId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  const { employerId } = await params;
  const sp = await searchParams;
  const year = parseIntSafe(sp.year, 2026);

  const detail = await getEmployerDetail(user.id, employerId, year);
  if (!detail) notFound();

  return <EmployerDetailClient detail={detail} />;
}
