"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutGrid, LogOut, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  ALL_NAV_ITEMS,
  MOBILE_PRIMARY,
  isNavActive,
  type NavItem,
} from "./nav-config";

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-semibold transition-colors",
        active ? "text-indigo-600" : "text-slate-500"
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
      <span className="max-w-full truncate leading-none">{item.short}</span>
    </Link>
  );
}

export function MobileBottomNav({ onOpenQuickAdd }: { onOpenQuickAdd: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = MOBILE_PRIMARY.map((href) => ALL_NAV_ITEMS.find((i) => i.href === href)!);
  const secondary = ALL_NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.href));
  const moreActive = secondary.some((i) => isNavActive(pathname, i.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/92 backdrop-blur-xl lg:hidden"
        aria-label="التنقل"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          <Tab item={primary[0]} active={isNavActive(pathname, primary[0].href)} />
          <Tab item={primary[1]} active={isNavActive(pathname, primary[1].href)} />
          <div className="flex flex-1 items-start justify-center">
            <button
              type="button"
              onClick={onOpenQuickAdd}
              aria-label="إضافة سريعة"
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-indigo-600/30 ring-4 ring-white transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
          <Tab item={primary[2]} active={isNavActive(pathname, primary[2].href)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-semibold transition-colors",
              moreActive ? "text-indigo-600" : "text-slate-500"
            )}
          >
            <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={moreActive ? 2.25 : 1.75} />
            <span className="leading-none">المزيد</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="px-4 pb-6 pt-4">
          <SheetTitle className="px-1">كل الأقسام</SheetTitle>
          <SheetDescription className="px-1">انتقل إلى أي جزء من حسابك</SheetDescription>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {secondary.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    active
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-slate-100 bg-slate-50/60 active:bg-slate-100"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      active ? "bg-indigo-600 text-white" : "bg-white text-slate-600 shadow-card"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
                    {item.description && (
                      <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-rose-600 active:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
