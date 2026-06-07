import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { transactionSchema } from "@/lib/validations/transactions";
import { projectSchema } from "@/lib/validations/projects";
import { savingsAssetPurchaseSchema } from "@/lib/validations/savings";
import {
  computeAssetValueIls,
  normalizeUsdRate,
} from "@/lib/savings-asset-value";

const quickAddSchema = {
  TRANSACTION: transactionSchema,
  PROJECT: projectSchema,
  SAVINGS_ASSET: savingsAssetPurchaseSchema,
} as const;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { kind?: keyof typeof quickAddSchema; payload?: unknown };

    if (!body.kind || !(body.kind in quickAddSchema)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    if (body.kind === "SAVINGS_ASSET") {
      const parsed = quickAddSchema.SAVINGS_ASSET.safeParse(body.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const d = parsed.data;
      const unitPrice =
        d.kind === "USD" ? normalizeUsdRate(d.unitPrice) : d.unitPrice;
      const valueIls = computeAssetValueIls(d.kind, d.quantity, unitPrice);
      const title =
        d.title ||
        (d.kind === "GOLD" ? `ذهب ${d.goldKarat ?? 21}K` : "دولار أمريكي");

      let asset = await prisma.savingsAsset.findFirst({
        where: { userId: user.id, kind: d.kind },
        orderBy: { createdAt: "asc" },
      });

      if (asset) {
        const oldQty = Number(asset.quantity);
        const newQty = oldQty + d.quantity;
        const oldValue = computeAssetValueIls(
          d.kind,
          oldQty,
          Number(asset.unitPrice)
        );
        const newValue = Math.round((oldValue + valueIls) * 100) / 100;
        const avgRate =
          d.kind === "USD" && newQty > 0
            ? Math.round((newValue / newQty) * 10000) / 10000
            : unitPrice;
        asset = await prisma.savingsAsset.update({
          where: { id: asset.id },
          data: {
            quantity: newQty,
            unitPrice: avgRate,
            valueIls: newValue,
            ...(d.kind === "GOLD" && d.goldKarat
              ? { goldKarat: d.goldKarat }
              : {}),
          },
        });
      } else {
        asset = await prisma.savingsAsset.create({
          data: {
            userId: user.id,
            kind: d.kind,
            title,
            quantity: d.quantity,
            unitPrice,
            goldKarat: d.kind === "GOLD" ? (d.goldKarat ?? 21) : null,
            priceCurrency: d.kind === "USD" ? "USD" : "ILS",
            valueIls,
            notes: d.notes || null,
          },
        });
      }

      const entry = await prisma.savingsAssetEntry.create({
        data: {
          assetId: asset.id,
          quantity: d.quantity,
          unitPrice,
          valueIls,
          purchasedAt: new Date(d.purchasedAt),
          notes: d.notes || null,
        },
      });

      return NextResponse.json({ asset, entry }, { status: 201 });
    }

    if (body.kind === "TRANSACTION") {
      const parsed = quickAddSchema.TRANSACTION.safeParse(body.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const d = parsed.data;
      const item = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: d.type,
          amount: d.amount,
          occurredAt: new Date(d.occurredAt),
          description: d.description || null,
          notes: d.notes || null,
          projectId: d.projectId || null,
          categoryId: d.categoryId || null,
          payeeId: d.payeeId || null,
          paymentMethodId: d.paymentMethodId || null,
          currency: d.currency || "ILS",
        },
      });
      return NextResponse.json(item, { status: 201 });
    }

    const parsed = quickAddSchema.PROJECT.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const item = await prisma.project.create({
      data: {
        userId: user.id,
        title: d.title,
        description: d.description || null,
        totalBudget: d.totalBudget ?? null,
        targetDate: d.targetDate ? new Date(d.targetDate) : null,
        status: d.status,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
