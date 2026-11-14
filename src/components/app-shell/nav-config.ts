import {
  ArrowRightLeft,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Presentation,
  Repeat,
  Settings,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

/** Cookie holding the desktop sidebar's collapsed state (read on the server). */
export const SIDEBAR_COOKIE = "finsol_sidebar";

/** Window event that opens the global Quick Add sheet. */
export const QUICK_ADD_EVENT = "finsol:quick-add";

export type NavItem = {
  href: string;
  label: string;
  /** Short label for the mobile tab bar. */
  short: string;
  icon: LucideIcon;
  description?: string;
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "نظرة عامة",
    items: [
      { href: "/dashboard", label: "لوحة التحكم", short: "الرئيسية", icon: LayoutDashboard, description: "ملخص الشهر" },
      { href: "/transactions", label: "المعاملات", short: "المعاملات", icon: ArrowRightLeft, description: "كل الدخل والمصروفات" },
    ],
  },
  {
    label: "الالتزامات",
    items: [
      { href: "/subscriptions", label: "الاشتراكات", short: "الاشتراكات", icon: Repeat, description: "المدفوعات المتكررة" },
      { href: "/splits", label: "الأقساط", short: "الأقساط", icon: CreditCard, description: "مشتريات بالتقسيط" },
      { href: "/projects", label: "المشاريع", short: "المشاريع", icon: FolderKanban, description: "ميزانيات وأقساط" },
    ],
  },
  {
    label: "الادخار والدخل",
    items: [
      { href: "/savings", label: "الجمعية والادخار", short: "الادخار", icon: PiggyBank, description: "جمعيات، ذهب، دولار" },
      { href: "/salary", label: "الراتب", short: "الراتب", icon: WalletCards, description: "قسائم الرواتب" },
      { href: "/showcase", label: "التقرير السنوي", short: "التقرير", icon: Presentation, description: "سنتك بالأرقام" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "الإعدادات",
  short: "الإعدادات",
  icon: Settings,
  description: "الحساب والأمان",
};

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** Tabs pinned to the mobile bottom bar; everything else lives under "More". */
export const MOBILE_PRIMARY = ["/dashboard", "/transactions", "/subscriptions"];

const EXTRA_SEGMENT_LABELS: Record<string, string> = {
  search: "البحث",
  kupot: "קופות",
  news: "الأخبار",
  profile: "الملف الشخصي",
  security: "الأمان",
  preferences: "التفضيلات",
};

export function segmentLabel(segment: string): string | null {
  const item = ALL_NAV_ITEMS.find((i) => i.href === `/${segment}`);
  return item?.label ?? EXTRA_SEGMENT_LABELS[segment] ?? null;
}

export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
