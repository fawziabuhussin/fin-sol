import { prisma } from "@/lib/db";
import { isLocalTodayDate } from "@/lib/dates";
import { getMarketRates } from "@/lib/market-rates";
import { assetMovementDescription } from "@/lib/asset-movement-labels";
import {
  createAssetPurchaseTransaction,
  createAssetWithdrawalTransaction,
} from "@/lib/savings-contribution";
import { upsertUsdBankFeeTransaction } from "@/lib/usd-bank-fee";
import { computeAssetValueIls } from "@/lib/savings-asset-value";
import type { SavingsAsset } from "@/generated/prisma/client";

export type AssetEntryType = "PURCHASE" | "WITHDRAWAL";

async function resolveUnitPrice(
  asset: SavingsAsset,
  purchasedAt: string,
  goldKarat: number,
  explicitUnitPrice?: number
) {
  if (asset.kind === "SILVER" || asset.kind === "CRYPTO" || asset.kind === "CUSTOM") {
    if (explicitUnitPrice != null && explicitUnitPrice > 0) return explicitUnitPrice;
    const stored = Number(asset.unitPrice);
    if (stored > 0) return stored;
    throw new Error("UNIT_PRICE_REQUIRED");
  }

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

async function currentBalance(assetId: string, excludeEntryId?: string) {
  const entries = await prisma.savingsAssetEntry.findMany({
    where: { assetId },
    select: { id: true, quantity: true },
  });
  return entries
    .filter((e) => e.id !== excludeEntryId)
    .reduce((sum, e) => sum + Number(e.quantity), 0);
}

function signedQuantity(type: AssetEntryType, quantity: number) {
  return type === "WITHDRAWAL" ? -Math.abs(quantity) : Math.abs(quantity);
}

function entryTypeFromQuantity(quantity: number): AssetEntryType {
  return quantity < 0 ? "WITHDRAWAL" : "PURCHASE";
}

async function upsertEntryTransaction(params: {
  userId: string;
  asset: SavingsAsset;
  entryType: AssetEntryType;
  valueIls: number;
  purchasedAt: Date;
  notes?: string | null;
  existingTransactionId?: string | null;
}) {
  const amount = Math.abs(params.valueIls);

  if (params.existingTransactionId) {
    const existingTx = await prisma.transaction.findUnique({
      where: { id: params.existingTransactionId },
    });
    if (existingTx) {
      const switchingType =
        (params.entryType === "WITHDRAWAL" &&
          existingTx.type !== "INCOME") ||
        (params.entryType === "PURCHASE" &&
          existingTx.type !== "SAVINGS_CONTRIBUTION");

      if (switchingType) {
        await prisma.transaction
          .delete({ where: { id: params.existingTransactionId } })
          .catch(() => null);
      } else {
        await prisma.transaction.update({
          where: { id: params.existingTransactionId },
          data: {
            amount,
            occurredAt: params.purchasedAt,
            description: assetMovementDescription(
              params.entryType,
              params.asset
            ),
          },
        });
        return params.existingTransactionId;
      }
    }
  }

  const tx =
    params.entryType === "WITHDRAWAL"
      ? await createAssetWithdrawalTransaction({
          userId: params.userId,
          kind: params.asset.kind,
          title: params.asset.title,
          amount,
          occurredAt: params.purchasedAt,
          notes: params.notes ?? null,
        })
      : await createAssetPurchaseTransaction({
          userId: params.userId,
          kind: params.asset.kind,
          title: params.asset.title,
          amount,
          occurredAt: params.purchasedAt,
          notes: params.notes ?? null,
        });

  return tx.id;
}

export async function syncAssetFromEntries(assetId: string) {
  const asset = await prisma.savingsAsset.findUnique({
    where: { id: assetId },
    include: { entries: { orderBy: { purchasedAt: "desc" } } },
  });
  if (!asset) return null;

  const totalQty = Math.max(
    0,
    asset.entries.reduce((sum, e) => sum + Number(e.quantity), 0)
  );

  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const liveUsdIls = liveRates?.usdIls ?? null;

  let unitPrice = Number(asset.unitPrice);
  if (asset.kind === "USD" && liveUsdIls != null) {
    unitPrice = liveUsdIls;
  } else if (asset.kind === "GOLD" && asset.entries.length > 0) {
    const latestPurchase = asset.entries.find((e) => Number(e.quantity) > 0);
    if (latestPurchase) unitPrice = Number(latestPurchase.unitPrice);
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

async function syncUsdBankFee(params: {
  userId: string;
  asset: SavingsAsset;
  entryType: AssetEntryType;
  bankFeeIls?: number | null;
  dollarQuantity: number;
  purchasedAt: Date;
  existingFeeTransactionId?: string | null;
}) {
  if (params.asset.kind !== "USD" || params.entryType !== "PURCHASE") {
    if (params.existingFeeTransactionId) {
      await prisma.transaction
        .delete({ where: { id: params.existingFeeTransactionId } })
        .catch(() => null);
    }
    return { feeTransactionId: null as string | null, bankFeeIls: null as number | null };
  }

  const fee = params.bankFeeIls != null && params.bankFeeIls > 0 ? params.bankFeeIls : 0;
  const feeTransactionId = await upsertUsdBankFeeTransaction({
    userId: params.userId,
    amount: fee,
    occurredAt: params.purchasedAt,
    dollarQuantity: params.dollarQuantity,
    existingTransactionId: params.existingFeeTransactionId,
  });

  return {
    feeTransactionId,
    bankFeeIls: fee > 0 ? fee : null,
  };
}

export async function addAssetEntry(params: {
  userId: string;
  assetId: string;
  type?: AssetEntryType;
  quantity: number;
  purchasedAt: string;
  notes?: string | null;
  unitPrice?: number;
  bankFeeIls?: number;
}) {
  const asset = await prisma.savingsAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
  });
  if (!asset) return null;

  const entryType = params.type ?? "PURCHASE";
  const absQty = Math.abs(params.quantity);

  if (entryType === "WITHDRAWAL") {
    const balance = await currentBalance(params.assetId);
    if (absQty > balance) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
  }

  const goldKarat = asset.goldKarat ?? 21;
  const unitPrice = await resolveUnitPrice(
    asset,
    params.purchasedAt,
    goldKarat,
    params.unitPrice
  );
  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const valueIlsAbs = computeAssetValueIls(
    asset.kind,
    absQty,
    unitPrice,
    asset.kind === "USD" && isLocalTodayDate(params.purchasedAt)
      ? liveRates?.usdIls
      : null
  );
  const signedQty = signedQuantity(entryType, absQty);
  const signedValue = entryType === "WITHDRAWAL" ? -valueIlsAbs : valueIlsAbs;
  const purchasedAt = new Date(params.purchasedAt);

  const { feeTransactionId, bankFeeIls } = await syncUsdBankFee({
    userId: params.userId,
    asset,
    entryType,
    bankFeeIls: params.bankFeeIls,
    dollarQuantity: absQty,
    purchasedAt,
  });

  const entry = await prisma.savingsAssetEntry.create({
    data: {
      assetId: params.assetId,
      quantity: signedQty,
      unitPrice,
      valueIls: signedValue,
      purchasedAt,
      notes: params.notes || null,
      bankFeeIls,
      feeTransactionId,
    },
  });

  const transactionId = await upsertEntryTransaction({
    userId: params.userId,
    asset,
    entryType,
    valueIls: signedValue,
    purchasedAt,
    notes: params.notes,
  });

  await prisma.savingsAssetEntry.update({
    where: { id: entry.id },
    data: { transactionId },
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
  unitPrice?: number;
  notes?: string | null;
  bankFeeIls?: number;
}) {
  const asset = await prisma.savingsAsset.findFirst({
    where: { id: params.assetId, userId: params.userId },
  });
  if (!asset) return null;

  const existing = await prisma.savingsAssetEntry.findFirst({
    where: { id: params.entryId, assetId: params.assetId },
  });
  if (!existing) return null;

  const entryType = entryTypeFromQuantity(Number(existing.quantity));
  const absQty =
    params.quantity !== undefined
      ? Math.abs(params.quantity)
      : Math.abs(Number(existing.quantity));
  const purchasedAtStr =
    params.purchasedAt ?? existing.purchasedAt.toISOString().slice(0, 10);
  const goldKarat = asset.goldKarat ?? 21;

  let unitPrice = Number(existing.unitPrice);
  if (
    asset.kind === "SILVER" ||
    asset.kind === "CRYPTO" ||
    asset.kind === "CUSTOM"
  ) {
    unitPrice = await resolveUnitPrice(
      asset,
      purchasedAtStr,
      goldKarat,
      params.unitPrice
    );
  } else if (asset.kind === "GOLD" && params.purchasedAt !== undefined) {
    unitPrice = await resolveUnitPrice(asset, purchasedAtStr, goldKarat);
  } else if (
    asset.kind === "USD" &&
    params.purchasedAt !== undefined &&
    isLocalTodayDate(purchasedAtStr)
  ) {
    unitPrice = await resolveUnitPrice(asset, purchasedAtStr, goldKarat);
  } else if (params.unitPrice != null && params.unitPrice > 0) {
    unitPrice = params.unitPrice;
  }

  const liveRates = asset.kind === "USD" ? await getMarketRates().catch(() => null) : null;
  const valueIlsAbs = computeAssetValueIls(
    asset.kind,
    absQty,
    unitPrice,
    asset.kind === "USD" && isLocalTodayDate(purchasedAtStr)
      ? liveRates?.usdIls
      : null
  );
  const signedQty = signedQuantity(entryType, absQty);
  const signedValue = entryType === "WITHDRAWAL" ? -valueIlsAbs : valueIlsAbs;
  const purchasedAt = new Date(purchasedAtStr);

  const balanceAfterEdit = (await currentBalance(params.assetId, params.entryId)) + signedQty;
  if (balanceAfterEdit < 0) {
    throw new Error("INSUFFICIENT_BALANCE");
  }

  const bankFee =
    params.bankFeeIls !== undefined
      ? params.bankFeeIls
      : existing.bankFeeIls != null
        ? Number(existing.bankFeeIls)
        : null;

  const { feeTransactionId, bankFeeIls } = await syncUsdBankFee({
    userId: params.userId,
    asset,
    entryType,
    bankFeeIls: bankFee,
    dollarQuantity: absQty,
    purchasedAt,
    existingFeeTransactionId: existing.feeTransactionId,
  });

  const entry = await prisma.savingsAssetEntry.update({
    where: { id: params.entryId },
    data: {
      quantity: signedQty,
      unitPrice,
      valueIls: signedValue,
      purchasedAt,
      bankFeeIls,
      feeTransactionId,
      ...(params.notes !== undefined ? { notes: params.notes || null } : {}),
    },
  });

  const transactionId = await upsertEntryTransaction({
    userId: params.userId,
    asset,
    entryType,
    valueIls: signedValue,
    purchasedAt,
    notes: params.notes ?? existing.notes,
    existingTransactionId: existing.transactionId,
  });

  if (transactionId !== existing.transactionId) {
    await prisma.savingsAssetEntry.update({
      where: { id: entry.id },
      data: { transactionId },
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
  if (existing.feeTransactionId) {
    await prisma.transaction
      .delete({ where: { id: existing.feeTransactionId } })
      .catch(() => null);
  }

  await prisma.savingsAssetEntry.delete({ where: { id: params.entryId } });
  await syncAssetFromEntries(params.assetId);
  return true;
}
