import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function LegalLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 pb-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-8 inline-block">
          <Logo />
        </Link>
        <h1 className="mb-6 text-3xl font-extrabold text-slate-900">{title}</h1>
        <div className="prose prose-slate max-w-none space-y-4 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
        <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
          <Link href="/privacy" className="text-indigo-600 hover:underline">
            الخصوصية
          </Link>
          <Link href="/terms" className="text-indigo-600 hover:underline">
            الشروط
          </Link>
          <Link href="/support" className="text-indigo-600 hover:underline">
            الدعم
          </Link>
          <Link href="/login" className="text-indigo-600 hover:underline">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
