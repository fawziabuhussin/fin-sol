"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelRightClose, PanelRightOpen, LifeBuoy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import { NAV_GROUPS, SETTINGS_ITEM, isNavActive, type NavItem } from "./nav-config";

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
        collapsed && "justify-center px-0"
      )}
    >
      {active && (
        <span className="absolute inset-y-2 right-0 w-[3px] rounded-l-full bg-indigo-600" aria-hidden />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

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
        "sticky top-0 flex h-dvh flex-col border-l border-hairline bg-white transition-[width] duration-200",
        collapsed ? "w-[76px] px-2.5" : "w-[264px] px-4"
      )}
    >
      <div
        className={cn(
          "flex h-[72px] shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/dashboard" aria-label="الرئيسية">
          {collapsed ? <LogoMark className="h-10 w-10" /> : <Logo />}
        </Link>
        {!collapsed && (
          <button
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            onClick={onToggle}
            aria-label="طي القائمة"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1 py-2" aria-label="التنقل الرئيسي">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-slate-100" aria-hidden />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  active={isNavActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-slate-100 py-3">
        <NavLink
          item={SETTINGS_ITEM}
          collapsed={collapsed}
          active={isNavActive(pathname, SETTINGS_ITEM.href)}
        />
        {collapsed ? (
          <button
            className="flex w-full justify-center rounded-xl py-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onToggle}
            aria-label="توسيع القائمة"
          >
            <PanelRightOpen className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              بياناتك خاصة بك وحدك
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <Link href="/support" className="inline-flex items-center gap-1 hover:text-slate-800">
                <LifeBuoy className="h-3 w-3" /> الدعم
              </Link>
              <Link href="/privacy" className="hover:text-slate-800">الخصوصية</Link>
              <Link href="/terms" className="hover:text-slate-800">الشروط</Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
