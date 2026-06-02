"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowRightLeft,
  FolderKanban,
  PiggyBank,
  WalletCards,
  Presentation,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/transactions", label: "معاملات", icon: ArrowRightLeft },
  { href: "/projects", label: "مشاريع", icon: FolderKanban },
  { href: "/savings", label: "ادخار", icon: PiggyBank },
  { href: "/salary", label: "راتب", icon: WalletCards },
  { href: "/showcase", label: "التقرير", icon: Presentation },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-0.5 pb-[env(safe-area-inset-bottom)] pt-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold transition-colors sm:px-1 sm:py-2 sm:text-[10px]",
                active ? "text-slate-900" : "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-colors sm:h-9 sm:w-9",
                  active ? "bg-slate-900 text-white" : "bg-transparent"
                )}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="max-w-full truncate leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
