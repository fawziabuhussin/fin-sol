import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveHouseholdId } from "@/lib/household";
import { SmartInsightsFeed } from "@/components/dashboard/smart-insights-feed";
import { Button } from "@/components/ui/button";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const householdId = await getActiveHouseholdId(session.user.id);
  if (!householdId) redirect("/dashboard");

  const insights = await prisma.insight.findMany({
    where: {
      householdId,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: { validFrom: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">كل التوصيات الذكية</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard">← العودة للوحة</Link>
        </Button>
      </div>
      <SmartInsightsFeed
        insights={insights.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          title: i.title,
          body: i.body,
          actionLabel: i.actionLabel,
          actionHref: i.actionHref,
        }))}
      />
    </div>
  );
}
