"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PiggyBank, Landmark, Newspaper } from "lucide-react";

const tabs = [
  { href: "/savings", label: "الأصول", icon: PiggyBank, exact: true },
  { href: "/savings/news", label: "أخبار وفرص", icon: Newspaper, exact: false },
  { href: "/savings/kupot", label: "קופות", icon: Landmark, exact: false },
];

export function SavingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all sm:gap-2 sm:px-4 sm:text-sm",
              active
                ? "bg-white text-violet-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
