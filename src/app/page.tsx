import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">المالية الذكية</h1>
        <p className="mt-3 max-w-lg text-lg text-gray-600">
          نظام تشغيل مالي ذكي — تدفق نقدي، بناء، جمعيات، وتوصيات استثمارية
          مبنية على بياناتك.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/login">تسجيل الدخول</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/register">إنشاء حساب</Link>
        </Button>
      </div>
    </div>
  );
}
