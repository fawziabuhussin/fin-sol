import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-2xl space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="h-16 w-16" rounded="rounded-2xl" />
          <h1 className="text-4xl font-extrabold text-slate-900">
            Fin<span className="text-indigo-600">$</span>ol
          </h1>
        </div>
        <p className="text-lg text-slate-500">
          منصة SaaS مالية متعددة المستخدمين لإدارة المعاملات والمشاريع والادخار
          بواجهة عربية RTL.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">إنشاء حساب</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
