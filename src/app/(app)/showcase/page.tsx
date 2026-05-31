import { requireUser } from "@/lib/session";
import { getAnnualShowcaseData } from "@/lib/tenant-data";
import { parseIntSafe } from "@/lib/utils";
import { AnnualShowcaseClient } from "@/components/pages/annual-showcase-client";

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const year = parseIntSafe(params.year, 2026);
  const data = await getAnnualShowcaseData(user.id, year);

  return <AnnualShowcaseClient data={data} />;
}
