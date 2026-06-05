"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const segmentLabel: Record<string, string> = {
  dashboard: "لوحة التحكم",
  transactions: "المعاملات",
  projects: "المشاريع",
  savings: "الجمعية والادخار",
  salary: "متابعة الراتب",
  showcase: "التقرير السنوي",
  settings: "الإعدادات",
  search: "البحث",
};

export function TopHeader({
  onOpenQuickAdd,
  userName,
}: {
  onOpenQuickAdd: () => void;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentPage = segmentLabel[segments[0] ?? ""] ?? "المالية الذكية";
  const initial = (userName ?? "؟").trim().charAt(0).toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl backdrop-saturate-150",
        "pt-[env(safe-area-inset-top,0px)]"
      )}
    >
      {/* Mobile / native — compact branded bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 lg:hidden">
        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-2.5"
          aria-label="الرئيسية"
        >
          <LogoMark className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold leading-none text-slate-900">
              Fin<span className="text-indigo-600">$</span>ol
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {currentPage}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            onClick={onOpenQuickAdd}
            size="icon"
            className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
            aria-label="إضافة سريعة"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-indigo-700 shadow-sm"
                aria-label="الحساب"
              >
                {initial}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">الملف الشخصي</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/security">الأمان</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden items-center justify-between gap-2 px-6 py-4 lg:flex">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Logo showSubtitle={false} markClassName="h-10 w-10" />
          <div className="min-w-0 border-r border-slate-200 pr-4">
            <p className="truncate text-lg font-extrabold text-slate-900">{currentPage}</p>
            <nav className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <Link href="/dashboard" className="hover:text-slate-700">
                الرئيسية
              </Link>
              {segments.map((segment) => (
                <span key={segment} className="flex items-center gap-2">
                  <span>/</span>
                  <span className="text-slate-700">
                    {segmentLabel[segment] ?? segment}
                  </span>
                </span>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <Button
            onClick={onOpenQuickAdd}
            className="h-10 gap-1.5 rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 px-5 text-white shadow-md shadow-indigo-500/25"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            إضافة سريعة
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                <span className="max-w-[120px] truncate">{userName ?? "الحساب"}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                  {initial}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">الملف الشخصي</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/security">الأمان</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
