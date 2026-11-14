import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLookups } from "@/lib/tenant-data";
import { getSplitPlan } from "@/lib/split-payments";
import { SplitPlanDetailClient } from "@/components/pages/split-plan-detail-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تفاصيل التقسيط" };

export default async function SplitPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireUser();
  const { planId } = await params;
  const [plan, lookups] = await Promise.all([getSplitPlan(user.id, planId), getLookups(user.id)]);
  if (!plan) notFound();

  return (
    <SplitPlanDetailClient
      plan={plan}
      categories={lookups.categories
        .filter((c) => c.kind === "EXPENSE")
        .map((c) => ({ id: c.id, name: c.name }))}
      paymentMethods={lookups.paymentMethods.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
