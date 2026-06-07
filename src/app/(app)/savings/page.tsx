import { requireUser } from "@/lib/session";
import { getSavingsSummary, listSavings } from "@/lib/tenant-data";
import { decimalToNumber } from "@/lib/utils";
import { SavingsPageClient } from "@/components/pages/savings-page-client";
import { SavingsSummary } from "@/components/pages/savings-summary";
import { SavingsTabs } from "@/components/savings/savings-tabs";

export default async function SavingsPage() {
  const user = await requireUser();
  const [items, summary] = await Promise.all([
    listSavings(user.id),
    getSavingsSummary(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">الجمعية والادخار</h1>
        <p className="mt-1 text-sm text-slate-500">
          ملخّص شامل للجمعيات والأصول (ذهب ودولار)
        </p>
      </div>

      <SavingsTabs />

      <SavingsSummary data={summary} showKupotLink />

      <SavingsPageClient
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          monthlyContribution: decimalToNumber(item.monthlyContribution),
          targetAmount: item.targetAmount ? decimalToNumber(item.targetAmount) : null,
          status: item.status,
        }))}
      />
    </div>
  );
}
