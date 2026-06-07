import { requireUser } from "@/lib/session";
import { getKupotPageData } from "@/lib/tenant-data";
import { KupotPageClient } from "@/components/pages/kupot-page-client";

export default async function KupotPage() {
  const user = await requireUser();
  const data = await getKupotPageData(user.id);
  return <KupotPageClient data={data} />;
}
