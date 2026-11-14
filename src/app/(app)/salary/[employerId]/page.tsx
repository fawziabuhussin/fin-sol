import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getEmployerDetail } from "@/lib/tenant-data";
import { parseIntSafe } from "@/lib/utils";
import { currentPeriod } from "@/lib/period";
import { EmployerDetailClient } from "@/components/pages/employer-detail-client";

export const metadata: Metadata = { title: "رواتب جهة العمل" };

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
  const now = currentPeriod();
  const y = parseIntSafe(sp.year, now.year);
  const year = y >= 2000 && y <= 2100 ? y : now.year;

  const detail = await getEmployerDetail(user.id, employerId, year);
  if (!detail) notFound();

  const existing = Object.fromEntries(
    detail.months.filter((m) => m.exists).map((m) => [`${detail.id}:${year}:${m.month}`, m.effectiveNet])
  );

  return <EmployerDetailClient detail={detail} currentPeriod={now} existing={existing} />;
}
