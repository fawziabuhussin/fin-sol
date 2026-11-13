import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { seedDefaultSubscriptions } from "@/lib/subscription-seed";
import { getLookups } from "@/lib/tenant-data";
import { getSubscriptionsOverview } from "@/lib/subscriptions-data";
import { isOwnerEmail } from "@/lib/security/owner";
import { SubscriptionsPageClient } from "@/components/pages/subscriptions-page-client";

export const metadata: Metadata = { title: "الاشتراكات" };

function parsePeriod(params: { year?: string; month?: string }) {
  const now = new Date();
  const year = Number(params.year);
  const month = Number(params.month);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
  };
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const { year, month } = parsePeriod(await searchParams);
  const isOwner = isOwnerEmail(user.email);

  // The built-in list is the original owner's personal subscriptions — never
  // seed it into anyone else's account.
  if (isOwner) {
    const count = await prisma.subscription.count({ where: { userId: user.id } });
    if (count === 0) await seedDefaultSubscriptions(user.id, prisma);
  }

  const [data, lookups] = await Promise.all([
    getSubscriptionsOverview(user.id, year, month),
    getLookups(user.id),
  ]);

  return (
    <SubscriptionsPageClient
      data={data}
      paymentMethods={lookups.paymentMethods.map((m) => ({ id: m.id, name: m.name }))}
      categories={lookups.categories
        .filter((c) => c.kind === "EXPENSE")
        .map((c) => ({ id: c.id, name: c.name }))}
      canImport={isOwner}
    />
  );
}
