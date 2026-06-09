import type { Metadata } from "next";
import { SavingsNewsPageClient } from "@/components/pages/savings-news-page-client";

export const metadata: Metadata = {
  title: "أخبار الادخار",
  description: "فرص ونصائح ادخار — ذهب، دولار، عملات رقمية، وجمعيات",
};

export default function SavingsNewsPage() {
  return <SavingsNewsPageClient />;
}
