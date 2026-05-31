"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import {
  LayoutDashboard,
  ArrowRightLeft,
  FolderKanban,
  PiggyBank,
  WalletCards,
  Settings,
  Presentation,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/transactions", label: "المعاملات", icon: ArrowRightLeft },
  { href: "/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/savings", label: "الجمعية والادخار", icon: PiggyBank },
  { href: "/salary", label: "متابعة الراتب", icon: WalletCards },
  { href: "/showcase", label: "التقرير السنوي", icon: Presentation },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen border-l border-slate-100 bg-white p-3",
        collapsed ? "w-[90px]" : "w-[260px]"
      )}
    >
      <div
        className={cn(
          "mb-6 flex gap-2",
          collapsed ? "flex-col items-center" : "items-center justify-between"
        )}
      >
        <Link href="/dashboard" aria-label="الرئيسية">
          {collapsed ? <LogoMark className="h-10 w-10" /> : <Logo />}
        </Link>
        <button
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={onToggle}
          aria-label="toggle sidebar"
        >
          {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                collapsed && "justify-center"
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
