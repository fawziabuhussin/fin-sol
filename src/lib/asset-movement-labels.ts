import {
  assetKindDisplayLabel,
  type SavingsAssetKindKey,
} from "@/lib/savings-asset-kinds";

export type AssetMovementKind = SavingsAssetKindKey;
export type AssetMovementType = "PURCHASE" | "WITHDRAWAL";

export type AssetMovementMeta = {
  type: AssetMovementType;
  asset: AssetMovementKind;
  label?: string;
};

export function assetMovementDescription(
  type: AssetMovementType,
  asset: { kind: AssetMovementKind; title?: string | null }
) {
  const label = assetKindDisplayLabel(asset.kind, asset.title ?? undefined);
  return type === "PURCHASE" ? `شراء ${label} — ادخار` : `سحب ${label} — ادخار`;
}

function labelToKind(label: string): AssetMovementKind {
  if (label === "دولار") return "USD";
  if (label === "ذهب") return "GOLD";
  if (label === "فضة" || label.includes("فضة")) return "SILVER";
  if (label.includes("رقم") || label.includes("كريبتو")) return "CRYPTO";
  return "CUSTOM";
}

export function parseAssetMovementDescription(
  description: string | null | undefined
): AssetMovementMeta | null {
  if (!description) return null;
  const withdrawal = description.match(/(?:سحب ادخار —|سحب) (.+?)(?:\s*—|$)/);
  if (withdrawal) {
    const label = withdrawal[1]!.trim();
    return {
      type: "WITHDRAWAL",
      asset: labelToKind(label),
      label,
    };
  }
  const purchase = description.match(/(?:ادخار —|شراء) (.+?)(?:\s*—|$)/);
  if (purchase) {
    const label = purchase[1]!.trim();
    return {
      type: "PURCHASE",
      asset: labelToKind(label),
      label,
    };
  }
  return null;
}

export function assetMovementShortLabel(meta: AssetMovementMeta) {
  const label = meta.label ?? assetKindDisplayLabel(meta.asset);
  return meta.type === "PURCHASE" ? `شراء ${label}` : `سحب ${label}`;
}

export function assetMovementFromEntry(entry: {
  quantity: { toString(): string };
  asset: { kind: AssetMovementKind; title?: string | null };
}): AssetMovementMeta {
  const qty = Number(entry.quantity);
  return {
    type: qty < 0 ? "WITHDRAWAL" : "PURCHASE",
    asset: entry.asset.kind,
    label: assetKindDisplayLabel(entry.asset.kind, entry.asset.title ?? undefined),
  };
}

export function isAssetPurchaseDescription(description: string | null | undefined) {
  return parseAssetMovementDescription(description)?.type === "PURCHASE";
}

export function isAssetWithdrawalDescription(description: string | null | undefined) {
  return parseAssetMovementDescription(description)?.type === "WITHDRAWAL";
}
