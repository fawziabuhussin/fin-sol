"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo, LogoMark } from "@/components/brand/logo";

const segmentLabel: Record<string, string> = {
  dashboard: "لوحة التحكم",
  transactions: "المعاملات",
  projects: "المشاريع",
  savings: "الجمعية",
  salary: "الراتب",
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

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/70 px-3 py-3 shadow-sm backdrop-blur-xl backdrop-saturate-150 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="الرئيسية">
            <LogoMark className="h-9 w-9" />
          </Link>
          <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold text-slate-900 sm:text-lg">
            {currentPage}
          </p>
          <nav className="mt-0.5 hidden items-center gap-2 text-xs text-slate-500 sm:flex">
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <form action="/search" className="relative hidden md:block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="بحث..."
              className="w-44 rounded-full border-transparent bg-slate-100/80 pr-9 transition-all focus-visible:w-56 focus-visible:border-slate-200 focus-visible:bg-white lg:w-60 lg:focus-visible:w-72"
            />
          </form>

          <Button
            onClick={onOpenQuickAdd}
            className="h-9 gap-1.5 rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 px-3.5 text-white shadow-md shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:shadow-indigo-500/30 sm:h-10 sm:px-5"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">إضافة سريعة</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50">
                <span className="hidden max-w-[100px] truncate sm:inline">
                  {userName ?? "الحساب"}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                  {(userName ?? "؟").trim().charAt(0)}
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
