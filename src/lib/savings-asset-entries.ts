import { prisma } from "@/lib/db";
import { isLocalTodayDate } from "@/lib/dates";
import { getMarketRates } from "@/lib/market-rates";
import { createAssetPurchaseTransaction } from "@/lib/savings-contribution";
import { computeAssetValueIls } from "@/lib/savings-asset-value";
import type { SavingsAsset } from "@/generated/prisma/client";

async function resolveUnitPrice(
  asset: SavingsAsset,
  purchasedAt: string,
  goldKarat: number,
  explicitUnitPrice?: number
) {
  if (asset.kind === "GOLD") {
    if (explicitUnitPrice != null && explicitUnitPrice > 0) return explicitUnitPrice;
    const rates = await getMarketRates(goldKarat as 21);
    return rates.gold.pricePerGramIls;
  }

  const useStored =
    explicitUnitPrice != null &&
    explicitUnitPrice > 0 &&
    !isLocalTodayDate(purchasedAt);
  if (useStored) return explicitUnitPrice!;

  const rates = await getMarketRates();
  return rates.usdIls;
}

export async function syncAssetFromEntries(assetId: string) {
  const asset = await prisma.savingsAsset.findUnique({
    where: { id: assetId },
    include: { entries: { orderBy: { purchasedAt: "desc" } } },
  });
  if (!asset) return null;

  const totalQty = asset.entries.reduce(
    (sum, e) => sum + Number(e.quantity),
    0
  );

  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const liveUsdIls = liveRates?.usdIls ?? null;

  let unitPrice = Number(asset.unitPrice);
  if (asset.kind === "USD" && liveUsdIls != null) {
    unitPrice = liveUsdIls;
  } else if (asset.kind === "GOLD" && asset.entries.length > 0) {
    unitPrice = Number(asset.entries[0]!.unitPrice);
  }

  const valueIls = computeAssetValueIls(
    asset.kind,
    totalQty,
    unitPrice,
    asset.kind === "USD" ? liveUsdIls : null
  );

  return prisma.savingsAsset.update({
    where: { id: assetId },
    data: { quantity: totalQty, unitPrice, valueIls },
  });
}

export async function addAssetEntry(params: {
  userId: string;
  assetId: string;
  quantity: number;
  purchasedAt: string;
  notes?: string | null;
  unitPrice?: number;
}) {
  const asset = await prisma.savingsAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
  });
  if (!asset) return null;

  const goldKarat = asset.goldKarat ?? 21;
  const unitPrice = await resolveUnitPrice(
    asset,
    params.purchasedAt,
    goldKarat,
    params.unitPrice
  );
  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const valueIls = computeAssetValueIls(
    asset.kind,
    params.quantity,
    unitPrice,
    asset.kind === "USD" && isLocalTodayDate(params.purchasedAt)
      ? liveRates?.usdIls
      : null
  );
  const purchasedAt = new Date(params.purchasedAt);

  const entry = await prisma.savingsAssetEntry.create({
    data: {
      assetId: params.assetId,
      quantity: params.quantity,
      unitPrice,
      valueIls,
      purchasedAt,
      notes: params.notes || null,
    },
  });

  const tx = await createAssetPurchaseTransaction({
    userId: params.userId,
    kind: asset.kind,
    amount: valueIls,
    occurredAt: purchasedAt,
    notes: params.notes ?? null,
  });

  await prisma.savingsAssetEntry.update({
    where: { id: entry.id },
    data: { transactionId: tx.id },
  });

  await syncAssetFromEntries(params.assetId);
  return entry;
}

export async function updateAssetEntry(params: {
  userId: string;
  assetId: string;
  entryId: string;
  quantity?: number;
  purchasedAt?: string;
  notes?: string | null;
}) {
  const asset = await prisma.savingsAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
  });
  if (!asset) return null;

  const existing = await prisma.savingsAssetEntry.findFirst({
    where: { id: params.entryId, assetId: params.assetId },
  });
  if (!existing) return null;

  const quantity =
    params.quantity !== undefined ? params.quantity : Number(existing.quantity);
  const purchasedAtStr =
    params.purchasedAt ?? existing.purchasedAt.toISOString().slice(0, 10);
  const goldKarat = asset.goldKarat ?? 21;

  let unitPrice = Number(existing.unitPrice);
  if (asset.kind === "GOLD" && params.purchasedAt !== undefined) {
    unitPrice = await resolveUnitPrice(asset, purchasedAtStr, goldKarat);
  } else if (
    asset.kind === "USD" &&
    params.purchasedAt !== undefined &&
    isLocalTodayDate(purchasedAtStr)
  ) {
    unitPrice = await resolveUnitPrice(asset, purchasedAtStr, goldKarat);
  }

  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const valueIls = computeAssetValueIls(
    asset.kind,
    quantity,
    unitPrice,
    asset.kind === "USD" && isLocalTodayDate(purchasedAtStr)
      ? liveRates?.usdIls
      : null
  );
  const purchasedAt = new Date(purchasedAtStr);

  const entry = await prisma.savingsAssetEntry.update({
    where: { id: params.entryId },
    data: {
      quantity,
      unitPrice,
      valueIls,
      purchasedAt,
      ...(params.notes !== undefined ? { notes: params.notes || null } : {}),
    },
  });

  if (existing.transactionId) {
    await prisma.transaction.update({
      where: { id: existing.transactionId },
      data: { amount: valueIls, occurredAt: purchasedAt },
    });
  } else {
    const tx = await createAssetPurchaseTransaction({
      userId: params.userId,
      kind: asset.kind,
      amount: valueIls,
      occurredAt: purchasedAt,
      notes: params.notes ?? existing.notes,
    });
    await prisma.savingsAssetEntry.update({
      where: { id: entry.id },
      data: { transactionId: tx.id },
    });
  }

  await syncAssetFromEntries(params.assetId);
  return entry;
}

export async function deleteAssetEntry(params: {
  userId: string;
  assetId: string;
  entryId: string;
}) {
  const asset = await prisma.savingsAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
  });
  if (!asset) return false;

  const existing = await prisma.savingsAssetEntry.findFirst({
    where: { id: params.entryId, assetId: params.assetId },
  });
  if (!existing) return false;

  if (existing.transactionId) {
    await prisma.transaction
      .delete({ where: { id: existing.transactionId } })
      .catch(() => null);
  }

  await prisma.savingsAssetEntry.delete({ where: { id: params.entryId } });
  await syncAssetFromEntries(params.assetId);
  return true;
}
