import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { seedDefaultSubscriptions } from "@/lib/subscription-seed";
import { getLookups, getSubscriptionsMonthly } from "@/lib/tenant-data";
import { SubscriptionsPageClient } from "@/components/pages/subscriptions-page-client";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const subCount = await prisma.subscription.count({
    where: { userId: user.id },
  });
  if (subCount === 0) {
    await seedDefaultSubscriptions(user.id, prisma);
  }

  const [data, lookups] = await Promise.all([
    getSubscriptionsMonthly(user.id, year, month),
    getLookups(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">الاشتراكات الشهرية</h1>
        <p className="mt-1 text-sm text-slate-500">
          اشتراكات متكررة — اضغط ✓ عند الدفع لإضافتها للمصروفات
        </p>
      </div>
      <SubscriptionsPageClient
        data={data}
        paymentMethods={lookups.paymentMethods}
      />
    </div>
  );
}
