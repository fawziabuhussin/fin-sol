import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLookups } from "@/lib/tenant-data";
import { getSplitPlan } from "@/lib/split-payments";
import { SplitPlanDetailClient } from "@/components/pages/split-plan-detail-client";

export const dynamic = "force-dynamic";

export default async function SplitPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireUser();
  const { planId } = await params;
  const [plan, lookups] = await Promise.all([
    getSplitPlan(user.id, planId),
    getLookups(user.id),
  ]);
  if (!plan) notFound();

  return (
    <SplitPlanDetailClient
      plan={plan}
      paymentMethods={lookups.paymentMethods.map((p) => ({
        id: p.id,
        name: p.name,
      }))}
    />
  );
}
