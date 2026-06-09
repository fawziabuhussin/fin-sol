import type { SavingsAssetKind } from "@/generated/prisma/client";

export type SavingsAssetKindKey = SavingsAssetKind;

export type AssetKindConfig = {
  kind: SavingsAssetKindKey;
  label: string;
  defaultTitle: string;
  defaultUnitLabel: string;
  quantityLabel: string;
  unitSuffix: string;
  singleton: boolean;
  liveRate: boolean;
  manualUnitPrice: boolean;
  border: string;
  gradient: string;
  iconBg: string;
  valueColor: string;
  chartFill: string;
};

export const ASSET_KIND_CONFIG: Record<SavingsAssetKindKey, AssetKindConfig> = {
  GOLD: {
    kind: "GOLD",
    label: "ذهب",
    defaultTitle: "ذهب",
    defaultUnitLabel: "غرام",
    quantityLabel: "الوزن (غرام)",
    unitSuffix: " غ",
    singleton: true,
    liveRate: true,
    manualUnitPrice: false,
    border: "border-amber-200",
    gradient: "from-amber-50 via-white to-orange-50",
    iconBg: "bg-amber-100/80",
    valueColor: "text-amber-700",
    chartFill: "#f59e0b",
  },
  USD: {
    kind: "USD",
    label: "دولار",
    defaultTitle: "دولار أمريكي",
    defaultUnitLabel: "دولار",
    quantityLabel: "المبلغ ($)",
    unitSuffix: " $",
    singleton: true,
    liveRate: true,
    manualUnitPrice: false,
    border: "border-emerald-200",
    gradient: "from-emerald-50 via-white to-teal-50",
    iconBg: "bg-emerald-100/80",
    valueColor: "text-emerald-700",
    chartFill: "#059669",
  },
  SILVER: {
    kind: "SILVER",
    label: "فضة",
    defaultTitle: "فضة / ميداليات",
    defaultUnitLabel: "غرام",
    quantityLabel: "الوزن (غرام)",
    unitSuffix: " غ",
    singleton: false,
    liveRate: false,
    manualUnitPrice: true,
    border: "border-slate-300",
    gradient: "from-slate-50 via-white to-zinc-50",
    iconBg: "bg-slate-200/80",
    valueColor: "text-slate-700",
    chartFill: "#64748b",
  },
  CRYPTO: {
    kind: "CRYPTO",
    label: "عملات رقمية",
    defaultTitle: "عملات رقمية",
    defaultUnitLabel: "وحدة",
    quantityLabel: "الكمية",
    unitSuffix: "",
    singleton: false,
    liveRate: false,
    manualUnitPrice: true,
    border: "border-violet-200",
    gradient: "from-violet-50 via-white to-purple-50",
    iconBg: "bg-violet-100/80",
    valueColor: "text-violet-700",
    chartFill: "#7c3aed",
  },
  CUSTOM: {
    kind: "CUSTOM",
    label: "أصل مخصّص",
    defaultTitle: "ادخار آخر",
    defaultUnitLabel: "وحدة",
    quantityLabel: "الكمية",
    unitSuffix: "",
    singleton: false,
    liveRate: false,
    manualUnitPrice: true,
    border: "border-indigo-200",
    gradient: "from-indigo-50 via-white to-blue-50",
    iconBg: "bg-indigo-100/80",
    valueColor: "text-indigo-700",
    chartFill: "#6366f1",
  },
};

export const ADDABLE_ASSET_KINDS: SavingsAssetKindKey[] = [
  "GOLD",
  "USD",
  "SILVER",
  "CRYPTO",
  "CUSTOM",
];

export function getAssetKindConfig(
  kind: SavingsAssetKindKey,
  unitLabel?: string | null
): AssetKindConfig {
  const base = ASSET_KIND_CONFIG[kind];
  if (!unitLabel?.trim()) return base;
  const suffix = unitLabel.trim() === "دولار" ? " $" : ` ${unitLabel.trim()}`;
  return {
    ...base,
    unitSuffix: kind === "USD" ? " $" : suffix,
    quantityLabel: `الكمية (${unitLabel.trim()})`,
  };
}

export function assetKindDisplayLabel(
  kind: SavingsAssetKindKey,
  title?: string
) {
  if (kind === "CUSTOM" && title?.trim()) return title.trim();
  return ASSET_KIND_CONFIG[kind].label;
}

export function isSingletonAssetKind(kind: SavingsAssetKindKey) {
  return ASSET_KIND_CONFIG[kind].singleton;
}
