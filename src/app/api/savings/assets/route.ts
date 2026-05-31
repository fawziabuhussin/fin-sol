import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { savingsAssetSchema } from "@/lib/validations/savings";

function computeValueIls(
  quantity: number,
  unitPrice: number,
  priceCurrency: string
) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = savingsAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const valueIls = computeValueIls(
      data.quantity,
      data.unitPrice,
      data.priceCurrency
    );

    const created = await prisma.savingsAsset.create({
      data: {
        userId: user.id,
        kind: data.kind,
        title: data.title,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        priceCurrency: data.priceCurrency,
        valueIls,
        notes: data.notes || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
