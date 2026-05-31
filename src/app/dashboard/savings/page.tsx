import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SavingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">الادخارات والجمعيات</h1>
      <p className="mt-2 text-gray-600">إدارة خطط الجمعية — قريباً</p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">العودة للوحة</Link>
      </Button>
    </div>
  );
}
