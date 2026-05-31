import { requireUser } from "@/lib/session";
import { listSavings } from "@/lib/tenant-data";
import { decimalToNumber } from "@/lib/utils";
import { SavingsPageClient } from "@/components/pages/savings-page-client";

export default async function SavingsPage() {
  const user = await requireUser();
  const items = await listSavings(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">الجمعية والادخار</h1>
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
