"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronLeft, LogOut, Plus, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { segmentLabel } from "./nav-config";

function UserMenu({
  userName,
  userEmail,
  compact,
}: {
  userName?: string | null;
  userEmail?: string | null;
  compact?: boolean;
}) {
  const initial = (userName ?? userEmail ?? "؟").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="قائمة الحساب"
          className={cn(
            "flex items-center gap-2 rounded-full transition-colors",
            compact
              ? "p-0.5"
              : "border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-slate-700 shadow-card hover:bg-slate-50"
          )}
        >
          {!compact && <span className="max-w-[140px] truncate">{userName ?? "حسابي"}</span>}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white ring-2 ring-white">
            {initial}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-slate-900">{userName ?? "حسابي"}</span>
          {userEmail && <span className="block truncate text-xs text-slate-500" dir="ltr">{userEmail}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings#profile"><UserRound /> الملف الشخصي</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#security"><ShieldCheck /> الأمان وكلمة المرور</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings /> الإعدادات</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 [&_svg]:text-rose-500"
          onSelect={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopHeader({
  onOpenQuickAdd,
  userName,
  userEmail,
}: {
  onOpenQuickAdd: () => void;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments
    .map((segment, i) => ({
      label: segmentLabel(segment),
      href: `/${segments.slice(0, i + 1).join("/")}`,
    }))
    .filter((c): c is { label: string; href: string } => Boolean(c.label));
  const currentPage = crumbs.at(-1)?.label ?? "Fin$ol";

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl backdrop-saturate-150">
      {/* Mobile / native */}
      <div className="flex h-14 items-center justify-between gap-2 px-4 lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" aria-label="الرئيسية">
          <LogoMark className="h-8 w-8 shrink-0" rounded="rounded-[10px]" />
          <span className="truncate text-base font-bold tracking-tight text-slate-900">{currentPage}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="بحث">
            <Link href="/search"><Search className="h-[18px] w-[18px]" /></Link>
          </Button>
          <UserMenu userName={userName} userEmail={userEmail} compact />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden h-[72px] items-center justify-between gap-6 px-8 lg:flex">
        <div className="min-w-0">
          <nav className="flex items-center gap-1 text-xs text-slate-400" aria-label="مسار الصفحة">
            <Link href="/dashboard" className="hover:text-slate-700">الرئيسية</Link>
            {crumbs
              .filter((c) => c.href !== "/dashboard")
              .map((c) => (
                <span key={c.href} className="flex items-center gap-1">
                  <ChevronLeft className="h-3 w-3" />
                  <Link href={c.href} className="hover:text-slate-700">{c.label}</Link>
                </span>
              ))}
          </nav>
          <p className="mt-0.5 truncate text-lg font-bold tracking-tight text-slate-900">{currentPage}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString().trim();
              if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="search"
              placeholder="ابحث في معاملاتك ومشاريعك…"
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50/80 pl-3 pr-9 text-sm text-slate-900 transition-[width,border-color,background-color] placeholder:text-slate-400 focus:w-80 focus:border-indigo-400 focus:bg-white focus:outline-none xl:w-72"
            />
          </form>
          <Button onClick={onOpenQuickAdd} variant="brand" className="h-10 rounded-xl px-4">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            إضافة سريعة
          </Button>
          <UserMenu userName={userName} userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
