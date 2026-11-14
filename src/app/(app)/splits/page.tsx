import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getLookups } from "@/lib/tenant-data";
import { listSplitPlans } from "@/lib/split-payments";
import { SplitsPageClient } from "@/components/pages/splits-page-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الأقساط" };

export default async function SplitsPage() {
  const user = await requireUser();
  const [items, lookups] = await Promise.all([listSplitPlans(user.id), getLookups(user.id)]);

  return (
    <SplitsPageClient
      items={items}
      categories={lookups.categories
        .filter((c) => c.kind === "EXPENSE")
        .map((c) => ({ id: c.id, name: c.name }))}
      paymentMethods={lookups.paymentMethods.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
