import { requireUser } from "@/lib/session";
import { getLookups } from "@/lib/tenant-data";
import { listSplitPlans } from "@/lib/split-payments";
import { SplitsPageClient } from "@/components/pages/splits-page-client";

export const dynamic = "force-dynamic";

export default async function SplitsPage() {
  const user = await requireUser();
  let items: Awaited<ReturnType<typeof listSplitPlans>> = [];
  try {
    items = await listSplitPlans(user.id);
  } catch (error) {
    console.error("[splits] list failed", error);
  }
  const lookups = await getLookups(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">الأقساط</h1>
        <p className="mt-1 text-sm text-slate-500">
          مصاريف يومية مقسّمة على أشهر — ليست مشاريع. عدّل قسطاً واحداً أو كل
          الدفعات المعلّقة معاً.
        </p>
      </div>
      <SplitsPageClient
        items={items}
        categories={lookups.categories
          .filter((c) => c.kind === "EXPENSE")
          .map((c) => ({ id: c.id, name: c.name }))}
        paymentMethods={lookups.paymentMethods.map((p) => ({
          id: p.id,
          name: p.name,
        }))}
      />
    </div>
  );
}
